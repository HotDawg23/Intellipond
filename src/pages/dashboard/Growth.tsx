import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format } from "date-fns";
import { AlertTriangle, ArrowUpRight, BadgeCheck, Fish, Ruler, Weight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { daysSinceStocking, estimateGrowth, type GrowthReferenceModel } from "@/lib/growth-forecast";
import { formatStockingDensity } from "@/lib/stocking-density";
import { useAuth } from "@/contexts/AuthContext";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

type GrowthRecord = {
  id: string;
  fish_batch_id: string | null;
  pond_id: string | null;
  age_days: number | null;
  avg_weight_g: number | null;
  avg_length_cm: number | null;
  recorded_at: string;
  growth_status: string | null;
};

const Growth = () => {
  const { role } = useAuth();
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [batches, setBatches] = useState<FishBatch[]>([]);
  const [model, setModel] = useState<GrowthReferenceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      }),
    ]).then(([growthResult, batchResult, loadedModel]) => {
      if (!mounted) return;
      if (growthResult.error) throw growthResult.error;
      if (batchResult.error) throw batchResult.error;
      setRecords(growthResult.data ?? []);
      setBatches((batchResult.data ?? []) as unknown as FishBatch[]);
      setModel(loadedModel);
    }).catch(loadError => {
      if (mounted) setError(loadError?.message ?? "Could not load growth forecasts.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const forecasts = useMemo(() => {
    if (!model) return [];
    return batches.map(batch => {
      const batchRecords = records
        .filter(record => record.fish_batch_id === batch.id)
        .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at));
      const latest = batchRecords[0];
      const currentWeight = latest?.avg_weight_g ?? batch.initial_weight_g;
      const currentLength = latest?.avg_length_cm ?? batch.initial_length_cm;
      const horizon = model.target_horizon_days;
      const forecastDate = addDays(new Date(), horizon);
      return {
        batch,
        latest,
        currentWeight,
        currentLength,
        currentAge: latest?.age_days ?? daysSinceStocking(batch.stocking_date),
        forecastDate,
        weight: estimateGrowth(currentWeight, model.outputs.avg_weight_g, horizon),
        length: estimateGrowth(currentLength, model.outputs.avg_length_cm, horizon),
      };
    });
  }, [batches, records, model]);

  const chartRecords = records.map(record => ({
    ...record,
    dateLabel: format(new Date(record.recorded_at), "MMM d"),
  }));
  const validatedOnBfar = model?.seven_day_validation.status === "validated";

  return (
    <AppShell>
      <PageHeader title="Growth Monitoring" subtitle="Track Bangus measurements and view a seven-day growth estimate." />

      {error && (
        <Card className="mb-5 border-destructive/40 p-4 text-sm text-destructive" role="alert">{error}</Card>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status">Loading growth records…</Card>
      ) : batches.length === 0 ? (
        <Card className="mb-6 p-6">
          <EmptyState
            icon={Fish}
            title="Register the current fish batch to see a forecast."
            description="The estimate needs the stocking date and starting average weight or length. An administrator can add those details in Growth Records."
          />
          {role === "admin" && <div className="mt-4 text-center"><Button asChild><Link to="/admin/growth">Set up a fish batch</Link></Button></div>}
        </Card>
      ) : (
        <section aria-labelledby="forecast-heading" className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="forecast-heading" className="text-xl font-semibold">Seven-day growth estimate</h2>
              <p className="mt-1 text-sm text-muted-foreground">Based on the latest measurement for each active batch.</p>
            </div>
            <Badge variant="outline" className={validatedOnBfar
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"}>
              {validatedOnBfar ? <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />}
              {validatedOnBfar ? "Checked on held-out BFAR batches" : "Research estimate"}
            </Badge>
          </div>

          {forecasts.map(({ batch, latest, currentWeight, currentLength, currentAge, forecastDate, weight, length }) => (
            <Card key={batch.id} className="overflow-hidden p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h3 className="font-semibold">{batch.batch_name}</h3>
                  <p className="text-sm text-muted-foreground">{batch.pond_profiles?.name ?? "Pond"} · stocked {format(new Date(`${batch.stocking_date}T00:00:00`), "MMM d, yyyy")}</p>
                  <p className="mt-1 text-sm font-medium">
                    {batch.stocked_fish_count != null
                      ? `${batch.stocked_fish_count.toLocaleString()} fish stocked`
                      : "Fish count not recorded"}
                    {" | "}
                    {formatStockingDensity(batch.stocked_fish_count, batch.pond_profiles?.area_sqm)
                      ? `Initial density: ${formatStockingDensity(batch.stocked_fish_count, batch.pond_profiles?.area_sqm)}`
                      : batch.stocked_fish_count == null
                        ? "Density unavailable until a fish count is recorded"
                        : "Pond area required to calculate density"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Initial density uses the pond's recorded area; it does not represent surviving fish.</p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">Forecast for {format(forecastDate, "MMM d, yyyy")}</div>
                  <div className="text-muted-foreground">Day {currentAge} → day {currentAge + (model?.target_horizon_days ?? 7)}</div>
                </div>
              </div>

              <div className="grid gap-4 py-5 sm:grid-cols-2">
                <ForecastMetric icon={Weight} label="Average weight" current={currentWeight} estimate={weight} unit="g" />
                <ForecastMetric icon={Ruler} label="Average length" current={currentLength} estimate={length} unit="cm" />
              </div>

              <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                The expected value comes from published milkfish pond data and any records supplied for training. The range shows observed growth-rate spread; it is not a statistical confidence interval. {validatedOnBfar
                  ? "The model passed the held-out BFAR comparison for both weight and length."
                  : ""}
                {latest && <span className="mt-1 block">Latest pond sample: {format(new Date(latest.recorded_at), "MMM d, yyyy")}.</span>}
              </div>
              {model?.sources[0] && (
                <a className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline" href={model.sources[0].url} target="_blank" rel="noreferrer">
                  Source: {model.sources[0].publisher} {model.sources[0].year} <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </Card>
          ))}
        </section>
      )}

      {records.length > 0 && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <Stat label="Latest weight" value={`${records[records.length - 1].avg_weight_g ?? "—"} g`} />
            <Stat label="Latest length" value={`${records[records.length - 1].avg_length_cm ?? "—"} cm`} />
            <Stat label="Age at last sample" value={`${records[records.length - 1].age_days ?? "—"} days`} />
            <Stat label="Growth status" value={records[records.length - 1].growth_status ?? "—"} />
          </div>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Recorded growth measurements</h2>
            <div className="h-80 min-h-[20rem]">
              <ResponsiveContainer>
                <LineChart data={chartRecords}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dateLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="avg_weight_g" stroke="hsl(var(--accent))" strokeWidth={2} name="Weight (g)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="avg_length_cm" stroke="hsl(var(--success))" strokeWidth={2} name="Length (cm)" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
};

const ForecastMetric = ({
  icon: Icon,
  label,
  current,
  estimate,
  unit,
}: {
  icon: typeof Weight;
  label: string;
  current: number | null;
  estimate: { expected: number; low: number; high: number } | null;
  unit: string;
}) => (
  <div className="rounded-xl border border-border p-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
    {estimate ? (
      <>
        <div className="mt-3 text-2xl font-semibold">{estimate.expected.toFixed(2)} <span className="text-base font-normal">{unit}</span></div>
        <div className="mt-1 text-sm text-muted-foreground">Reference range: {estimate.low.toFixed(2)}–{estimate.high.toFixed(2)} {unit}</div>
        <div className="mt-1 text-xs text-muted-foreground">Current baseline: {Number(current).toFixed(2)} {unit}</div>
      </>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground">Add a starting or sampled {label.toLowerCase()} to forecast this measure.</p>
    )}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="stat-tile"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-mono text-2xl">{value}</div></div>
);

export default Growth;
