import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "@/pages/admin/Reports";
import { downloadGrowthRecordsCsv } from "@/lib/growth-records-export";
import type { Report } from "@/lib/report-snapshot";
import { toast } from "sonner";

const state = vi.hoisted(() => ({
  reports: [] as Report[],
  readings: [] as Record<string, unknown>[],
  reportsError: null as Error | null,
  readingsError: null as Error | null,
  recipients: [] as { report_id: string; user_id: string }[],
  rpc: vi.fn(),
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/growth-records-export", () => ({ downloadGrowthRecordsCsv: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
      const query = {
        select() { return query; },
        order() { return query; },
        async limit() { return { data: state.readings, error: state.readingsError }; },
        then(resolve: (value: unknown) => void) {
          const data = table === "reports" ? state.reports
            : table === "pond_profiles" ? [{ id: "pond-1", name: "BFAR" }]
            : table === "fish_batches" ? [{ id: "batch-1", pond_id: "pond-1", batch_name: "Batch 1" }]
            : table === "profiles" ? [{ id: "operator-1", full_name: "Alex Operator", email: "alex@example.com", approved: true }]
            : table === "user_roles" ? [{ user_id: "operator-1", role: "operator" }]
            : table === "report_recipients" ? state.recipients
            : [];
          resolve({ data, error: table === "reports" ? state.reportsError : null });
        },
      };
      return query;
    },
  },
}));

const snapshot = {
  version: 1,
  generated_at: "2026-10-27T10:00:00Z",
  time_zone: "Asia/Manila",
  pond_name: "BFAR",
  batch_name: null,
  readings: { count: 1 },
  alerts: { count: 0 },
  growth: { count: 0 },
};

const report = (): Report => ({
  id: "report-1",
  title: "October pond report",
  description: "Pond is stable",
  file_path: null,
  fish_batch_id: null,
  generated_by: "admin-1",
  period_start: "2026-10-20",
  period_end: "2026-10-27",
  pond_id: "pond-1",
  published_at: "2026-10-27T10:00:00Z",
  report_data: snapshot,
  created_at: "2026-10-27T10:00:00Z",
});
const renderPage = () => render(<MemoryRouter><Reports /></MemoryRouter>);

describe("Admin reports", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.clearAllMocks();
    state.reports = [report()];
    state.readings = [];
    state.recipients = [{ report_id: "report-1", user_id: "operator-1" }];
    state.reportsError = null;
    state.readingsError = null;
    state.rpc.mockResolvedValue({ data: "new-report", error: null });
    vi.mocked(downloadGrowthRecordsCsv).mockResolvedValue(2);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("shows generated reports and keeps admin exports", async () => {
    renderPage();
    expect(await screen.findByText("October pond report")).toBeVisible();
    expect(screen.getByText(/BFAR.*2026-10-20 to 2026-10-27/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Export growth CSV" }));
    await waitFor(() => expect(downloadGrowthRecordsCsv).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Exported 2 growth records");

    state.readings = [{ recorded_at: "2026-10-23T10:00:00Z", pond_id: "pond-1", do_mg_l: 5, ph: 7, temperature_c: 28, turbidity_ntu: 30 }];
    fireEvent.click(screen.getByRole("button", { name: "Export readings" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exported 1 sensor reading"));
  });

  it("creates a pond report with a selected operator", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New report" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Weekly report" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Pond" }));
    fireEvent.click(await screen.findByRole("option", { name: "BFAR" }));
    fireEvent.click(await screen.findByLabelText("Alex Operator"));
    fireEvent.click(screen.getByRole("button", { name: "Create report" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("create_pond_report", expect.objectContaining({
      p_title: "Weekly report",
      p_pond_id: "pond-1",
      p_batch_id: null,
      p_operator_ids: ["operator-1"],
    })));
    expect(toast.success).toHaveBeenCalledWith("Report created");
  });

  it("updates recipients", async () => {
    renderPage();
    await screen.findByText("October pond report");
    fireEvent.click(screen.getByRole("button", { name: "Manage access" }));
    fireEvent.click(screen.getByLabelText("Alex Operator"));
    fireEvent.click(screen.getByRole("button", { name: "Save access" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("set_report_recipients", {
      p_report_id: "report-1",
      p_operator_ids: [],
    }));
  });

  it("shows a retryable loading error", async () => {
    state.reportsError = new Error("Connection failed");
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load reports: Connection failed");
    state.reportsError = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("October pond report")).toBeVisible();
  });
});
