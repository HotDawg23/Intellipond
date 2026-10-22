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
import { useAuth } from "@/contexts/AuthContext";
import { useAlertHistory } from "@/hooks/useAlertHistory";
import { supabase } from "@/integrations/supabase/client";

const Alerts = () => {
  const { role, approved } = useAuth();
  const history = useAlertHistory(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const canAcknowledge = role === "admin" || (role === "operator" && approved);

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
    <AppShell>
      <PageHeader title="Alerts & Recommendations" subtitle="Current incidents and retained alert history." />
      <div className="space-y-5">
        <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm sm:p-5">
          <AlertListFilters ageView={history.ageView} onAgeViewChange={history.changeAgeView}
            severity={history.severity} onSeverityChange={history.changeSeverity}
            dateRange={history.dateRange} onDateRangeChange={history.changeDateRange} />
        </Card>
        {history.loading ? (
          <Card className="p-6 text-sm text-muted-foreground" role="status">Loading alerts...</Card>
        ) : history.error ? (
          <Card className="p-6 text-sm text-destructive" role="alert">Could not load alerts: {history.error} <Button variant="outline" className="ml-3" onClick={() => void history.load()}>Retry</Button></Card>
        ) : history.alerts.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={Bell} title={history.ageView === "older" ? "No older alerts match." : "No recent alerts match."}
              description={history.ageView === "older" ? "Older resolved and legacy alerts will appear here after 90 days." : "New alerts and active incidents will appear here."} />
            <div className="mt-4 flex justify-center"><Button variant="outline" onClick={history.clearFilters}>Clear filters</Button></div>
          </Card>
        ) : (
          <section aria-label="Incident timeline" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">{history.ageView === "older" ? "Older alerts" : "Recent alerts"}</h2>
              <span className="text-xs text-muted-foreground">{history.total} {history.total === 1 ? "incident" : "incidents"}</span>
            </div>
            {history.alerts.map(alert => (
              <AlertIncidentCard key={alert.id} alert={alert} canAcknowledge={canAcknowledge && history.ageView === "recent"}
                acknowledging={acknowledgingId === alert.id} useCoolveticaForStatus useBitcountGridForReading
                onAcknowledge={() => void acknowledge(alert.id)} />
            ))}
            <AlertPagination page={history.page} total={history.total} onPageChange={history.setPage} />
          </section>
        )}
      </div>
    </AppShell>
  );
};

export default Alerts;
