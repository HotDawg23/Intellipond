import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import AlertIncidentCard from "@/components/AlertIncidentCard";
import AlertListFilters from "@/components/AlertListFilters";
import { EmptyState, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRecord } from "@/lib/alerts";
import { isAlertWithinDateRange, type AlertDateRangeFilter, type AlertSeverityFilter } from "@/lib/alertFilters";

const Alerts = () => {
  const { role, approved } = useAuth();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>("all");
  const [dateRange, setDateRange] = useState<AlertDateRangeFilter>("all");
  const canAcknowledge = role === "admin" || (role === "operator" && approved);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Could not load alerts", { description: error.message });
    else setAlerts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("alerts-operator")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const acknowledge = async (id: string) => {
    setAcknowledgingId(id);
    const { data, error } = await supabase.from("alerts")
      .update({ acknowledged: true })
      .eq("id", id)
      .eq("status", "active")
      .eq("acknowledged", false)
      .select("*")
      .maybeSingle();
    setAcknowledgingId(null);
    if (error) return toast.error("Could not acknowledge alert", { description: error.message });
    if (!data) return toast.info("This incident was already acknowledged or is no longer active.");
    setAlerts(current => current.map(alert => alert.id === id ? data : alert));
    toast.success("Alert acknowledged");
  };

  const dateFilteredAlerts = alerts.filter(alert => isAlertWithinDateRange(alert.created_at, dateRange));
  const filteredAlerts = dateFilteredAlerts.filter(alert => severityFilter === "all" || alert.severity === severityFilter);

  const clearFilters = () => {
    setSeverityFilter("all");
    setDateRange("all");
  };

  return (
    <AppShell>
      <PageHeader title="Alerts & Recommendations" subtitle="Current and past incidents for pond conditions." />
      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status">Loading alerts...</Card>
      ) : alerts.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Bell} title="No alerts yet." description="You'll be notified here when pond conditions need attention." />
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="border-border/70 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm sm:p-5">
            <AlertListFilters
              severity={severityFilter}
              onSeverityChange={setSeverityFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </Card>
          {filteredAlerts.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={Bell} title="No alerts match these filters." description="Try a different severity or date range." />
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">Incident timeline</h2>
                <span className="text-xs text-muted-foreground">{filteredAlerts.length} {filteredAlerts.length === 1 ? "incident" : "incidents"}</span>
              </div>
              <div className="space-y-3">
                {filteredAlerts.map(alert => (
                  <AlertIncidentCard
                    key={alert.id}
                    alert={alert}
                    canAcknowledge={canAcknowledge}
                    acknowledging={acknowledgingId === alert.id}
                    useCoolveticaForStatus
                    useBitcountGridForReading
                    onAcknowledge={() => void acknowledge(alert.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
};

export default Alerts;
