import type { Tables } from "@/integrations/supabase/types";

export type GrowthWaterAveragesRecord = Tables<"growth_records_with_water_averages">;
export type BatchWaterQualityReference = Pick<
  Tables<"batch_water_quality_references">,
  "do_mg_l" | "ph" | "temperature_c" | "turbidity_ntu"
>;
export type GrowthCsvRecord = GrowthWaterAveragesRecord & {
  batchWaterQualityReference?: BatchWaterQualityReference | null;
};

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

const READING_COUNT_COLUMNS = new Set<keyof GrowthWaterAveragesRecord>([
  "do_reading_count",
  "ph_reading_count",
  "temperature_reading_count",
  "turbidity_reading_count",
]);

const WATER_AVERAGE_REFERENCE_FIELDS: Partial<Record<keyof GrowthWaterAveragesRecord, keyof BatchWaterQualityReference>> = {
  avg_do_mg_l: "do_mg_l",
  avg_ph: "ph",
  avg_temperature_c: "temperature_c",
  avg_turbidity_ntu: "turbidity_ntu",
};

const WATER_AVERAGE_COUNT_FIELDS: Partial<Record<keyof GrowthWaterAveragesRecord, keyof GrowthWaterAveragesRecord>> = {
  avg_do_mg_l: "do_reading_count",
  avg_ph: "ph_reading_count",
  avg_temperature_c: "temperature_reading_count",
  avg_turbidity_ntu: "turbidity_reading_count",
};

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

export function buildGrowthRecordsCsv(records: GrowthCsvRecord[]): string {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(",");
  const rows = records.map(record => CSV_COLUMNS
    .map(([, key]) => {
      const value = record[key];
      const referenceField = WATER_AVERAGE_REFERENCE_FIELDS[key];
      const countField = WATER_AVERAGE_COUNT_FIELDS[key];
      if (
        referenceField && countField && value == null &&
        (record[countField] == null || record[countField] === 0)
      ) {
        const referenceValue = record.batchWaterQualityReference?.[referenceField];
        if (referenceValue != null) return csvCell(referenceValue);
      }

      // Keep an absent reading count blank instead of implying a zero measurement.
      return csvCell(READING_COUNT_COLUMNS.has(key) && value === 0 ? null : value);
    })
    .join(","));
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}
