import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState, LoadingState, LoadError } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Waves } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type ReadingWithPond = Tables<"sensor_readings"> & { pond_profiles: Pick<Tables<"pond_profiles">, "name"> | null };
type PondOption = Pick<Tables<"pond_profiles">, "id" | "name">;

const Sensors = () => {
  const [readings, setReadings] = useState<ReadingWithPond[]>([]);
  const [ponds, setPonds] = useState<PondOption[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pond_id: "", do_mg_l: "", ph: "", temperature_c: "", turbidity_ntu: "" });

  const load = async () => {
    setLoadError("");
    try {
      const [r, p] = await Promise.all([
        supabase.from("sensor_readings").select("*, pond_profiles(name)").order("recorded_at", { ascending: false }).limit(100),
        supabase.from("pond_profiles").select("id, name"),
      ]);
      if (r.error) throw r.error;
      if (p.error) throw p.error;
      setReadings(r.data ?? []); setPonds(p.data ?? []);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load sensor readings: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  useEffect(() => {
    void load();
    const readingsChannel = supabase
      .channel("admin-sensor-readings")
      .on("postgres_changes", { event: "*", schema: "public", table: "sensor_readings" }, () => { void load(); })
      .subscribe();

    return () => {
      void supabase.removeChannel(readingsChannel);
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
    toast.success("Reading recorded"); setOpen(false); setForm({ pond_id: "", do_mg_l: "", ph: "", temperature_c: "", turbidity_ntu: "" }); void load();
  };

  return (
    <AppShell admin>
      <PageHeader title="Sensor Readings" subtitle="Review water quality measurements and record new samples."
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

      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-muted/30 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              <Waves className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold tracking-tight">Recent readings</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Latest water quality measurements across your ponds.</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-border bg-background/80 text-muted-foreground">
            {!hasLoaded ? "—" : readings.length === 100 ? "Latest 100" : `${readings.length} ${readings.length === 1 ? "reading" : "readings"}`}
          </Badge>
        </div>
        {loadError && <div className="p-4 sm:p-5"><LoadError message={loadError} onRetry={() => void load()} /></div>}
        {!hasLoaded ? (
          loadError ? null : <LoadingState label="Loading sensor readings" />
        ) : readings.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState icon={Database} title="No sensor readings available yet." description="Record a reading to start building your water quality history." />
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {readings.map(reading => (
                <article key={reading.id} className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <time dateTime={reading.recorded_at} className="font-semibold">{format(new Date(reading.recorded_at), "MMM d, yyyy")}</time>
                      <div className="mt-0.5 text-xs text-muted-foreground">{format(new Date(reading.recorded_at), "HH:mm")}</div>
                    </div>
                    <Badge variant="outline" className="max-w-[55%] truncate bg-muted/40 text-muted-foreground">
                      {reading.pond_profiles?.name ?? "Pond unavailable"}
                    </Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { label: "Dissolved oxygen", value: reading.do_mg_l, unit: "mg/L" },
                      { label: "pH", value: reading.ph, unit: "" },
                      { label: "Temperature", value: reading.temperature_c, unit: "°C" },
                      { label: "Turbidity", value: reading.turbidity_ntu, unit: "NTU" },
                    ].map(metric => (
                      <div key={metric.label} className="rounded-lg bg-muted/40 p-3">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
                        <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                          {metric.value == null ? "—" : `${metric.value.toFixed(2)}${metric.unit ? ` ${metric.unit}` : ""}`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[64rem] table-fixed text-sm">
                <caption className="sr-only">Recent water quality measurements by pond and time.</caption>
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[13%]" />
                  <col className="w-[16.25%]" />
                  <col className="w-[16.25%]" />
                  <col className="w-[16.25%]" />
                  <col className="w-[16.25%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Pond</th>
                    <th scope="col" className="px-4 py-3 text-right font-mono">DO (mg/L)</th>
                    <th scope="col" className="px-4 py-3 text-right font-mono">pH</th>
                    <th scope="col" className="px-4 py-3 text-right font-mono">Temperature (°C)</th>
                    <th scope="col" className="px-4 py-3 text-right font-mono">Turbidity (NTU)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {readings.map(reading => (
                    <tr key={reading.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        <time dateTime={reading.recorded_at}>{format(new Date(reading.recorded_at), "MMM d, yyyy · HH:mm")}</time>
                      </td>
                      <td className="px-4 py-3 font-medium">{reading.pond_profiles?.name ?? "Pond unavailable"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{reading.do_mg_l?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{reading.ph?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{reading.temperature_c == null ? "—" : `${reading.temperature_c.toFixed(2)} °C`}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{reading.turbidity_ntu == null ? "—" : `${reading.turbidity_ntu.toFixed(2)} NTU`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
};
export default Sensors;
