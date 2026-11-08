import { describe, expect, it } from "vitest";
import { summarizeMortality, type MortalityLog } from "./mortality";

const log = (date: string, deaths: number, incoming = 0, outgoing = 0): MortalityLog => ({
  id: date, fish_batch_id: "batch", observed_on: date, dead_count: deaths,
  transferred_in_count: incoming, transferred_out_count: outgoing,
  notes: null, created_at: `${date}T00:00:00Z`,
});

describe("summarizeMortality", () => {
  it("calculates each day's rate using the adjusted starting count", () => {
    const days = summarizeMortality([log("2026-11-02", 4, 0, 10), log("2026-11-01", 5, 20)], 100);
    expect(days.map(day => day.fishRemaining)).toEqual([115, 101]);
    expect(days[0].mortalityRate).toBeCloseTo(5 / 120 * 100);
    expect(days[1].mortalityRate).toBeCloseTo(4 / 105 * 100);
    expect(days[1].cumulativeDeaths).toBe(9);
  });

  it("keeps observed deaths but withholds a rate when count is unknown or impossible", () => {
    expect(summarizeMortality([log("2026-11-01", 1)], null)[0].mortalityRate).toBeNull();
    expect(summarizeMortality([log("2026-11-01", 101)], 100)[0].fishRemaining).toBeNull();
    expect(summarizeMortality([log("2026-11-01", 0)], 100)[0].mortalityRate).toBe(0);
  });
});
