import { describe, expect, it } from "vitest";
import { buildGrowthRecordsCsv, type GrowthWaterAveragesRecord } from "@/lib/growth-records-csv";

function parseCsv(csv: string): string[][] {
  const input = csv.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r" || char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && input[index + 1] === "\n") index += 1;
    } else {
      cell += char;
    }
  }

  if (row.length || cell.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

describe("growth records CSV", () => {
  it("round-trips quoted text, newlines, units, and blank averages", () => {
    const record = {
      id: "growth-1",
      batch_name: 'Batch "A", north pond',
      pond_name: "BFAR",
      stocking_date: "2026-10-01",
      measurement_date: "2026-10-06",
      age_days: 5,
      avg_weight_g: 10.5,
      avg_length_cm: 5.2,
      average_start_date: "2026-10-01",
      average_end_date: "2026-10-06",
      avg_do_mg_l: 8,
      do_reading_count: 1,
      avg_ph: 7.5,
      ph_reading_count: 2,
      avg_temperature_c: 28,
      temperature_reading_count: 1,
      avg_turbidity_ntu: 20,
      turbidity_reading_count: 2,
      feeding_notes: 'line one,\nline "two"',
      pond_condition: "calm",
      growth_status: "On Track",
      recorded_at: "2026-10-05T16:00:00.000Z",
    } as GrowthWaterAveragesRecord;

    const [headers, row] = parseCsv(buildGrowthRecordsCsv([record]));
    const values = Object.fromEntries(headers.map((header, index) => [header, row[index]]));

    expect(values.fish_batch).toBe('Batch "A", north pond');
    expect(values.average_do_mg_l).toBe("8");
    expect(values.do_reading_count).toBe("1");
    expect(values.average_ph).toBe("7.5");
    expect(values.average_temperature_c).toBe("28");
    expect(values.water_average_start_date).toBe("2026-10-01");
    expect(headers).not.toContain("do_source");
    expect(values.feeding_notes).toBe('line one,\nline "two"');
  });

  it("escapes formula-leading text for spreadsheet safety", () => {
    const record = {
      id: "growth-2",
      pond_condition: "=SUM(1,1)",
    } as GrowthWaterAveragesRecord;
    const [headers, row] = parseCsv(buildGrowthRecordsCsv([record]));
    const conditionIndex = headers.indexOf("pond_condition");

    expect(row[conditionIndex]).toBe("'=SUM(1,1)");
  });

  it("exports unavailable averages as blank cells with zero counts", () => {
    const record = {
      id: "growth-3",
      avg_do_mg_l: null,
      do_reading_count: 0,
      avg_ph: null,
      ph_reading_count: 0,
      avg_temperature_c: null,
      temperature_reading_count: 0,
      avg_turbidity_ntu: null,
      turbidity_reading_count: 0,
    } as GrowthWaterAveragesRecord;
    const [headers, row] = parseCsv(buildGrowthRecordsCsv([record]));
    const values = Object.fromEntries(headers.map((header, index) => [header, row[index]]));

    expect(values.average_do_mg_l).toBe("");
    expect(values.do_reading_count).toBe("0");
    expect(values.average_ph).toBe("");
    expect(values.ph_reading_count).toBe("0");
    expect(values.average_temperature_c).toBe("");
    expect(values.temperature_reading_count).toBe("0");
    expect(values.average_turbidity_ntu).toBe("");
    expect(values.turbidity_reading_count).toBe("0");
  });
});
