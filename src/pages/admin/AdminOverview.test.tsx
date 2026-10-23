import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminOverview from "@/pages/admin/AdminOverview";

const state = vi.hoisted(() => ({
  queries: [] as { table: string; filters: { field: string; operation: string; value: unknown }[]; orders: { field: string; ascending: boolean }[]; range?: [number, number] }[],
  readings: [] as Record<string, unknown>[],
  alerts: [] as Record<string, unknown>[],
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const query = { table, filters: [] as { field: string; operation: string; value: unknown }[], orders: [] as { field: string; ascending: boolean }[], range: undefined as [number, number] | undefined };
      state.queries.push(query);
      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => { query.filters.push({ field, operation: "eq", value }); return builder; },
        neq: (field: string, value: unknown) => { query.filters.push({ field, operation: "neq", value }); return builder; },
        gte: (field: string, value: unknown) => { query.filters.push({ field, operation: "gte", value }); return builder; },
        lte: (field: string, value: unknown) => { query.filters.push({ field, operation: "lte", value }); return builder; },
        lt: (field: string, value: unknown) => { query.filters.push({ field, operation: "lt", value }); return builder; },
        order: (field: string, options?: { ascending?: boolean }) => { query.orders.push({ field, ascending: options?.ascending ?? true }); return builder; },
        range: (from: number, to: number) => { query.range = [from, to]; return builder; },
        then: (resolve: (result: { data: Record<string, unknown>[] | null; count: number; error: null }) => void) => {
          const records = table === "sensor_readings" ? state.readings : table === "alerts" ? state.alerts : [];
          const filtered = records.filter(record => query.filters.every(filter => {
            const value = record[filter.field];
            if (filter.operation === "gte") return value >= filter.value;
            if (filter.operation === "lte") return value <= filter.value;
            if (filter.operation === "lt") return value < filter.value;
            if (filter.operation === "neq") return value !== filter.value;
            return value === filter.value;
          }));
          const data = query.range ? filtered.slice(query.range[0], query.range[1] + 1) : null;
          resolve({ data, count: filtered.length, error: null });
        },
      };
      return builder;
    },
  },
}));

describe("AdminOverview recent activity", () => {
  beforeEach(() => {
    state.queries = [];
    state.readings = [];
    state.alerts = [];
  });

  it("shows 24-hour empty states and seven daily buckets", async () => {
    render(<MemoryRouter><AdminOverview /></MemoryRouter>);
    expect(await screen.findByText("No new alerts in the last 24 hours.")).toBeVisible();
    expect(screen.getByText("No new sensor readings in the last 24 hours.")).toBeVisible();
    expect(screen.getByRole("list", { name: "Sensor readings per day" }).children).toHaveLength(7);
    expect(screen.getByRole("list", { name: "New alerts per day" }).children).toHaveLength(7);
  });

  it("keeps older active alerts in totals while listing only events from the last 24 hours", async () => {
    const now = Date.now();
    state.alerts = [
      { id: "old", created_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(), status: "active", acknowledged: false, severity: "critical", category: "temperature", message: "Old active incident" },
      { id: "new", created_at: new Date(now - 60 * 60 * 1000).toISOString(), status: "active", acknowledged: false, severity: "warning", category: "temperature", message: "New alert" },
    ];
    state.readings = [{ id: "reading", recorded_at: new Date(now - 60 * 60 * 1000).toISOString(), do_mg_l: 5, ph: 7, temperature_c: 28, turbidity_ntu: 20 }];
    render(<MemoryRouter><AdminOverview /></MemoryRouter>);
    expect(await screen.findByText("New alert")).toBeVisible();
    expect(screen.queryByText("Old active incident")).not.toBeInTheDocument();
    expect(screen.getByText("2 unacknowledged", { exact: false })).toBeVisible();
    expect(screen.getByText("DO 5.00 mg/L", { exact: false })).toBeVisible();
    const listQueries = state.queries.filter(query => query.range);
    expect(listQueries).toHaveLength(2);
    expect(listQueries.every(query => query.filters.some(filter =>
      filter.operation === "gte" && ["created_at", "recorded_at"].includes(filter.field)
      && Math.abs(new Date(String(filter.value)).getTime() - (now - 24 * 60 * 60 * 1000)) < 10_000,
    ))).toBe(true);
    expect(listQueries.find(query => query.table === "alerts")?.orders).toEqual([
      { field: "created_at", ascending: false },
      { field: "id", ascending: false },
    ]);
    expect(listQueries.find(query => query.table === "sensor_readings")?.orders).toEqual([
      { field: "recorded_at", ascending: false },
      { field: "id", ascending: false },
    ]);
  });

  it("pages three alert rows at a time", async () => {
    const now = Date.now();
    state.alerts = Array.from({ length: 4 }, (_, index) => ({
      id: `alert-${index + 1}`,
      created_at: new Date(now - (index + 1) * 60 * 60 * 1000).toISOString(),
      status: "resolved",
      acknowledged: false,
      severity: "warning",
      category: "temperature",
      message: `Alert row ${index + 1}`,
      pond_profiles: { name: "BFAR" },
    }));
    render(<MemoryRouter><AdminOverview /></MemoryRouter>);
    expect(await screen.findByText("Alert row 1")).toBeVisible();
    expect(screen.getByText("Alert row 3")).toBeVisible();
    expect(screen.queryByText("Alert row 4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next alert page" }));
    expect(await screen.findByText("Alert row 4")).toBeVisible();
    expect(screen.queryByText("Alert row 1")).not.toBeInTheDocument();
  });

  it("pages sensor readings separately in groups of three", async () => {
    const now = Date.now();
    state.readings = Array.from({ length: 4 }, (_, index) => ({
      id: `reading-${index + 1}`,
      recorded_at: new Date(now - (index + 1) * 60 * 60 * 1000).toISOString(),
      do_mg_l: index + 1,
      ph: 7,
      temperature_c: 25,
      turbidity_ntu: 10,
      pond_profiles: { name: "BFAR" },
    }));
    render(<MemoryRouter><AdminOverview /></MemoryRouter>);
    expect(await screen.findByText("DO 1.00 mg/L", { exact: false })).toBeVisible();
    expect(screen.queryByText("DO 4.00 mg/L", { exact: false })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next sensor reading page" }));
    expect(await screen.findByText("DO 4.00 mg/L", { exact: false })).toBeVisible();
    expect(screen.queryByText("DO 1.00 mg/L", { exact: false })).not.toBeInTheDocument();
  });
});
