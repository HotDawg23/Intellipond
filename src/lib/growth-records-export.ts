import { supabase } from "@/integrations/supabase/client";
import { buildGrowthRecordsCsv } from "@/lib/growth-records-csv";
import type { GrowthWaterAveragesRecord } from "@/lib/growth-records-csv";

export { buildGrowthRecordsCsv } from "@/lib/growth-records-csv";
export type { GrowthWaterAveragesRecord } from "@/lib/growth-records-csv";

const PAGE_SIZE = 1000;

export async function fetchGrowthRecordsWithWaterAverages(): Promise<GrowthWaterAveragesRecord[]> {
  const records: GrowthWaterAveragesRecord[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("growth_records_with_water_averages")
      .select("*")
      .order("recorded_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const page = data ?? [];
    records.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return records;
}

export async function downloadGrowthRecordsCsv(): Promise<number> {
  const records = await fetchGrowthRecordsWithWaterAverages();
  if (records.length === 0) return 0;

  const blob = new Blob([buildGrowthRecordsCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `growth-records-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return records.length;
}
