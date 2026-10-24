import type { Tables } from "@/integrations/supabase/types";

export type GrowthWaterAveragesRecord = Tables<"growth_records_with_water_averages">;

const CSV_COLUMNS: Array<[string, keyof GrowthWaterAveragesRecord]> = [
  ["growth_record_id", "id"],
  ["fish_batch", "batch_name"],
  ["pond", "pond_name"],
  ["stocking_date", "stocking_date"],
  ["measurement_date", "measurement_date"],
  ["age_days", "age_days"],
  ["average_weight_g", "avg_weight_g"],
  ["average_length_cm", "avg_length_cm"],
  ["water_average_start_date", "average_start_date"],
  ["water_average_end_date", "average_end_date"],
  ["average_do_mg_l", "avg_do_mg_l"],
  ["do_reading_count", "do_reading_count"],
  ["average_ph", "avg_ph"],
  ["ph_reading_count", "ph_reading_count"],
  ["average_temperature_c", "avg_temperature_c"],
  ["temperature_reading_count", "temperature_reading_count"],
  ["average_turbidity_ntu", "avg_turbidity_ntu"],
  ["turbidity_reading_count", "turbidity_reading_count"],
  ["feeding_notes", "feeding_notes"],
  ["pond_condition", "pond_condition"],
  ["growth_status", "growth_status"],
  ["recorded_at_utc", "recorded_at"],
];

function startsWithSpreadsheetFormula(value: string): boolean {
  for (const character of value) {
    if (character.trim() === "" || character.charCodeAt(0) === 0) continue;
    return character === "=" || character === "+" || character === "-" || character === "@";
  }

  return false;
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);

  // Prevent spreadsheet applications from interpreting user-entered text as a formula.
  if (typeof value === "string" && startsWithSpreadsheetFormula(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function buildGrowthRecordsCsv(records: GrowthWaterAveragesRecord[]): string {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(",");
  const rows = records.map(record => CSV_COLUMNS
    .map(([, key]) => csvCell(record[key]))
    .join(","));
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}
