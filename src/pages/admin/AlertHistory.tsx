import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

const AlertHistory = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const load = () => supabase.from("alerts").select("*, pond_profiles(name)").order("created_at", { ascending: false }).then(({ data }) => setAlerts(data ?? []));
  useEffect(() => { load(); }, []);
  const ack = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ acknowledged: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Acknowledged"); load();
  };
  return (
    <AppShell admin>
      <PageHeader title="Alert History" subtitle="Full log of system notifications." />
      {alerts.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Bell} title="No alerts recorded." /></Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <Card key={a.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4">
              <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">{a.severity}</Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.message}</div>
                <div className="text-xs text-muted-foreground font-mono">{format(new Date(a.created_at), "MMM d HH:mm")} · {a.pond_profiles?.name ?? "—"}</div>
              </div>
              {!a.acknowledged && <Button size="sm" variant="outline" onClick={() => ack(a.id)}>Acknowledge</Button>}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
export default AlertHistory;
