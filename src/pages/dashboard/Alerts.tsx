import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const Alerts = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    const load = () => supabase.from("alerts").select("*").order("created_at", { ascending: false }).then(({ data }) => setAlerts(data ?? []));
    load();
    const ch = supabase.channel("alerts-u").on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <AppShell>
      <PageHeader title="Alerts & Recommendations" subtitle="Notifications about pond conditions." />
      {alerts.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Bell} title="No alerts yet." description="You'll be notified here when pond conditions need attention." /></Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <Card key={a.id} className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
              <div className={`h-10 w-10 shrink-0 rounded-xl grid place-items-center ${a.severity === "critical" ? "bg-destructive/10 text-destructive" : a.severity === "warning" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"}`}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{a.category}</Badge>
                  <Badge className="text-[10px] uppercase border-0" variant={a.severity === "critical" ? "destructive" : "secondary"}>{a.severity}</Badge>
                  {a.acknowledged && <Badge variant="outline" className="text-[10px]">Acknowledged</Badge>}
                </div>
                <div className="break-words font-medium">{a.message}</div>
                {a.recommendation && <div className="mt-1 break-words text-sm text-muted-foreground">Recommendation: {a.recommendation}</div>}
                <div className="text-xs text-muted-foreground mt-2 font-mono">{format(new Date(a.created_at), "MMM d, yyyy · HH:mm")}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
export default Alerts;
