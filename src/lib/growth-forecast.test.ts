import { describe, expect, it } from "vitest";
import { growthForecastWindow, latestGrowthBaseline, type GrowthObservation } from "@/lib/growth-forecast";

const records: GrowthObservation[] = [
  { fish_batch_id: "a", recorded_at: "2026-10-18T00:00:00Z", avg_weight_g: 12, avg_length_cm: null },
  { fish_batch_id: "b", recorded_at: "2026-10-21T00:00:00Z", avg_weight_g: 900, avg_length_cm: 40 },
  { fish_batch_id: "a", recorded_at: "2026-10-21T00:00:00Z", avg_weight_g: null, avg_length_cm: 6 },
];

describe("growth forecast baselines", () => {
  it("uses the latest measurement of each metric from the selected batch", () => {
    expect(latestGrowthBaseline(records, "a", "avg_weight_g", "2026-10-10", 4)).toEqual({ value: 12, date: "2026-10-18", source: "sample" });
    expect(latestGrowthBaseline(records, "a", "avg_length_cm", "2026-10-10", 3)).toEqual({ value: 6, date: "2026-10-21", source: "sample" });
  });

  it("uses the starting value when no follow-up sample exists", () => {
    expect(latestGrowthBaseline(records, "c", "avg_weight_g", "2026-10-20", 4)).toEqual({ value: 4, date: "2026-10-20", source: "stocking" });
    expect(latestGrowthBaseline(records, "c", "avg_length_cm", "2026-10-20", null)).toBeNull();
  });

  it("dates estimates from the actual sample and expires them after seven days", () => {
    const baseline = { value: 12, date: "2026-10-15", source: "sample" } as const;
    expect(growthForecastWindow(baseline, new Date(2026, 9, 22), 7)).toEqual({ ageDays: 7, targetDate: "2026-10-22", isFresh: true });
    expect(growthForecastWindow(baseline, new Date(2026, 9, 23), 7).isFresh).toBe(false);
    expect(growthForecastWindow(baseline, new Date(2026, 9, 14), 7).isFresh).toBe(false);
  });
});
