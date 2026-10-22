import { startOfDay, subDays } from "date-fns";
import type { AlertRecord } from "@/lib/alerts";

export type AlertSeverityFilter = "all" | "critical" | "warning";
export type AlertDateRangeFilter = "all" | "today" | "7d" | "30d";
export type AlertStatusFilter = "all" | "needs_acknowledgement" | "acknowledged" | "resolved" | "legacy";
export type AlertAgeView = "recent" | "older";
export const ALERT_PAGE_SIZE = 30;

export function alertHistoryCutoff(now = new Date()) {
  return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
}

export function isOlderAlert(alert: Pick<AlertRecord, "created_at" | "status">, now = new Date()) {
  return alert.status !== "active" && new Date(alert.created_at).getTime() < new Date(alertHistoryCutoff(now)).getTime();
}

export function alertDateRangeStart(range: AlertDateRangeFilter, now = new Date()) {
  if (range === "all") return null;
  return (range === "today" ? startOfDay(now) : subDays(now, range === "7d" ? 7 : 30)).toISOString();
}

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
