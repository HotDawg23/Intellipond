import { startOfDay, subDays } from "date-fns";
import type { AlertRecord } from "@/lib/alerts";

export type AlertSeverityFilter = "all" | "critical" | "warning";
export type AlertDateRangeFilter = "all" | "today" | "7d" | "30d";
export type AlertStatusFilter = "all" | "needs_acknowledgement" | "acknowledged" | "resolved" | "legacy";

export function isAlertWithinDateRange(createdAt: string, range: AlertDateRangeFilter, now = new Date()) {
  if (range === "all") return true;

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return false;

  const startDate = range === "today"
    ? startOfDay(now)
    : subDays(now, range === "7d" ? 7 : 30);

  return createdDate >= startDate && createdDate <= now;
}

export function matchesAlertStatus(alert: AlertRecord, status: AlertStatusFilter) {
  switch (status) {
    case "needs_acknowledgement":
      return alert.status === "active" && !alert.acknowledged;
    case "acknowledged":
      return alert.status === "active" && alert.acknowledged;
    case "resolved":
      return alert.status === "resolved";
    case "legacy":
      return alert.status === "legacy_archived";
    default:
      return true;
  }
}
