import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { summarizeMortality, type MortalityLog } from "@/lib/mortality";
import { estimateNextVisitMortality, type MortalityResearchModel } from "@/lib/mortality-forecast";
import { toast } from "sonner";

type Batch = {
  id: string;
  pond_id: string;
  batch_name: string;
  stocking_date: string;
  stocked_fish_count: number | null;
  is_active: boolean;
};

const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const initialForm = () => ({ observed_on: today(), dead_count: "0", transferred_in_count: "0", transferred_out_count: "0", notes: "" });

export function BatchMortalityRecords({ batches, canEdit }: { batches: Batch[]; canEdit: boolean }) {
  const [selectedId, setSelectedId] = useState("");
  const [logs, setLogs] = useState<MortalityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState<MortalityResearchModel | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [readingLoading, setReadingLoading] = useState(false);
  const [latestReading, setLatestReading] = useState<{
    pond_id: string; recorded_at: string; do_mg_l: number | null; ph: number | null; temperature_c: number | null;
  } | null>(null);
  const [form, setForm] = useState(initialForm);
  const batch = batches.find(item => item.id === selectedId) ?? batches[0];
  const batchId = batch?.id;

  useEffect(() => {
    if (!batch?.is_active) return;
    let active = true;
    fetch(`${import.meta.env.BASE_URL}mortality-model.json`)
      .then(response => {
        if (!response.ok) throw new Error("Mortality model unavailable");
        return response.json() as Promise<MortalityResearchModel>;
      })
      .then(loaded => { if (active) setModel(loaded); })
      .catch(() => { if (active) setModel(null); })
      .finally(() => { if (active) setModelLoading(false); });
    return () => { active = false; };
  }, [batch?.is_active]);

  useEffect(() => {
    if (!batch?.is_active || !batch.pond_id) return;
    let active = true;
    setLatestReading(null);
    setReadingLoading(true);
    supabase.from("sensor_readings")
      .select("recorded_at,do_mg_l,ph,temperature_c")
      .eq("pond_id", batch.pond_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .then(({ data, error: readingError }) => {
        if (active) {
          setLatestReading(readingError || !data?.[0] ? null : { ...data[0], pond_id: batch.pond_id });
          setReadingLoading(false);
        }
      });
    return () => { active = false; };
  }, [batch?.is_active, batch?.pond_id]);

  useEffect(() => {
    if (!batchId) return;
    let active = true;
    setLoading(true);
    setError("");
    setLogs([]);
    supabase.from("batch_mortality_logs").select("*").eq("fish_batch_id", batchId).order("observed_on", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(`Could not load mortality records: ${loadError.message}`);
        else setLogs(data ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [batchId]);

  if (!batch) return null;

  const days = summarizeMortality(logs, batch.stocked_fish_count).reverse();
  const cumulativeDeaths = logs.reduce((sum, log) => sum + log.dead_count, 0);
  const latestDay = days[0]?.log.fish_batch_id === batch.id ? days[0] : null;
  const latestLog = latestDay?.log;
  const readingTime = latestReading ? Date.parse(latestReading.recorded_at) : NaN;
  const readingIsFresh = Number.isFinite(readingTime) &&
    Date.now() >= readingTime && Date.now() - readingTime <= 24 * 60 * 60 * 1000;
  const logTime = latestLog ? Date.parse(`${latestLog.observed_on}T00:00:00`) : NaN;
  const logIsRecent = Number.isFinite(logTime) && Date.now() >= logTime &&
    Date.now() - logTime <= 48 * 60 * 60 * 1000;
  const sameObservationDay = latestLog && Number.isFinite(readingTime) &&
    latestLog.observed_on === format(new Date(readingTime), "yyyy-MM-dd");
  const estimate = batch.is_active && !loading && !error && model && readingIsFresh && logIsRecent && sameObservationDay &&
    latestReading?.pond_id === batch.pond_id && latestLog?.fish_batch_id === batch.id &&
    latestReading?.do_mg_l != null && latestReading.ph != null && latestReading.temperature_c != null && latestLog
    ? estimateNextVisitMortality(model, {
      do_mg_l: latestReading.do_mg_l,
      ph: latestReading.ph,
      temperature_c: latestReading.temperature_c,
      previous_dead: latestLog.dead_count,
    }) : null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    const counts = [form.dead_count, form.transferred_in_count, form.transferred_out_count].map(Number);
    if (counts.some(count => !Number.isSafeInteger(count) || count < 0)) return toast.error("Enter whole numbers of zero or more.");
    if (form.observed_on < batch.stocking_date || form.observed_on > today()) return toast.error("Date must be between stocking and today.");
    const existing = logs.find(log => log.observed_on === form.observed_on);
    const proposed: MortalityLog = {
      id: existing?.id ?? "new", fish_batch_id: batch.id, observed_on: form.observed_on,
      dead_count: counts[0], transferred_in_count: counts[1], transferred_out_count: counts[2],
      notes: form.notes.trim() || null, created_at: existing?.created_at ?? new Date().toISOString(),
    };
    const next = [...logs.filter(log => log.observed_on !== form.observed_on), proposed];
    if (batch.stocked_fish_count != null && summarizeMortality(next, batch.stocked_fish_count).some(day => day.fishRemaining == null)) {
      return toast.error("Deaths and transfers out exceed the fish remaining in this batch.");
    }
    setSaving(true);
    const { error: saveError } = await supabase.from("batch_mortality_logs").upsert({
      fish_batch_id: batch.id, observed_on: form.observed_on,
      dead_count: counts[0], transferred_in_count: counts[1], transferred_out_count: counts[2],
      notes: form.notes.trim() || null,
    }, { onConflict: "fish_batch_id,observed_on" });
    if (saveError) {
      setSaving(false);
      return toast.error(`Could not save mortality record: ${saveError.message}`);
    }
    const { data, error: loadError } = await supabase.from("batch_mortality_logs").select("*").eq("fish_batch_id", batch.id).order("observed_on", { ascending: false });
    setSaving(false);
    if (loadError) setError(`Saved, but could not reload records: ${loadError.message}`);
    else { setLogs(data ?? []); setError(""); }
    setForm(initialForm());
    toast.success("Daily mortality record saved");
  };

  return <section aria-labelledby="mortality-heading" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="mortality-heading" className="text-lg font-semibold">Batch mortality</h2>
        <p className="text-sm text-muted-foreground">Daily observed deaths and transfers for each stocking cycle.</p>
      </div>
      {batches.length > 1 && <div className="w-full sm:w-64">
        <Label htmlFor="mortality-batch">Fish batch</Label>
        <Select value={batch.id} onValueChange={setSelectedId}>
          <SelectTrigger id="mortality-batch"><SelectValue /></SelectTrigger>
          <SelectContent>{batches.map(item => <SelectItem key={item.id} value={item.id}>{item.batch_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
    </div>
    <Card className="space-y-4 p-4 sm:p-5">
      {batch.is_active && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        {!loading && latestDay && <div className="mb-3 border-b border-amber-500/20 pb-3">
          <p className="text-muted-foreground">Latest observed mortality · {format(new Date(`${latestDay.log.observed_on}T00:00:00`), "MMM d, yyyy")}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {latestDay.mortalityRate == null ? "Rate unavailable" : `${latestDay.mortalityRate.toFixed(2)}%`}
            <span className="ml-2 text-sm font-normal">· {latestDay.log.dead_count.toLocaleString()} fish found dead</span>
          </p>
        </div>}
        <p className="font-medium">Mortality research estimate · next recorded visit</p>
        <p className="mt-1 font-semibold">{modelLoading || readingLoading || loading ? "Checking estimate…" : estimate === "elevated" ? "Elevated signal" : estimate === "no_signal" && latestLog?.dead_count ? "Review observed mortality" : estimate === "no_signal" ? "No elevated signal detected" : "Estimate unavailable"}</p>
        <p className="mt-1 text-muted-foreground">{estimate == null
          ? modelLoading || readingLoading || loading ? "Loading the model, death records, and latest sensor reading."
            : !model ? "The mortality model could not be loaded. Daily death records remain available."
            : "Record deaths on the same day as a fresh, complete sensor reading to view the estimate."
          : estimate === "no_signal" && latestLog?.dead_count
            ? "Deaths were recorded on the latest day. The experimental model's low signal does not override this observed mortality."
            : "Experimental Random Forest using recent dissolved oxygen, pH, temperature, and logged deaths. This is not a 24-hour forecast; no signal does not rule out future deaths."}</p>
        <p className="mt-1 text-xs text-muted-foreground">The study's visits were typically 24 days apart and mostly involved Rohu and Catla. Its held-out test detected 3 of 72 visits with reported deaths; Bangus performance is unverified. This estimate does not trigger alerts. <a className="underline underline-offset-2" href={model?.source_url ?? "https://github.com/fish-welfare-initiative/fwi-farm-data-india"} target="_blank" rel="noreferrer">Data source</a></p>
      </div>}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <p><span className="text-muted-foreground">Fish stocked:</span> {batch.stocked_fish_count?.toLocaleString() ?? "Not recorded"}</p>
        <p><span className="text-muted-foreground">Deaths logged:</span> {cumulativeDeaths.toLocaleString()}</p>
        <p><span className="text-muted-foreground">Days logged:</span> {logs.length}</p>
      </div>
      {canEdit && <form onSubmit={save} className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium">Record a day, including zero deaths</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><Label htmlFor="mortality-date">Date</Label><Input id="mortality-date" type="date" required min={batch.stocking_date} max={today()} value={form.observed_on} onChange={event => setForm({ ...form, observed_on: event.target.value })} /></div>
          <div><Label htmlFor="mortality-deaths">Fish found dead</Label><Input id="mortality-deaths" type="number" min="0" step="1" required value={form.dead_count} onChange={event => setForm({ ...form, dead_count: event.target.value })} /></div>
          <div><Label htmlFor="mortality-in">Transferred in</Label><Input id="mortality-in" type="number" min="0" step="1" required value={form.transferred_in_count} onChange={event => setForm({ ...form, transferred_in_count: event.target.value })} /></div>
          <div><Label htmlFor="mortality-out">Transferred out</Label><Input id="mortality-out" type="number" min="0" step="1" required value={form.transferred_out_count} onChange={event => setForm({ ...form, transferred_out_count: event.target.value })} /></div>
        </div>
        <div><Label htmlFor="mortality-notes">Notes (optional)</Label><Input id="mortality-notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></div>
        <p className="text-xs text-muted-foreground">Saving a date already recorded for this batch updates that day. Enter transfers on their actual date.</p>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save daily record"}</Button>
      </form>}
      {error && <p role="alert" className="text-sm text-destructive-text">{error}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading mortality records…</p> : days.length === 0 ? <p className="text-sm text-muted-foreground">No daily mortality records for this batch yet.</p> :
        <div className="space-y-2 border-t border-border pt-4">
          {days.map(({ log, mortalityRate, fishRemaining }) => <div key={log.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium">{format(new Date(`${log.observed_on}T00:00:00`), "MMM d, yyyy")}</p>
              <p>{log.dead_count} dead · {mortalityRate == null ? "Rate unavailable" : `${mortalityRate.toFixed(2)}% mortality`}</p>
            </div>
            <p className="mt-1 text-muted-foreground">Transfers: +{log.transferred_in_count} / −{log.transferred_out_count} · Fish remaining: {fishRemaining?.toLocaleString() ?? "Unknown"}</p>
            {log.notes && <p className="mt-1 break-words text-muted-foreground">{log.notes}</p>}
          </div>)}
          <p className="text-xs text-muted-foreground">Daily rate = deaths ÷ fish present after recorded transfers, before deaths. Remaining count assumes all transfers and deaths were logged. No rate is shown without a stocking count.</p>
        </div>}
    </Card>
  </section>;
}
