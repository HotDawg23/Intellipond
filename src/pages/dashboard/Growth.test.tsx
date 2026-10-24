import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Growth from "@/pages/dashboard/Growth";

const state = vi.hoisted(() => ({ data: {} as Record<string, unknown[]> }));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "operator" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select() { return query; },
        order() { return query; },
        eq() { return query; },
        then(resolve: (value: unknown) => void) { resolve({ data: state.data[table] ?? [], error: null }); },
      };
      return query;
    },
  },
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ data }: { data: unknown[] }) => <div data-testid="growth-chart">{JSON.stringify(data)}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Line: () => null,
}));

const model = {
  target_horizon_days: 7,
  outputs: {
    avg_weight_g: { daily_log_growth_median: 0.01, daily_log_growth_p10: 0.005, daily_log_growth_p90: 0.02 },
    avg_length_cm: { daily_log_growth_median: 0.01, daily_log_growth_p10: 0.005, daily_log_growth_p90: 0.02 },
  },
  seven_day_validation: { status: "not_validated", note: "" },
  sources: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("Growth Monitoring", () => {
  it("keeps actual measurements visible if the reference model fails to load", async () => {
    const today = new Date().toISOString().slice(0, 10);
    state.data = {
      bangus_growth_records: [{ id: "a", fish_batch_id: "batch-a", pond_id: "pond-a", recorded_at: `${today}T00:00:00Z`, avg_weight_g: 10, avg_length_cm: 5 }],
      fish_batches: [{ id: "batch-a", pond_id: "pond-a", batch_name: "Current batch", stocking_date: today, stocked_fish_count: null, initial_weight_g: 2, initial_length_cm: 2, pond_profiles: { name: "Pond A", area_sqm: 100 } }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<Growth />);
    await waitFor(() => expect(screen.getByText(/10\.00/)).toBeVisible());
    expect(screen.getByRole("alert")).toHaveTextContent("Growth reference model could not be loaded");
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getAllByText(/Estimate unavailable/)).toHaveLength(3);
  });

  it("shows a dated estimate for a fresh weight sample and a clear missing-length state", async () => {
    const today = new Date().toISOString().slice(0, 10);
    state.data = {
      bangus_growth_records: [{ id: "a", fish_batch_id: "batch-a", pond_id: "pond-a", recorded_at: `${today}T00:00:00Z`, avg_weight_g: 10, avg_length_cm: null }],
      fish_batches: [{ id: "batch-a", pond_id: "pond-a", batch_name: "Current batch", stocking_date: today, stocked_fish_count: null, initial_weight_g: 2, initial_length_cm: null, pond_profiles: { name: "Pond A", area_sqm: 100 } }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => model }));

    render(<Growth />);
    const estimateLabel = await screen.findByText(/Estimate for/);
    expect(screen.getByRole("heading", { name: "7-day growth estimate" })).toBeVisible();
    expect(estimateLabel.compareDocumentPosition(screen.getAllByText("Last actual value")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Reference range:/)).toBeVisible();
    expect(screen.getByText(/Add a starting or sampled average length/)).toBeVisible();
    expect(screen.getByText("Research estimate")).toBeVisible();
  });

  it("shows only the selected batch and asks for new measurements when its samples are stale", async () => {
    const oldDate = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
    state.data = {
      bangus_growth_records: [
        { id: "a", fish_batch_id: "batch-a", pond_id: "pond-a", recorded_at: `${oldDate}T00:00:00Z`, avg_weight_g: 10, avg_length_cm: 5 },
        { id: "b", fish_batch_id: "batch-b", pond_id: "pond-b", recorded_at: new Date().toISOString(), avg_weight_g: 900, avg_length_cm: 40 },
      ],
      fish_batches: [
        { id: "batch-a", pond_id: "pond-a", batch_name: "Pond A batch", stocking_date: oldDate, stocked_fish_count: 100, initial_weight_g: 2, initial_length_cm: 2, pond_profiles: { name: "Pond A", area_sqm: 100 } },
        { id: "batch-b", pond_id: "pond-b", batch_name: "Pond B batch", stocking_date: oldDate, stocked_fish_count: 100, initial_weight_g: 2, initial_length_cm: 2, pond_profiles: { name: "Pond B", area_sqm: 100 } },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => model }));

    render(<Growth />);
    await waitFor(() => expect(screen.getAllByText("Pond A batch").length).toBeGreaterThan(0));
    expect(screen.getAllByText("New measurement needed for a forward estimate.")).toHaveLength(2);
    expect(screen.queryByText(/Estimate for/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("growth-chart")).toHaveLength(2);
    expect(screen.getAllByTestId("growth-chart")[0]).not.toHaveTextContent("900");
  });
});
