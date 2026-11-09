import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "@/pages/dashboard/Reports";
import ReportDetail from "@/pages/ReportDetail";
import type { Report } from "@/lib/report-snapshot";
import type { BatchWaterQualityReference } from "@/lib/batch-water-quality-reference";

const state = vi.hoisted(() => ({ visibleReport: null as Report | null, reference: null as BatchWaterQualityReference | null }));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select() { return query; },
        order() { return query; },
        eq() { return query; },
        async maybeSingle() {
          return { data: table === "batch_water_quality_references" ? state.reference : state.visibleReport, error: null };
        },
        then(resolve: (value: unknown) => void) {
          resolve({ data: table === "reports" && state.visibleReport ? [state.visibleReport] : [], error: null });
        },
      };
      return query;
    },
  },
}));

const metric = { count: 1, average: 7.2, min: 7.2, max: 7.2 };
const sharedReport: Report = {
  id: "report-1",
  title: "Weekly pond summary",
  description: "Checked the aerator.",
  file_path: null,
  fish_batch_id: "batch-1",
  generated_by: "admin-1",
  period_start: "2026-10-20",
  period_end: "2026-10-27",
  pond_id: "pond-1",
  published_at: "2026-10-27T10:00:00Z",
  created_at: "2026-10-27T10:00:00Z",
  report_data: {
    version: 1,
    generated_at: "2026-10-27T10:00:00Z",
    time_zone: "Asia/Manila",
    pond_name: "BFAR",
    batch_name: "Batch 1",
    readings: {
      count: 1,
      first_at: "2026-10-22T10:00:00Z",
      last_at: "2026-10-22T10:00:00Z",
      latest: { at: "2026-10-22T10:00:00Z", do_mg_l: 7.2, ph: 6.6, temperature_c: 29, turbidity_ntu: 20 },
      do_mg_l: metric,
      ph: metric,
      temperature_c: metric,
      turbidity_ntu: metric,
    },
    alerts: { count: 0, critical: 0, warning: 0, active: 0, recent: [] },
    growth: { count: 0, first: null, latest: null, weight_change_g: null, length_change_cm: null },
  },
};

const reportWithAlerts = (): Report => ({
  ...sharedReport,
  report_data: {
    ...(sharedReport.report_data as object),
    alerts: {
      count: 3,
      critical: 1,
      warning: 2,
      active: 1,
      recent: [1, 2, 3].map(number => ({
        severity: number === 1 ? "critical" : "warning",
        message: `Alert ${number}`,
        status: "active",
        created_at: `2026-10-2${number}T10:00:00Z`,
        recommendation: null,
      })),
    },
  },
} as Report);

describe("Operator reports", () => {
  beforeEach(() => { state.visibleReport = sharedReport; state.reference = null; });

  it("lists shared reports without creation or raw exports", async () => {
    render(<MemoryRouter><Reports /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Weekly pond summary" })).toBeVisible();
    expect(screen.getByText(/Oct 20, 2026 to Oct 27, 2026/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "New report" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export readings" })).toBeNull();
  });

  it("shows the saved snapshot and prints it", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/dashboard/reports/report-1"]}>
        <Routes><Route path="/dashboard/reports/:id" element={<ReportDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Weekly pond summary" })).toBeVisible();
    expect(screen.getByText("Period: Oct 20, 2026 to Oct 27, 2026")).toBeVisible();
    expect(screen.getByText("Checked the aerator.")).toBeVisible();
    expect(screen.getByText("No recorded alerts were raised in this period.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Final harvest" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it("shows a saved harvest in a new report", async () => {
    state.visibleReport = {
      ...sharedReport,
      report_data: { ...(sharedReport.report_data as object), harvest: [{
        batch_name: "Batch 1", harvest_date: "2026-10-25", stocked_fish_count: 1000,
        harvested_fish_count: 900, mortality_count: 100, mortality_rate: 10,
      }] },
    } as Report;
    render(<MemoryRouter initialEntries={["/dashboard/reports/report-1"]}>
      <Routes><Route path="/dashboard/reports/:id" element={<ReportDetail />} /></Routes>
    </MemoryRouter>);
    const card = (await screen.findByRole("heading", { name: "Final harvest" })).parentElement;
    expect(card).toHaveTextContent("900");
    expect(card).toHaveTextContent("100");
    expect(card).toHaveTextContent("10.00%");
  });

  it("shows cited research values without empty fields or zero counts", async () => {
    const emptyMetric = { count: 0, average: null, min: null, max: null };
    state.visibleReport = {
      ...sharedReport,
      period_start: "2025-10-17",
      period_end: "2025-11-17",
      report_data: {
        ...(sharedReport.report_data as object),
        pond_name: "BFAR 2025 Pond 1 (historical)",
        batch_name: "BFAR Pond 1 Second Cycle 2025",
        readings: {
          count: 0, first_at: null, last_at: null, latest: null,
          do_mg_l: emptyMetric, ph: emptyMetric, temperature_c: emptyMetric, turbidity_ntu: emptyMetric,
        },
        growth: { count: 3, first: null, latest: null, weight_change_g: null, length_change_cm: null },
      },
    } as Report;
    state.reference = {
      fish_batch_id: "batch-1",
      do_mg_l: 5.9,
      ph: 8.38,
      temperature_c: 29.6,
      turbidity_ntu: 27.84,
      source_title: "Milkfish pond study",
      source_url: "https://example.com/study",
      reference_note: "Published context values, not batch measurements.",
    };

    render(
      <MemoryRouter initialEntries={["/dashboard/reports/report-1"]}>
        <Routes><Route path="/dashboard/reports/:id" element={<ReportDetail />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Recorded sensor values with clearly marked research estimates where readings are unavailable.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Beta sample readings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Beta sample alerts" })).not.toBeInTheDocument();
    const waterQualityCard = screen.getByRole("heading", { name: "Water quality" }).parentElement?.parentElement;
    expect(waterQualityCard).not.toBeNull();
    const waterQuality = within(waterQualityCard as HTMLElement);
    expect(screen.getByText("Sensor readings").parentElement).toHaveTextContent("Research estimate5");
    expect(screen.getByText("Alerts raised").parentElement).toHaveTextContent("0");
    expect(screen.getByText("Growth measurements").parentElement).toHaveTextContent("3");
    expect(screen.queryByText(/No sensor readings were recorded/)).not.toBeInTheDocument();
    expect(screen.getAllByText("5.90 mg/L")).toHaveLength(2);
    expect(screen.getAllByText("Research estimate").length).toBeGreaterThan(0);
    expect(screen.getByText("Research-estimate values are included in the water quality section and are separate from recorded readings.")).toBeVisible();
    expect(screen.getAllByText("5 estimates").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5.60 mg/L").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6.10 mg/L").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 samples")).not.toBeInTheDocument();
    expect(waterQuality.getAllByText("Latest").length).toBeGreaterThan(0);
    expect(waterQuality.getAllByText("Minimum").length).toBeGreaterThan(0);
    expect(waterQuality.getAllByText("Maximum").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Milkfish pond study" })).toHaveAttribute("href", "https://example.com/study");
    expect(screen.getByText(/contextual research references and are kept separate from measured sensor history/)).toBeVisible();
    expect(screen.getByText("No recorded alerts were raised in this period.")).toBeVisible();
    expect(screen.queryByText(/0 critical|0 warning|0 still active/)).not.toBeInTheDocument();
  });

  it("pages two alerts on screen while keeping every saved alert available for print", async () => {
    state.visibleReport = reportWithAlerts();

    render(
      <MemoryRouter initialEntries={["/dashboard/reports/report-1"]}>
        <Routes><Route path="/dashboard/reports/:id" element={<ReportDetail />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alert 1")).toBeVisible();
    expect(screen.getByText("Alert 2")).toBeVisible();
    expect(screen.getByText("Alert 3").parentElement).toHaveClass("hidden", "print:block");
    expect(screen.getByText("Showing 1–2 of 3")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next alert page" }));
    expect(screen.getByText("Alert 1").parentElement).toHaveClass("hidden", "print:block");
    expect(screen.getByText("Alert 3").parentElement).not.toHaveClass("hidden");
    expect(screen.getByText("Showing 3–3 of 3")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Data coverage" }).parentElement?.parentElement).toContainElement(
      screen.getByRole("heading", { name: "Notes and actions" }),
    );
  });

  it("uses the same coverage and alert layout for admins", async () => {
    state.visibleReport = reportWithAlerts();
    render(
      <MemoryRouter initialEntries={["/admin/reports/report-1"]}>
        <Routes><Route path="/admin/reports/:id" element={<ReportDetail admin />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alert 1")).toBeVisible();
    expect(screen.getByText("Alert 3").parentElement).toHaveClass("hidden", "print:block");
    fireEvent.click(screen.getByRole("button", { name: "Next alert page" }));
    expect(screen.getByText("Alert 3").parentElement).not.toHaveClass("hidden");
    expect(screen.getByRole("heading", { name: "Data coverage" }).parentElement?.parentElement).toContainElement(
      screen.getByRole("heading", { name: "Notes and actions" }),
    );
  });

  it("does not show an inaccessible report", async () => {
    state.visibleReport = null;
    render(
      <MemoryRouter initialEntries={["/dashboard/reports/report-1"]}>
        <Routes><Route path="/dashboard/reports/:id" element={<ReportDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Report not found.")).toBeVisible();
  });
});
