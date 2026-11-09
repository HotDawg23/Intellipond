import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import GrowthAdmin from "@/pages/admin/GrowthAdmin";

const state = vi.hoisted(() => ({
  data: {} as Record<string, unknown[]>,
  update: vi.fn(),
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select() { return query; },
        order() { return query; },
        eq() { return query; },
        update(payload: unknown) { state.update(payload); return query; },
        maybeSingle: async () => ({ data: { id: "batch-1" }, error: null }),
        limit() { return query; },
        then(resolve: (value: unknown) => void) { resolve({ data: state.data[table] ?? [], error: null }); },
      };
      return query;
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => Promise.resolve(),
  },
}));

describe("Growth Records summaries", () => {
  it("records a final count and closes a batch in one update", async () => {
    state.update.mockClear();
    state.data = {
      growth_records_with_water_averages: [],
      fish_batches: [{ id: "batch-1", pond_id: "pond-1", batch_name: "October batch", stocking_date: "2026-10-01", stocked_fish_count: 1000, harvest_date: null, harvested_fish_count: null, is_active: true, pond_profiles: { name: "BFAR", area_sqm: 100 } }],
      pond_profiles: [{ id: "pond-1", name: "BFAR", area_sqm: 100 }],
    };
    render(<GrowthAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Close batch" }));
    fireEvent.change(screen.getByLabelText("Harvest date"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Fish counted at harvest (yield)"), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Save harvest and close" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ harvest_date: "2026-11-01", harvested_fish_count: 900, is_active: false }));
  });

  it("lets an admin correct a closed batch's recorded count", async () => {
    state.update.mockClear();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    state.data = {
      growth_records_with_water_averages: [],
      fish_batches: [{ id: "batch-1", pond_id: "pond-1", batch_name: "Closed batch", stocking_date: "2026-10-01", stocked_fish_count: 1000, harvest_date: "2026-11-01", harvested_fish_count: 900, is_active: false, pond_profiles: { name: "BFAR", area_sqm: 100 } }],
      pond_profiles: [{ id: "pond-1", name: "BFAR", area_sqm: 100 }],
    };
    render(<GrowthAdmin />);
    fireEvent.click(await screen.findByRole("combobox", { name: "Show batches" }));
    fireEvent.click(await screen.findByRole("option", { name: "Closed (1)" }));
    expect(screen.getByText("10.00%")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit harvest" }));
    fireEvent.change(screen.getByLabelText("Fish counted at harvest (yield)"), { target: { value: "950" } });
    fireEvent.click(screen.getByRole("button", { name: "Save harvest" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ harvest_date: "2026-11-01", harvested_fish_count: 950, is_active: false }));
  });


  it("shows sparse and complete samples while keeping details expandable", async () => {
    state.data = {
      growth_records_with_water_averages: [
        { id: "new", fish_batch_id: "batch-1", measurement_date: "2026-10-20", batch_name: "October batch", pond_name: "BFAR", avg_weight_g: 12, avg_length_cm: null, growth_status: "On Track", age_days: 14, avg_do_mg_l: null, do_reading_count: 0, feeding_notes: null, pond_condition: null, average_start_date: null, average_end_date: null },
        { id: "old", fish_batch_id: "batch-1", measurement_date: "2026-10-15", batch_name: "October batch", pond_name: "BFAR", avg_weight_g: 10, avg_length_cm: 6, growth_status: null, age_days: 9, avg_do_mg_l: 5.5, do_reading_count: 3, feeding_notes: "Regular feed", pond_condition: "Clear", average_start_date: "2026-10-10", average_end_date: "2026-10-15" },
      ],
      fish_batches: [{ id: "batch-1", pond_id: "pond-1", batch_name: "October batch", stocking_date: "2026-10-06", stocked_fish_count: 1000, initial_weight_g: 2, initial_length_cm: 3, is_active: true, pond_profiles: { name: "BFAR", area_sqm: 100 } }],
      pond_profiles: [{ id: "pond-1", name: "BFAR", area_sqm: 100 }],
      batch_water_quality_references: [{
        fish_batch_id: "batch-1", do_mg_l: 5.9, ph: 8.38, temperature_c: 29.6, turbidity_ntu: 27.84,
        source_title: "Milkfish pond study", source_url: "https://example.com/study", reference_note: "Published context values.", updated_at: "2026-11-08T00:00:00Z",
      }],
    };

    render(<GrowthAdmin />);
    await waitFor(() => expect(screen.getAllByText("October batch").length).toBeGreaterThan(0));
    expect(screen.getAllByText("12 g").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6 cm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Details")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("Details")[0]);
    const researchEstimateLink = screen.getAllByRole("link", { name: "Research estimate" })[0];
    expect(researchEstimateLink.parentElement).toHaveTextContent("5.90 mg/L");
    expect(researchEstimateLink).toHaveAttribute("href", "https://example.com/study");
    fireEvent.click(screen.getAllByText("Details")[1]);
    expect(screen.getByText(/Regular feed/)).toBeVisible();
    expect(screen.getByText(/5.50 mg\/L \(3\)/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Export growth CSV/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add measurement/i })).toBeVisible();
  });

  it("filters batches and puts active batches first in the all view", async () => {
    state.data = {
      growth_records_with_water_averages: [
        { id: "active-sample", fish_batch_id: "active", measurement_date: "2026-10-20", batch_name: "Active batch", pond_name: "BFAR", avg_weight_g: 12, avg_length_cm: 6 },
        { id: "closed-sample", fish_batch_id: "closed-new", measurement_date: "2026-10-21", batch_name: "New closed batch", pond_name: "BFAR", avg_weight_g: 10, avg_length_cm: 5 },
      ],
      fish_batches: [
        { id: "closed-new", pond_id: "pond-1", batch_name: "New closed batch", stocking_date: "2026-10-22", is_active: false, pond_profiles: { name: "BFAR", area_sqm: 100 } },
        { id: "closed-old", pond_id: "pond-1", batch_name: "Old closed batch", stocking_date: "2025-10-01", is_active: false, pond_profiles: { name: "BFAR", area_sqm: 100 } },
        { id: "active", pond_id: "pond-1", batch_name: "Active batch", stocking_date: "2026-10-08", is_active: true, pond_profiles: { name: "BFAR", area_sqm: 100 } },
      ],
      pond_profiles: [{ id: "pond-1", name: "BFAR", area_sqm: 100 }],
    };
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });

    render(<GrowthAdmin />);
    const batchSection = await screen.findByRole("region", { name: "Fish batches" });
    expect(within(batchSection).getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual(["Active batch"]);

    fireEvent.click(screen.getByRole("combobox", { name: "Show batches" }));
    fireEvent.click(await screen.findByRole("option", { name: "All (3)" }));
    expect(within(batchSection).getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual([
      "Active batch", "New closed batch", "Old closed batch",
    ]);

    fireEvent.click(screen.getByRole("combobox", { name: "Show batches" }));
    fireEvent.click(await screen.findByRole("option", { name: "Closed (2)" }));
    expect(within(batchSection).getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual([
      "New closed batch", "Old closed batch",
    ]);

    const measurements = screen.getByRole("region", { name: "Measurements" });
    fireEvent.click(screen.getByRole("combobox", { name: "Filter by batch" }));
    fireEvent.click(await screen.findByRole("option", { name: "Active batch" }));
    expect(within(measurements).getByText("Active batch · BFAR")).toBeVisible();
    expect(within(measurements).queryByText("New closed batch · BFAR")).not.toBeInTheDocument();
  });
});
