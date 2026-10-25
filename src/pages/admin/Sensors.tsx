import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState, LoadingState, LoadError } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Database, Plus, Waves } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type ReadingWithPond = Tables<"sensor_readings"> & { pond_profiles: Pick<Tables<"pond_profiles">, "name"> | null };
type PondOption = Pick<Tables<"pond_profiles">, "id" | "name">;
type DateOrder = "newest" | "oldest";
const PAGE_SIZE = 20;

const Sensors = () => {
  const [readings, setReadings] = useState<ReadingWithPond[]>([]);
  const [ponds, setPonds] = useState<PondOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [dateOrder, setDateOrder] = useState<DateOrder>("newest");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pond_id: "", do_mg_l: "", ph: "", temperature_c: "", turbidity_ntu: "" });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoadError("");
    try {
      let query = supabase.from("sensor_readings").select("*, pond_profiles(name)", { count: "exact" });
      let startIso: string | undefined;
      let endIso: string | undefined;
      if (selectedDate) {
        // Match the local calendar date used when displaying each reading.
        const start = new Date(`${selectedDate}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        startIso = start.toISOString();
        endIso = end.toISOString();
        query = query.gte("recorded_at", startIso).lt("recorded_at", endIso);
      }
      const [r, p] = await Promise.all([
        query.order("recorded_at", { ascending: dateOrder === "oldest" })
          .order("id", { ascending: dateOrder === "oldest" })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
        supabase.from("pond_profiles").select("id, name"),
      ]);
      if (currentRequest !== requestId.current) return;
      if (p.error) throw p.error;
      if (r.error) {
        if (r.error.code === "PGRST103" && page > 0) {
          let countQuery = supabase.from("sensor_readings").select("id", { count: "exact", head: true });
          if (startIso && endIso) countQuery = countQuery.gte("recorded_at", startIso).lt("recorded_at", endIso);
          const { count, error } = await countQuery;
          if (currentRequest !== requestId.current) return;
          if (error) throw error;
          const lastPage = Math.max(0, Math.ceil((count ?? 0) / PAGE_SIZE) - 1);
          if (page > lastPage) {
            setHasLoaded(false);
            setPage(lastPage);
            return;
          }
        }
        throw r.error;
      }
      const lastPage = Math.max(0, Math.ceil((r.count ?? 0) / PAGE_SIZE) - 1);
      if (page > lastPage) {
        setHasLoaded(false);
        setPage(lastPage);
        return;
      }
      setReadings(r.data ?? []); setTotal(r.count ?? 0); setPonds(p.data ?? []);
      setHasLoaded(true);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setLoadError(`Could not load sensor readings: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [dateOrder, page, selectedDate]);
  useEffect(() => {
    const activeRequest = requestId;
    void load();
    const readingsChannel = supabase
      .channel("admin-sensor-readings")
      .on("postgres_changes", { event: "*", schema: "public", table: "sensor_readings" }, () => { void load(); })
      .subscribe();

    return () => {
      activeRequest.current++;
      void supabase.removeChannel(readingsChannel);
    };
  }, [load]);

  const changePage = (nextPage: number) => {
    setHasLoaded(false);
    setPage(nextPage);
  };

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
              <h2 className="font-semibold tracking-tight">Sensor readings</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Water quality measurements across your ponds.</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-border bg-background/80 text-muted-foreground">
            {!hasLoaded ? "—" : `${total} ${total === 1 ? "reading" : "readings"}`}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="w-full sm:w-52">
            <Label htmlFor="reading-date" className="mb-1.5 block text-xs text-muted-foreground">Date</Label>
            <Input id="reading-date" type="date" value={selectedDate} onChange={event => {
              setHasLoaded(false);
              setPage(0);
              setSelectedDate(event.target.value);
            }} />
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="reading-date-order" className="mb-1.5 block text-xs text-muted-foreground">Sort by date</Label>
            <Select value={dateOrder} onValueChange={(value: DateOrder) => {
              setHasLoaded(false);
              setPage(0);
              setDateOrder(value);
            }}>
              <SelectTrigger id="reading-date-order"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedDate && <Button variant="ghost" type="button" className="w-fit" onClick={() => {
            setHasLoaded(false);
            setPage(0);
            setSelectedDate("");
          }}>Clear date</Button>}
        </div>
        {loadError && <div className="p-4 sm:p-5"><LoadError message={loadError} onRetry={() => void load()} /></div>}
        {!hasLoaded ? (
          loadError ? null : <LoadingState label="Loading sensor readings" />
        ) : readings.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState icon={Database} title={selectedDate ? "No readings for this date." : "No sensor readings available yet."}
              description={selectedDate ? "Choose another date or clear the date filter." : "Record a reading to start building your water quality history."} />
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
            {total > PAGE_SIZE && (
              <nav aria-label="Sensor reading pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2 text-sm text-muted-foreground sm:px-5">
                <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
                <div className="flex items-center gap-2">
                  <span>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                  <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent]" aria-label="Previous readings page" disabled={page === 0} onClick={() => changePage(page - 1)}><ArrowLeft aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent]" aria-label="Next readings page" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => changePage(page + 1)}><ArrowRight aria-hidden="true" /></Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>
    </AppShell>
  );
};
export default Sensors;
