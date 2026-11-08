import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { estimateNextVisitMortality, type MortalityResearchModel } from "./mortality-forecast";

const model = JSON.parse(readFileSync(resolve(process.cwd(), "public/mortality-model.json"), "utf8")) as MortalityResearchModel;

describe("published mortality research model", () => {
  it("matches scikit-learn classifications for fixed examples", () => {
    expect(estimateNextVisitMortality(model, { do_mg_l: 5.9, ph: 8.38, temperature_c: 29.6, previous_dead: 0 })).toBe("no_signal");
    expect(estimateNextVisitMortality(model, { do_mg_l: 3.4, ph: 8.3, temperature_c: 28.1, previous_dead: 0 })).toBe("elevated");
  });

  it("rejects invalid inputs", () => {
    expect(estimateNextVisitMortality(model, { do_mg_l: NaN, ph: 8.3, temperature_c: 28.1, previous_dead: 0 })).toBeNull();
    expect(estimateNextVisitMortality(model, { do_mg_l: 3.4, ph: 8.3, temperature_c: 28.1, previous_dead: -1 })).toBeNull();
  });
});
