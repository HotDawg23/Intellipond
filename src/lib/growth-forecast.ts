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
