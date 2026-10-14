import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Database, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isSensorOffline, SENSOR_OFFLINE_AFTER_MINUTES } from "@/lib/sensor-status";
import type { Tables } from "@/integrations/supabase/types";

type ReadingWithPond = Tables<"sensor_readings"> & { pond_profiles: Pick<Tables<"pond_profiles">, "name"> | null };
type SensorStatusWithPond = Tables<"sensor_status"> & { pond_profiles: Pick<Tables<"pond_profiles">, "name"> | null };
type PondOption = Pick<Tables<"pond_profiles">, "id" | "name">;

const Sensors = () => {
  const [readings, setReadings] = useState<ReadingWithPond[]>([]);
  const [statuses, setStatuses] = useState<SensorStatusWithPond[]>([]);
  const [ponds, setPonds] = useState<PondOption[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pond_id: "", do_mg_l: "", ph: "", temperature_c: "", turbidity_ntu: "" });
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const load = async () => {
    const [r, s, p] = await Promise.all([
      supabase.from("sensor_readings").select("*, pond_profiles(name)").order("recorded_at", { ascending: false }).limit(100),
      supabase.from("sensor_status").select("*, pond_profiles(name)").order("updated_at", { ascending: false }),
      supabase.from("pond_profiles").select("id, name"),
    ]);
    setReadings(r.data ?? []); setStatuses(s.data ?? []); setPonds(p.data ?? []);
  };
  useEffect(() => {
    load();
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    const statusChannel = supabase
      .channel("admin-sensor-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "sensor_status" }, load)
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(statusChannel);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("sensor_readings").insert({
      pond_id: form.pond_id || null,
      do_mg_l: form.do_mg_l ? +form.do_mg_l : null,
      ph: form.ph ? +form.ph : null,
      temperature_c: form.temperature_c ? +form.temperature_c : null,
      turbidity_ntu: form.turbidity_ntu ? +form.turbidity_ntu : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Reading recorded"); setOpen(false); setForm({ pond_id: "", do_mg_l: "", ph: "", temperature_c: "", turbidity_ntu: "" }); load();
  };

  return (
    <AppShell admin>
      <PageHeader title="Sensors" subtitle="Raw readings, sensor status and connectivity logs."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-aqua text-white border-0"><Plus className="h-4 w-4 mr-2" />New reading</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record sensor reading</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Pond</Label>
                  <Select value={form.pond_id} onValueChange={v => setForm({ ...form, pond_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select pond" /></SelectTrigger>
                    <SelectContent>{ponds.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>DO (mg/L)</Label><Input type="number" step="0.01" value={form.do_mg_l} onChange={e => setForm({ ...form, do_mg_l: e.target.value })} /></div>
                  <div><Label>pH</Label><Input type="number" step="0.01" value={form.ph} onChange={e => setForm({ ...form, ph: e.target.value })} /></div>
                  <div><Label>Temp (°C)</Label><Input type="number" step="0.01" value={form.temperature_c} onChange={e => setForm({ ...form, temperature_c: e.target.value })} /></div>
                  <div><Label>Turbidity (NTU)</Label><Input type="number" step="0.01" value={form.turbidity_ntu} onChange={e => setForm({ ...form, turbidity_ntu: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-6 p-4 sm:p-6">
        <h3 className="font-semibold mb-4">Sensor connectivity</h3>
        <p className="-mt-2 mb-4 text-xs text-muted-foreground">
          Sensors with no sync for {SENSOR_OFFLINE_AFTER_MINUTES} minutes are marked offline.
        </p>
        {statuses.length === 0 ? (
          <EmptyState icon={Database} title="No sensor status registered yet." />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {statuses.map(s => {
              const offline = s.status !== "online" || isSensorOffline(s.last_sync, currentTime);
              return (
                <div key={s.id} className="p-4 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.sensor_type}</div>
                    <Badge variant={offline ? "destructive" : "default"} className="text-[10px]">{offline ? "offline" : "online"}</Badge>
                  </div>
                  <div className="text-sm font-medium mt-1">{s.pond_profiles?.name ?? "—"}</div>
                  {s.last_sync
                    ? <div className="text-xs text-muted-foreground mt-1 font-mono">{format(new Date(s.last_sync), "MMM d HH:mm")}</div>
                    : <div className="text-xs text-muted-foreground mt-1">Never synced</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4">Raw sensor logs</h3>
        {readings.length === 0 ? (
          <EmptyState icon={Database} title="No sensor readings available yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Time</th><th className="pr-4">Pond</th><th className="pr-4 font-mono">DO</th><th className="pr-4 font-mono">pH</th><th className="pr-4 font-mono">Temp</th><th className="font-mono">Turb</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {readings.map(r => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4 font-mono text-xs">{format(new Date(r.recorded_at), "MMM d HH:mm")}</td>
                    <td className="pr-4">{r.pond_profiles?.name ?? "—"}</td>
                    <td className="pr-4 font-mono">{r.do_mg_l ?? "—"}</td>
                    <td className="pr-4 font-mono">{r.ph ?? "—"}</td>
                    <td className="pr-4 font-mono">{r.temperature_c ?? "—"}</td>
                    <td className="font-mono">{r.turbidity_ntu ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
};
export default Sensors;
