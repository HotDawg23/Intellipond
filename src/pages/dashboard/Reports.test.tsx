import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "@/pages/dashboard/Reports";
import ReportDetail from "@/pages/ReportDetail";
import type { Report } from "@/lib/report-snapshot";

const state = vi.hoisted(() => ({ visibleReport: null as Report | null }));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select() { return query; },
        order() { return query; },
        eq() { return query; },
        async maybeSingle() { return { data: state.visibleReport, error: null }; },
        then(resolve: (value: unknown) => void) {
          resolve({ data: state.visibleReport ? [state.visibleReport] : [], error: null });
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
  beforeEach(() => { state.visibleReport = sharedReport; });

  it("lists shared reports without creation or raw exports", async () => {
    render(<MemoryRouter><Reports /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Weekly pond summary" })).toBeVisible();
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
    expect(screen.getByText("Checked the aerator.")).toBeVisible();
    expect(screen.getByText("No alerts were raised in this period.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
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
