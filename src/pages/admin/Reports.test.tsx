import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "@/pages/admin/Reports";
import { downloadGrowthRecordsCsv } from "@/lib/growth-records-export";
import { toast } from "sonner";

const state = vi.hoisted(() => ({
  reports: [] as { id: string; title: string; description: string | null; created_at: string }[],
  readings: [] as Record<string, unknown>[],
  readingsError: null as Error | null,
  reportsError: null as Error | null,
  resolveReports: null as null | (() => void),
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/growth-records-export", () => ({ downloadGrowthRecordsCsv: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
    from: (table: string) => table === "reports" ? {
      select() { return this; },
      order() { return this; },
      then(resolve: (value: unknown) => void) {
        if (state.resolveReports) {
          state.resolveReports = () => resolve({ data: state.reports, error: state.reportsError });
        } else resolve({ data: state.reports, error: state.reportsError });
      },
      async insert(values: { title: string; description: string | null }) {
        state.reports.unshift({ id: "new-report", ...values, created_at: "2026-10-23T10:00:00Z" });
        return { error: null };
      },
    } : {
      select() { return this; },
      order() { return this; },
      async limit() { return { data: state.readings, error: state.readingsError }; },
    },
  },
}));

describe("Reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reports = [{ id: "report-1", title: "Feeding notes", description: "Add more food", created_at: "2026-10-21T10:00:00Z" }];
    state.readings = [];
    state.readingsError = null;
    state.reportsError = null;
    state.resolveReports = null;
    vi.mocked(downloadGrowthRecordsCsv).mockResolvedValue(2);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("shows saved reports and keeps the growth download available", async () => {
    render(<Reports />);
    expect(await screen.findByText("Feeding notes")).toBeVisible();
    expect(screen.getByText("Latest 1,000 readings")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Export growth CSV" }));
    await waitFor(() => expect(downloadGrowthRecordsCsv).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Exported 2 growth records");

    vi.mocked(downloadGrowthRecordsCsv).mockResolvedValueOnce(0);
    fireEvent.click(screen.getByRole("button", { name: "Export growth CSV" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No growth records to export"));

    vi.mocked(downloadGrowthRecordsCsv).mockRejectedValueOnce(new Error("Connection failed"));
    fireEvent.click(screen.getByRole("button", { name: "Export growth CSV" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not export growth records: Connection failed"));
  });

  it("waits for the first request before showing the empty state", async () => {
    state.reports = [];
    const pending = () => {};
    state.resolveReports = pending;
    render(<Reports />);
    expect(screen.getByRole("status", { name: "Loading reports" })).toBeVisible();
    expect(screen.queryByText("No reports yet.")).toBeNull();
    await waitFor(() => expect(state.resolveReports).not.toBe(pending));
    state.resolveReports();
    expect(await screen.findByText("No reports yet.")).toBeVisible();
  });

  it("shows a retryable error instead of a false empty state", async () => {
    state.reports = [];
    state.reportsError = new Error("Connection failed");
    render(<Reports />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load reports: Connection failed");
    expect(screen.queryByText("No reports yet.")).toBeNull();
    state.reportsError = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No reports yet.")).toBeVisible();
  });

  it("downloads readings and reports empty or failed exports", async () => {
    state.readings = [{ recorded_at: "2026-10-23T10:00:00Z", pond_id: "pond-1", do_mg_l: 5, ph: 7, temperature_c: 28, turbidity_ntu: 30 }];
    render(<Reports />);
    const download = screen.getByRole("button", { name: "Export readings" });
    fireEvent.click(download);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exported 1 sensor reading"));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();

    state.readings = [];
    fireEvent.click(download);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No readings to export"));

    state.readingsError = new Error("Connection failed");
    fireEvent.click(download);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not export readings: Connection failed"));
  });

  it("creates a report and adds it to the saved list", async () => {
    render(<Reports />);
    fireEvent.click(screen.getByRole("button", { name: "New report" }));
    const fields = screen.getAllByRole("textbox");
    fireEvent.change(fields[0], { target: { value: "Water check" } });
    fireEvent.change(fields[1], { target: { value: "Daily notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Water check")).toBeVisible());
    expect(toast.success).toHaveBeenCalledWith("Report saved");
  });
});
