import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import AlertIncidentCard from "@/components/AlertIncidentCard";
import AlertListFilters from "@/components/AlertListFilters";
import AlertPagination from "@/components/AlertPagination";
import { EmptyState, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAlertHistory } from "@/hooks/useAlertHistory";
import { supabase } from "@/integrations/supabase/client";
import { ALERT_PAGE_SIZE } from "@/lib/alertFilters";

const AlertHistory = () => {
  const history = useAlertHistory(true);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const acknowledge = async (id: string) => {
    setAcknowledgingId(id);
    const { data, error } = await supabase.from("alerts")
      .update({ acknowledged: true }).eq("id", id).eq("status", "active")
      .eq("acknowledged", false).select("id").maybeSingle();
    setAcknowledgingId(null);
    if (error) return toast.error("Could not acknowledge alert", { description: error.message });
    if (!data) return toast.info("This incident was already acknowledged or is no longer active.");
    await history.load();
    toast.success("Alert acknowledged");
  };

  return (
    <AppShell admin>
      <PageHeader title="Alert History" subtitle="Review recent incidents and older retained alerts." />
      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card to-muted/30 shadow-sm">
        <div className="p-4 sm:p-5">
          <AlertListFilters ageView={history.ageView} onAgeViewChange={history.changeAgeView}
            severity={history.severity} onSeverityChange={history.changeSeverity}
            dateRange={history.dateRange} onDateRangeChange={history.changeDateRange}
            status={history.status} onStatusChange={history.changeStatus} />
        </div>
        <div className="border-t border-border/70">
          {history.loading ? (
            <p className="p-6 text-sm text-muted-foreground" role="status">Loading alert history...</p>
          ) : history.error ? (
            <div className="p-6 text-sm text-destructive-text" role="alert">Could not load alerts: {history.error} <Button variant="outline" className="ml-3" onClick={() => void history.load()}>Retry</Button></div>
          ) : history.alerts.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState icon={Bell} title={history.ageView === "older" ? "No older alerts match." : "No recent alerts match."}
                description={history.ageView === "older" ? "Try another status or severity, or wait for resolved alerts to reach 90 days." : "Try another filter or check back when incidents are recorded."} />
              <div className="mt-4 flex justify-center"><Button variant="outline" onClick={history.clearFilters}>Clear filters</Button></div>
            </div>
          ) : (
            <section aria-labelledby="admin-alert-timeline-title">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2 id="admin-alert-timeline-title" className="text-sm font-semibold tracking-wide">{history.ageView === "older" ? "Older alerts" : "Recent alerts"}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Newest incidents appear first.</p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {history.total} {history.total === 1 ? "incident" : "incidents"}
                </span>
              </div>
              <ul className="divide-y divide-border/70">
                {history.alerts.map(alert => (
                  <li key={alert.id} className="transition-colors hover:bg-muted/20">
                    <AlertIncidentCard alert={alert} pondName={alert.pond_profiles?.name ?? "Pond unavailable"}
                      showSeverityAccent={false} flat
                      canAcknowledge={history.ageView === "recent"} acknowledging={acknowledgingId === alert.id}
                      onAcknowledge={() => void acknowledge(alert.id)} />
                  </li>
                ))}
              </ul>
              {history.total > ALERT_PAGE_SIZE && (
                <div className="border-t border-border/70 p-4 sm:px-5">
                  <AlertPagination page={history.page} total={history.total} onPageChange={history.setPage} />
                </div>
              )}
            </section>
          )}
        </div>
      </Card>
    </AppShell>
  );
};

export default AlertHistory;
