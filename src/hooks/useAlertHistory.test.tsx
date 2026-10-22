import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAlertHistory } from "@/hooks/useAlertHistory";

type Call = { method: string; args: unknown[] };
const state = vi.hoisted(() => ({ requests: [] as Array<{ calls: Call[] }> }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const request = { calls: [] as Call[] };
      state.requests.push(request);
      const query = {} as Record<string, (...args: unknown[]) => unknown>;
      for (const method of ["select", "or", "lt", "neq", "eq", "gte", "lte", "order"]) {
        query[method] = (...args: unknown[]) => {
          request.calls.push({ method, args });
          return query;
        };
      }
      query.range = (...args: unknown[]) => {
        request.calls.push({ method: "range", args });
        return Promise.resolve({ data: [], count: 0, error: null });
      };
      return query;
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => Promise.resolve(),
  },
}));

beforeEach(() => { state.requests.length = 0; });

describe("alert history queries", () => {
  it("loads recent alerts first, then requests older resolved and legacy alerts", async () => {
    const { result } = renderHook(() => useAlertHistory(false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0].calls.some(call => call.method === "or" && String(call.args[0]).includes("status.eq.active"))).toBe(true);
    expect(state.requests[0].calls.find(call => call.method === "range")?.args).toEqual([0, 29]);

    act(() => result.current.changeAgeView("older"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(state.requests).toHaveLength(2);
    expect(state.requests[1].calls.some(call => call.method === "lt" && call.args[0] === "created_at")).toBe(true);
    expect(state.requests[1].calls.some(call => call.method === "neq" && call.args[0] === "status" && call.args[1] === "active")).toBe(true);
  });

  it("applies severity and status filters and resets the date filter when switching views", async () => {
    const { result } = renderHook(() => useAlertHistory(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.changeSeverity("critical");
      result.current.changeStatus("resolved");
      result.current.changeDateRange("7d");
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const recent = state.requests.at(-1)?.calls ?? [];
    expect(recent.some(call => call.method === "eq" && call.args[0] === "severity" && call.args[1] === "critical")).toBe(true);
    expect(recent.some(call => call.method === "eq" && call.args[0] === "status" && call.args[1] === "resolved")).toBe(true);
    expect(recent.some(call => call.method === "gte" && call.args[0] === "created_at")).toBe(true);

    act(() => result.current.changeAgeView("older"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dateRange).toBe("all");
    expect(state.requests.at(-1)?.calls.some(call => call.method === "gte")).toBe(false);
  });

  it("clears active-only status when opening read-only older alerts", async () => {
    const { result } = renderHook(() => useAlertHistory(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.changeStatus("needs_acknowledgement"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.changeAgeView("older"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe("all");
  });
});
