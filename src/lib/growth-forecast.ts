export type GrowthMetricModel = {
  daily_log_growth_median: number;
  daily_log_growth_p10: number;
  daily_log_growth_p90: number;
};

export type GrowthReferenceModel = {
  model_version: string;
  model_name: string;
  target_horizon_days: number;
  outputs: {
    avg_weight_g: GrowthMetricModel;
    avg_length_cm: GrowthMetricModel;
  };
  training_data: {
    measurement_count: number;
    cohort_count: number;
    day_gaps_between_measurements: { min: number; max: number } | null;
  };
  seven_day_validation: { status: string; note: string };
  sources: Array<{ title: string; publisher: string; year: number; license: string; url: string }>;
};

export type GrowthEstimate = { expected: number; low: number; high: number };

export type GrowthObservation = {
  fish_batch_id: string | null;
  recorded_at: string;
  avg_weight_g: number | null;
  avg_length_cm: number | null;
};

export type GrowthBaseline = {
  value: number;
  date: string;
  source: "sample" | "stocking";
};

const dateAtUtc = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

export function latestGrowthBaseline(
  records: GrowthObservation[],
  batchId: string,
  metric: "avg_weight_g" | "avg_length_cm",
  stockingDate: string,
  startingValue: number | null,
): GrowthBaseline | null {
  const latest = records
    .filter(record => record.fish_batch_id === batchId && record[metric] != null)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  if (latest?.[metric] != null) {
    return { value: latest[metric]!, date: latest.recorded_at.slice(0, 10), source: "sample" };
  }
  return startingValue != null
    ? { value: startingValue, date: stockingDate, source: "stocking" }
    : null;
}

export function growthForecastWindow(baseline: GrowthBaseline | null, today: Date, horizonDays: number) {
  if (!baseline) return { ageDays: null, targetDate: null, isFresh: false };
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const ageDays = Math.floor((todayUtc - dateAtUtc(baseline.date)) / 86_400_000);
  const targetDate = new Date(dateAtUtc(baseline.date) + horizonDays * 86_400_000).toISOString().slice(0, 10);
  return { ageDays, targetDate, isFresh: ageDays >= 0 && ageDays <= horizonDays };
}

export function estimateGrowth(
  currentValue: number | null | undefined,
  metricModel: GrowthMetricModel,
  horizonDays: number,
): GrowthEstimate | null {
  if (currentValue == null || !Number.isFinite(currentValue) || currentValue <= 0) return null;
  const project = (rate: number) => currentValue * Math.exp(rate * horizonDays);
  return {
    expected: project(metricModel.daily_log_growth_median),
    low: Math.min(project(metricModel.daily_log_growth_p10), project(metricModel.daily_log_growth_p90)),
    high: Math.max(project(metricModel.daily_log_growth_p10), project(metricModel.daily_log_growth_p90)),
  };
}

export function daysSinceStocking(stockingDate: string, asOf: Date = new Date()): number {
  const [year, month, day] = stockingDate.split("-").map(Number);
  const stockedAtUtc = Date.UTC(year, month - 1, day);
  const todayAtUtc = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return Math.max(0, Math.floor((todayAtUtc - stockedAtUtc) / 86_400_000));
}
