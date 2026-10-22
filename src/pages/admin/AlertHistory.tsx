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
      <div className="space-y-5">
        <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm sm:p-5">
          <AlertListFilters ageView={history.ageView} onAgeViewChange={history.changeAgeView}
            severity={history.severity} onSeverityChange={history.changeSeverity}
            dateRange={history.dateRange} onDateRangeChange={history.changeDateRange}
            status={history.status} onStatusChange={history.changeStatus} />
        </Card>
        {history.loading ? (
          <Card className="p-6 text-sm text-muted-foreground" role="status">Loading alert history...</Card>
        ) : history.error ? (
          <Card className="p-6 text-sm text-destructive" role="alert">Could not load alerts: {history.error} <Button variant="outline" className="ml-3" onClick={() => void history.load()}>Retry</Button></Card>
        ) : history.alerts.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={Bell} title={history.ageView === "older" ? "No older alerts match." : "No recent alerts match."}
              description={history.ageView === "older" ? "Try another status or severity, or wait for resolved alerts to reach 90 days." : "Try another filter or check back when incidents are recorded."} />
            <div className="mt-4 flex justify-center"><Button variant="outline" onClick={history.clearFilters}>Clear filters</Button></div>
          </Card>
        ) : (
          <section aria-labelledby="admin-alert-timeline-title" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 id="admin-alert-timeline-title" className="text-sm font-semibold tracking-wide">{history.ageView === "older" ? "Older alerts" : "Recent alerts"}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Newest incidents appear first.</p>
              </div>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                {history.total} {history.total === 1 ? "incident" : "incidents"}
              </span>
            </div>
            {history.alerts.map(alert => (
              <AlertIncidentCard key={alert.id} alert={alert} pondName={alert.pond_profiles?.name ?? "Pond unavailable"}
                showSeverityAccent={false}
                canAcknowledge={history.ageView === "recent"} acknowledging={acknowledgingId === alert.id}
                onAcknowledge={() => void acknowledge(alert.id)} />
            ))}
            <AlertPagination page={history.page} total={history.total} onPageChange={history.setPage} />
          </section>
        )}
      </div>
    </AppShell>
  );
};

export default AlertHistory;
