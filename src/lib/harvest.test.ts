import { describe, expect, it } from "vitest";
import { harvestResult, validateHarvest } from "./harvest";

const batch = { stocking_date: "2026-10-01", stocked_fish_count: 1000 };

describe("final harvest", () => {
  it("calculates BFAR's count-based yield and mortality", () => {
    expect(harvestResult({ ...batch, harvest_date: "2026-11-01", harvested_fish_count: 900 }))
      .toEqual({ yieldCount: 900, mortalityCount: 100, mortalityRate: 10 });
  });

  it("keeps unknown stocked and harvest counts distinct from zero", () => {
    expect(harvestResult({ ...batch, stocked_fish_count: null, harvest_date: "2026-11-01", harvested_fish_count: 900 }))
      .toEqual({ yieldCount: 900, mortalityCount: null, mortalityRate: null });
    expect(harvestResult({ ...batch, harvest_date: null, harvested_fish_count: null }).yieldCount).toBeNull();
    expect(harvestResult({ ...batch, harvest_date: "2026-11-01", harvested_fish_count: 0 }).mortalityRate).toBe(100);
  });

  it("rejects invalid dates and counts", () => {
    expect(validateHarvest("2026-10-31", "900", batch, "2026-11-09")).toBeNull();
    expect(validateHarvest("2026-09-30", "900", batch, "2026-11-09")).toMatch(/before/);
    expect(validateHarvest("2026-11-10", "900", batch, "2026-11-09")).toMatch(/future/);
    expect(validateHarvest("2026-02-30", "900", batch, "2026-11-09")).toMatch(/valid/);
    for (const count of ["", "-1", "1.5", "1001"]) expect(validateHarvest("2026-10-31", count, batch, "2026-11-09")).not.toBeNull();
  });
});
