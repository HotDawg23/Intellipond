import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import GrowthAdmin from "@/pages/admin/GrowthAdmin";

const state = vi.hoisted(() => ({
  data: {} as Record<string, unknown[]>,
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select() { return query; },
        order() { return query; },
        then(resolve: (value: unknown) => void) { resolve({ data: state.data[table] ?? [], error: null }); },
      };
      return query;
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => Promise.resolve(),
  },
}));

describe("Growth Records summaries", () => {
  it("shows sparse and complete samples while keeping details expandable", async () => {
    state.data = {
      growth_records_with_water_averages: [
        { id: "new", fish_batch_id: "batch-1", measurement_date: "2026-10-20", batch_name: "October batch", pond_name: "BFAR", avg_weight_g: 12, avg_length_cm: null, growth_status: "On Track", age_days: 14, avg_do_mg_l: null, do_reading_count: 0, feeding_notes: null, pond_condition: null, average_start_date: null, average_end_date: null },
        { id: "old", fish_batch_id: "batch-1", measurement_date: "2026-10-15", batch_name: "October batch", pond_name: "BFAR", avg_weight_g: 10, avg_length_cm: 6, growth_status: null, age_days: 9, avg_do_mg_l: 5.5, do_reading_count: 3, feeding_notes: "Regular feed", pond_condition: "Clear", average_start_date: "2026-10-10", average_end_date: "2026-10-15" },
      ],
      fish_batches: [{ id: "batch-1", pond_id: "pond-1", batch_name: "October batch", stocking_date: "2026-10-06", stocked_fish_count: 1000, initial_weight_g: 2, initial_length_cm: 3, is_active: true, pond_profiles: { name: "BFAR", area_sqm: 100 } }],
      pond_profiles: [{ id: "pond-1", name: "BFAR", area_sqm: 100 }],
    };

    render(<GrowthAdmin />);
    await waitFor(() => expect(screen.getAllByText("October batch").length).toBeGreaterThan(0));
    expect(screen.getAllByText("12 g").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6 cm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Details")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("Details")[1]);
    expect(screen.getByText(/Regular feed/)).toBeVisible();
    expect(screen.getByText(/5.50 mg\/L \(3\)/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Export growth CSV/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add measurement/i })).toBeVisible();
  });
});
