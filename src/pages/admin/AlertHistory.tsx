import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import AlertIncidentCard from "@/components/AlertIncidentCard";
import AlertListFilters from "@/components/AlertListFilters";
import { EmptyState, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRecord } from "@/lib/alerts";
import {
  isAlertWithinDateRange,
  matchesAlertStatus,
  type AlertDateRangeFilter,
  type AlertSeverityFilter,
  type AlertStatusFilter,
} from "@/lib/alertFilters";

type AlertWithPond = AlertRecord & { pond_profiles: { name: string } | null };

const AlertHistory = () => {
  const [alerts, setAlerts] = useState<AlertWithPond[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>("all");
  const [dateRange, setDateRange] = useState<AlertDateRangeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>("all");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*, pond_profiles(name)")
      .order("created_at", { ascending: false });

    if (error) toast.error("Could not load alert history", { description: error.message });
    else setAlerts((data ?? []) as unknown as AlertWithPond[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin-alert-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const acknowledge = async (id: string) => {
    setAcknowledgingId(id);
    const { data, error } = await supabase
      .from("alerts")
      .update({ acknowledged: true })
      .eq("id", id)
      .eq("status", "active")
      .eq("acknowledged", false)
      .select("*")
      .maybeSingle();
    setAcknowledgingId(null);

    if (error) return toast.error("Could not acknowledge alert", { description: error.message });
    if (!data) return toast.info("This incident was already acknowledged or is no longer active.");

    setAlerts(current => current.map(alert => alert.id === id ? { ...alert, ...data } : alert));
    toast.success("Alert acknowledged");
  };

  const scopedAlerts = alerts.filter(alert =>
    isAlertWithinDateRange(alert.created_at, dateRange) && matchesAlertStatus(alert, statusFilter)
  );
  const filteredAlerts = scopedAlerts.filter(
    alert => severityFilter === "all" || alert.severity === severityFilter
  );

  const clearFilters = () => {
    setSeverityFilter("all");
    setDateRange("all");
    setStatusFilter("all");
  };

  return (
    <AppShell admin>
      <PageHeader title="Alert History" subtitle="Review active incidents and archived alert records." />

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status">Loading alert history...</Card>
      ) : alerts.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Bell} title="No alerts recorded." />
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm sm:p-5">
            <AlertListFilters
              severity={severityFilter}
              onSeverityChange={setSeverityFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              status={statusFilter}
              onStatusChange={setStatusFilter}
            />
          </Card>

          {filteredAlerts.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={Bell}
                title="No alerts match these filters."
                description="Try a different severity, date range, or status."
              />
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              </div>
            </Card>
          ) : (
            <section aria-labelledby="admin-alert-timeline-title" className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 id="admin-alert-timeline-title" className="text-sm font-semibold tracking-wide">
                    Incident history
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Newest incidents appear first.</p>
                </div>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  {filteredAlerts.length} {filteredAlerts.length === 1 ? "incident" : "incidents"}
                </span>
              </div>

              <div className="space-y-3">
                {filteredAlerts.map(alert => (
                  <AlertIncidentCard
                    key={alert.id}
                    alert={alert}
                    pondName={alert.pond_profiles?.name ?? "Pond unavailable"}
                    canAcknowledge
                    acknowledging={acknowledgingId === alert.id}
                    onAcknowledge={() => void acknowledge(alert.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
};

export default AlertHistory;
