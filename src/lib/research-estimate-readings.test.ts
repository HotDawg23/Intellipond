import { describe, expect, it } from "vitest";
import { getResearchEstimateReadingsForReport } from "@/lib/research-estimate-readings";

describe("getResearchEstimateReadingsForReport", () => {
  it("returns estimates for the matching pond, batch, and period", () => {
    const readings = getResearchEstimateReadingsForReport(
      "BFAR 2025 Pond 1 (historical)",
      "BFAR Pond 1 Second Cycle 2025",
      "2025-10-17",
      "2025-11-17",
    );

    expect(readings).toHaveLength(5);
    expect(readings.every(reading => reading.pond_name === "BFAR 2025 Pond 1 (historical)")).toBe(true);
    expect(readings.every(reading => reading.batch_name === "BFAR Pond 1 Second Cycle 2025")).toBe(true);
  });

  it("does not reuse estimates for another pond with the same batch name", () => {
    const readings = getResearchEstimateReadingsForReport(
      "A different pond",
      "BFAR Pond 1 Second Cycle 2025",
      "2025-10-17",
      "2025-11-17",
    );

    expect(readings).toEqual([]);
  });
});
