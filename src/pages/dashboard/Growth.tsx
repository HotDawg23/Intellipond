import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowUpRight, Fish, Ruler, Weight } from "lucide-react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  estimateGrowth, growthForecastWindow, latestGrowthBaseline,
  type GrowthBaseline, type GrowthMetricModel, type GrowthObservation, type GrowthReferenceModel,
} from "@/lib/growth-forecast";
import { formatStockingDensity } from "@/lib/stocking-density";
import { useAuth } from "@/contexts/AuthContext";

type FishBatch = {
  id: string;
  pond_id: string;
  batch_name: string;
  stocking_date: string;
  stocked_fish_count: number | null;
  initial_weight_g: number | null;
  initial_length_cm: number | null;
  pond_profiles?: { name: string; area_sqm: number | null } | null;
};

type GrowthRecord = GrowthObservation & {
  id: string;
  pond_id: string | null;
  age_days: number | null;
  growth_status: string | null;
};

const formatDate = (date: string) => format(new Date(`${date.slice(0, 10)}T00:00:00`), "MMM d, yyyy");

const Growth = () => {
  const { role } = useAuth();
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [batches, setBatches] = useState<FishBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [model, setModel] = useState<GrowthReferenceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("bangus_growth_records")
        .select("id,fish_batch_id,pond_id,age_days,avg_weight_g,avg_length_cm,recorded_at,growth_status")
        .order("recorded_at", { ascending: true }),
      supabase.from("fish_batches")
        .select("id,pond_id,batch_name,stocking_date,stocked_fish_count,initial_weight_g,initial_length_cm,is_active,pond_profiles(name,area_sqm)")
        .eq("is_active", true)
        .order("stocking_date", { ascending: false }),
      fetch(`${import.meta.env.BASE_URL}growth-model.json`).then(async response => {
        if (!response.ok) throw new Error("Growth reference model could not be loaded.");
        return response.json() as Promise<GrowthReferenceModel>;
      }).catch(() => null),
    ]).then(([growthResult, batchResult, loadedModel]) => {
      if (!mounted) return;
      if (growthResult.error) throw growthResult.error;
      if (batchResult.error) throw batchResult.error;
      setRecords(growthResult.data ?? []);
      setBatches((batchResult.data ?? []) as unknown as FishBatch[]);
      setModel(loadedModel);
      if (!loadedModel) setError("Growth reference model could not be loaded. Recorded measurements are still available.");
    }).catch(loadError => {
      if (mounted) {
        setDataError(true);
        setError(loadError?.message ?? "Could not load growth forecasts.");
      }
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const selectedBatch = batches.find(batch => batch.id === selectedBatchId) ?? batches[0];
  const batchRecords = useMemo(() => records
    .filter(record => record.fish_batch_id === selectedBatch?.id)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)), [records, selectedBatch?.id]);
  const weightBaseline = selectedBatch && latestGrowthBaseline(batchRecords, selectedBatch.id, "avg_weight_g", selectedBatch.stocking_date, selectedBatch.initial_weight_g);
  const lengthBaseline = selectedBatch && latestGrowthBaseline(batchRecords, selectedBatch.id, "avg_length_cm", selectedBatch.stocking_date, selectedBatch.initial_length_cm);
  const density = selectedBatch && formatStockingDensity(selectedBatch.stocked_fish_count, selectedBatch.pond_profiles?.area_sqm);
  const validatedOnBfar = model?.seven_day_validation.status === "validated";

  return (
    <AppShell>
      <PageHeader title="Growth Monitoring" subtitle="Follow measured Bangus growth and a seven-day research estimate." />
      {error && <Card className="mb-5 border-destructive/40 p-4 text-sm text-destructive-text" role="alert">{error}</Card>}
      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status">Loading growth records…</Card>
      ) : dataError ? null : batches.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Fish} title="No active fish batch yet" description="An administrator can add a batch and its starting measurement in Growth Records." />
          {role === "admin" && <div className="mt-4 text-center"><Button asChild><Link to="/admin/growth">Set up a fish batch</Link></Button></div>}
        </Card>
      ) : selectedBatch && (
        <div className="space-y-5">
          <section aria-labelledby="batch-heading" className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 id="batch-heading" className="text-xl font-semibold">Current batch</h2><p className="mt-1 text-sm text-muted-foreground">Choose a batch to see only its own measurements and estimate.</p></div>
            <div className="w-full sm:w-72">
              <label htmlFor="growth-batch" className="mb-1 block text-sm font-medium">Fish batch</label>
              <Select value={selectedBatch.id} onValueChange={setSelectedBatchId}>
                <SelectTrigger id="growth-batch"><SelectValue /></SelectTrigger>
                <SelectContent>{batches.map(batch => <SelectItem key={batch.id} value={batch.id}>{batch.batch_name} · {batch.pond_profiles?.name ?? "Pond"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </section>
          <Card className="overflow-hidden p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{selectedBatch.batch_name}</p>
                <h3 className="mt-1 text-xl font-semibold">{model?.target_horizon_days ?? 7}-day growth estimate</h3>
                <p className="mt-1 text-sm text-muted-foreground">Projected averages from the latest measurements · {selectedBatch.pond_profiles?.name ?? "Pond"} · stocked {formatDate(selectedBatch.stocking_date)}</p>
              </div>
              <Badge variant="outline" className={validatedOnBfar ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"}>
                {!model ? "Estimate unavailable" : validatedOnBfar ? "Checked on BFAR batches" : "Research estimate"}
              </Badge>
            </div>
            <div className="grid gap-4 py-5 md:grid-cols-2">
              <GrowthMetric label="Average weight" unit="g" icon={Weight} baseline={weightBaseline ?? null} metricModel={model?.outputs.avg_weight_g ?? null} horizonDays={model?.target_horizon_days ?? 7} />
              <GrowthMetric label="Average length" unit="cm" icon={Ruler} baseline={lengthBaseline ?? null} metricModel={model?.outputs.avg_length_cm ?? null} horizonDays={model?.target_horizon_days ?? 7} />
            </div>
            <details className="rounded-xl bg-muted/40 p-4 text-sm">
              <summary className="cursor-pointer font-medium">About this estimate and batch</summary>
              <div className="mt-3 space-y-2 text-muted-foreground">
                <p>This estimate starts from the latest recorded value for each measure. Its reference range shows spread in observed growth rates, not a confidence interval or a promise of accuracy.</p>
                <p>{validatedOnBfar ? "The model passed the held-out BFAR comparison for weight and length." : "Seven-day accuracy has not been validated on BFAR batches."}</p>
                <p>{selectedBatch.stocked_fish_count?.toLocaleString() ?? "No"} fish recorded at stocking · initial density {density ?? "unavailable"}. Density uses the pond area and stocked count, not surviving fish.</p>
                {model?.sources[0] && <a className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" href={model.sources[0].url} target="_blank" rel="noreferrer">Source: {model.sources[0].publisher} {model.sources[0].year}<ArrowUpRight className="h-3.5 w-3.5" /></a>}
              </div>
            </details>
          </Card>
          <section aria-labelledby="growth-history-heading">
            <div className="mb-3"><h2 id="growth-history-heading" className="text-lg font-semibold">Measured growth</h2><p className="text-sm text-muted-foreground">These charts show actual samples from {selectedBatch.batch_name}, without the predicted values. Each chart has its own unit.</p></div>
            {batchRecords.length === 0 ? <Card className="p-5 text-sm text-muted-foreground">No follow-up measurements yet. The starting measurements above are from stocking.</Card> : (
              <div className="grid gap-4 lg:grid-cols-2">
                <HistoryChart title="Average weight" unit="g" dataKey="avg_weight_g" records={batchRecords} />
                <HistoryChart title="Average length" unit="cm" dataKey="avg_length_cm" records={batchRecords} />
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
};

function GrowthMetric({ label, unit, icon: Icon, baseline, metricModel, horizonDays }: {
  label: string; unit: string; icon: typeof Weight; baseline: GrowthBaseline | null; metricModel: GrowthMetricModel | null; horizonDays: number;
}) {
  const window = growthForecastWindow(baseline, new Date(), horizonDays);
  const estimate = window.isFresh && metricModel ? estimateGrowth(baseline?.value, metricModel, horizonDays) : null;
  return <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-primary" />{label}</div>
    {baseline ? <>
      {estimate && window.targetDate ? <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm font-medium text-primary">Estimate for {formatDate(window.targetDate)}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{estimate.expected.toFixed(2)} <span className="text-lg font-normal">{unit}</span></p>
        <p className="mt-2 text-xs text-muted-foreground">Reference range: {estimate.low.toFixed(2)}–{estimate.high.toFixed(2)} {unit}</p>
      </div> : <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground" role="status">
        {!metricModel ? "Estimate unavailable; the recorded value is still shown." : window.ageDays != null && window.ageDays > horizonDays ? "New measurement needed for a forward estimate." : "Check the measurement date before forecasting."}
      </p>}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
        <div><p className="text-xs text-muted-foreground">Last actual value</p><p className="text-xl font-semibold tabular-nums">{baseline.value.toFixed(2)} <span className="text-sm font-normal">{unit}</span></p></div>
        <p className="text-xs text-muted-foreground">{baseline.source === "sample" ? "Sampled" : "At stocking"} {formatDate(baseline.date)}</p>
      </div>
    </> : <p className="mt-4 text-sm text-muted-foreground">Add a starting or sampled {label.toLowerCase()} to see an estimate.</p>}
  </div>;
}

function HistoryChart({ title, unit, dataKey, records }: { title: string; unit: string; dataKey: "avg_weight_g" | "avg_length_cm"; records: GrowthRecord[] }) {
  const data = records.filter(record => record[dataKey] != null).map(record => ({ date: formatDate(record.recorded_at), value: record[dataKey] }));
  return <Card className="p-4 sm:p-5">
    <h3 className="font-semibold">{title} ({unit})</h3>
    {data.length ? <>
      <div className="mt-4 h-64" role="img" aria-label={`${title} trend in ${unit} for this batch`}>
        <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis width={48} stroke="hsl(var(--muted-foreground))" fontSize={11} unit={unit} />
        <Tooltip formatter={(value: number) => [`${value} ${unit}`, title]} contentStyle={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div>
      <ul className="sr-only" aria-label={`${title} sample values`}>
        {data.map((sample, index) => <li key={`${sample.date}-${index}`}>{sample.date}: {sample.value} {unit}</li>)}
      </ul>
    </> : <p className="mt-4 text-sm text-muted-foreground">No {title.toLowerCase()} samples for this batch yet.</p>}
  </Card>;
}

export default Growth;
