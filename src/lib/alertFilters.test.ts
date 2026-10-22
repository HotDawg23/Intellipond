import { describe, expect, it } from "vitest";
import { alertDateRangeStart, alertHistoryCutoff, isOlderAlert, isAlertWithinDateRange, matchesAlertStatus } from "@/lib/alertFilters";
import type { AlertRecord } from "@/lib/alerts";

const now = new Date("2026-10-22T12:00:00.000Z");
const cutoff = alertHistoryCutoff(now);
const alert = (created_at: string, status: AlertRecord["status"], acknowledged = false) =>
  ({ created_at, status, acknowledged }) as AlertRecord;

describe("90-day alert views", () => {
  it("keeps an alert at the exact boundary in recent", () => {
    expect(isOlderAlert(alert(cutoff, "resolved"), now)).toBe(false);
    expect(isOlderAlert(alert(new Date(new Date(cutoff).getTime() - 1).toISOString(), "resolved"), now)).toBe(true);
  });

  it("keeps an unresolved alert in recent even when it is old", () => {
    expect(isOlderAlert(alert("2025-01-01T00:00:00Z", "active"), now)).toBe(false);
    expect(isOlderAlert(alert("2025-01-01T00:00:00Z", "legacy_archived"), now)).toBe(true);
  });

  it("retains the existing status and date filter meanings", () => {
    expect(matchesAlertStatus(alert(cutoff, "active", false), "needs_acknowledgement")).toBe(true);
    expect(matchesAlertStatus(alert(cutoff, "active", true), "acknowledged")).toBe(true);
    expect(matchesAlertStatus(alert(cutoff, "resolved"), "resolved")).toBe(true);
    expect(isAlertWithinDateRange(cutoff, "30d", now)).toBe(false);
    expect(alertDateRangeStart("all", now)).toBeNull();
  });
});
