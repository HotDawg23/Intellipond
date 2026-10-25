import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sensors from "@/pages/admin/Sensors";

const state = vi.hoisted(() => ({
  readings: [] as Record<string, unknown>[],
  queries: [] as { table: string; filters: { operation: string; value: string }[]; orders: { field: string; ascending: boolean }[]; range?: [number, number]; head?: boolean }[],
  onReadingChange: null as (() => void) | null,
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const query = { table, filters: [] as { operation: string; value: string }[], orders: [] as { field: string; ascending: boolean }[], range: undefined as [number, number] | undefined, head: false };
      state.queries.push(query);
      const builder = {
        select: (_columns: string, options?: { head?: boolean }) => { query.head = options?.head ?? false; return builder; },
        gte: (_field: string, value: string) => { query.filters.push({ operation: "gte", value }); return builder; },
        lt: (_field: string, value: string) => { query.filters.push({ operation: "lt", value }); return builder; },
        order: (field: string, options: { ascending: boolean }) => { query.orders.push({ field, ascending: options.ascending }); return builder; },
        range: (from: number, to: number) => { query.range = [from, to]; return builder; },
        then: (resolve: (result: { data: Record<string, unknown>[]; count: number | null; error: { code: string; message: string } | null }) => void) => {
          const filtered = (table === "sensor_readings" ? state.readings : []).filter(row =>
            query.filters.every(filter => filter.operation === "gte" ? row.recorded_at >= filter.value : row.recorded_at < filter.value),
          );
          const sorted = [...filtered].sort((a, b) => {
            const direction = query.orders[0]?.ascending ? 1 : -1;
            return direction * (String(a.recorded_at).localeCompare(String(b.recorded_at)) || String(a.id).localeCompare(String(b.id)));
          });
          if (query.range && query.range[0] > 0 && query.range[0] >= filtered.length) {
            resolve({ data: [], count: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } });
          } else {
            resolve({ data: query.head ? [] : query.range ? sorted.slice(query.range[0], query.range[1] + 1) : sorted, count: filtered.length, error: null });
          }
        },
      };
      return builder;
    },
    channel: () => ({ on(_event: string, _filter: unknown, callback: () => void) { state.onReadingChange = callback; return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  },
}));

describe("Sensor Readings filters", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    state.queries = [];
    state.onReadingChange = null;
    state.readings = Array.from({ length: 21 }, (_, index) => ({
      id: `reading-${index}`,
      recorded_at: new Date(2026, 9, 21, 0, index).toISOString(),
      do_mg_l: 7,
      ph: 7,
      temperature_c: 28,
      turbidity_ntu: 10,
      pond_profiles: { name: "BFAR" },
    }));
    state.readings.push({ ...state.readings[0], id: "previous-day", recorded_at: new Date(2026, 9, 20, 23, 59).toISOString() });
  });

  it("filters by the displayed local day and pages 20 readings at a time", async () => {
    render(<Sensors />);
    expect(await screen.findByText("22 readings")).toBeVisible();
    expect(state.queries.find(query => query.table === "sensor_readings")?.range).toEqual([0, 19]);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-21" } });
    expect(await screen.findByText("21 readings")).toBeVisible();
    const filteredQuery = state.queries.filter(query => query.table === "sensor_readings").at(-1);
    expect(filteredQuery?.filters).toEqual([
      { operation: "gte", value: new Date(2026, 9, 21).toISOString() },
      { operation: "lt", value: new Date(2026, 9, 22).toISOString() },
    ]);
    expect(filteredQuery?.orders).toEqual([{ field: "recorded_at", ascending: false }, { field: "id", ascending: false }]);

    fireEvent.click(screen.getByRole("button", { name: "Next readings page" }));
    await waitFor(() => expect(state.queries.filter(query => query.table === "sensor_readings").at(-1)?.range).toEqual([20, 39]));
    expect(await screen.findByText("Showing 21–21 of 21")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next readings page" })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Sort by date" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Oldest first" }));
    await waitFor(() => expect(state.queries.filter(query => query.table === "sensor_readings").at(-1)?.orders).toEqual([
      { field: "recorded_at", ascending: true }, { field: "id", ascending: true },
    ]));
    expect(screen.getByText("Showing 1–20 of 21")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-19" } });
    expect(await screen.findByText("No readings for this date.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
    expect(await screen.findByText("22 readings")).toBeVisible();
  });

  it("returns to the last page when a deletion makes the current range invalid", async () => {
    render(<Sensors />);
    expect(await screen.findByText("22 readings")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-21" } });
    expect(await screen.findByText("21 readings")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next readings page" }));
    expect(await screen.findByText("Showing 21–21 of 21")).toBeVisible();

    state.readings = state.readings.filter(reading => reading.id !== "reading-0");
    act(() => state.onReadingChange?.());

    expect(await screen.findByText("20 readings")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(state.queries.some(query => query.table === "sensor_readings" && query.head && query.filters.length === 2)).toBe(true);
    expect(state.queries.filter(query => query.table === "sensor_readings" && query.range).at(-1)?.range).toEqual([0, 19]);
  });
});
