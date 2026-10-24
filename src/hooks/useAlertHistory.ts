import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRecord } from "@/lib/alerts";
import {
  ALERT_PAGE_SIZE, alertDateRangeStart, alertHistoryCutoff,
  type AlertAgeView, type AlertDateRangeFilter, type AlertSeverityFilter, type AlertStatusFilter,
} from "@/lib/alertFilters";

export type AlertWithPond = AlertRecord & { pond_profiles: { name: string } | null };

export function useAlertHistory(withPond: boolean) {
  const [alerts, setAlerts] = useState<AlertWithPond[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ageView, setAgeView] = useState<AlertAgeView>("recent");
  const [severity, setSeverity] = useState<AlertSeverityFilter>("all");
  const [dateRange, setDateRange] = useState<AlertDateRangeFilter>("all");
  const [status, setStatus] = useState<AlertStatusFilter>("all");
  const [page, setPage] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    const now = new Date();
    const cutoff = alertHistoryCutoff(now);
    let query = supabase.from("alerts")
      .select(withPond ? "*, pond_profiles(name)" : "*", { count: "exact" });

    query = ageView === "recent"
      ? query.or(`created_at.gte.${cutoff},status.eq.active`)
      : query.lt("created_at", cutoff).neq("status", "active");
    if (severity !== "all") query = query.eq("severity", severity);
    if (ageView === "recent") {
      const start = alertDateRangeStart(dateRange, now);
      if (start) query = query.gte("created_at", start).lte("created_at", now.toISOString());
    }
    if (status === "needs_acknowledgement") query = query.eq("status", "active").eq("acknowledged", false);
    if (status === "acknowledged") query = query.eq("status", "active").eq("acknowledged", true);
    if (status === "resolved") query = query.eq("status", "resolved");
    if (status === "legacy") query = query.eq("status", "legacy_archived");
    else if (ageView === "recent" && status === "all") query = query.neq("status", "legacy_archived");

    const { data, count, error } = await query.order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * ALERT_PAGE_SIZE, (page + 1) * ALERT_PAGE_SIZE - 1);
    if (currentRequest !== requestId.current) return;
    if (error) {
      setAlerts([]);
      setTotal(0);
      setError(error.message);
      toast.error("Could not load alerts", { description: error.message });
    } else {
      if (page > 0 && (count ?? 0) <= page * ALERT_PAGE_SIZE) {
        setPage(Math.max(0, Math.ceil((count ?? 0) / ALERT_PAGE_SIZE) - 1));
        return;
      }
      setAlerts((data ?? []) as unknown as AlertWithPond[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [ageView, dateRange, page, severity, status, withPond]);

  useEffect(() => {
    const sequence = requestId;
    void load();
    const channel = supabase.channel(withPond ? "admin-alert-history" : "alerts-operator")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => { void load(); })
      .subscribe();
    return () => {
      sequence.current++;
      void supabase.removeChannel(channel);
    };
  }, [load, withPond]);

  const changeAgeView = (value: AlertAgeView) => {
    setAgeView(value);
    setDateRange("all");
    if (value === "older" && (status === "needs_acknowledgement" || status === "acknowledged")) setStatus("all");
    setPage(0);
  };
  const changeSeverity = (value: AlertSeverityFilter) => { setSeverity(value); setPage(0); };
  const changeDateRange = (value: AlertDateRangeFilter) => { setDateRange(value); setPage(0); };
  const changeStatus = (value: AlertStatusFilter) => { setStatus(value); setPage(0); };
  const clearFilters = () => { setSeverity("all"); setDateRange("all"); setStatus("all"); setPage(0); };

  return {
    alerts, total, loading, error, ageView, severity, dateRange, status, page, setPage, load,
    changeAgeView, changeSeverity, changeDateRange, changeStatus, clearFilters,
  };
}
