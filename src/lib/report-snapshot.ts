import type { Database } from "@/integrations/supabase/types";

export type Report = Database["public"]["Tables"]["reports"]["Row"];

export type ReportParameter = {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
};

export type ReportSnapshot = {
  version: 1;
  generated_at: string;
  time_zone: string;
  pond_name: string;
  batch_name: string | null;
  readings: {
    count: number;
    first_at: string | null;
    last_at: string | null;
    latest: {
      at: string;
      do_mg_l: number | null;
      ph: number | null;
      temperature_c: number | null;
      turbidity_ntu: number | null;
    } | null;
    do_mg_l: ReportParameter;
    ph: ReportParameter;
    temperature_c: ReportParameter;
    turbidity_ntu: ReportParameter;
  };
  alerts: {
    count: number;
    critical: number;
    warning: number;
    active: number;
    recent: {
      severity: string;
      message: string;
      status: string;
      created_at: string;
      recommendation: string | null;
    }[];
  };
  growth: {
    count: number;
    first: { at: string; weight_g: number | null; length_cm: number | null } | null;
    latest: { at: string; weight_g: number | null; length_cm: number | null } | null;
    weight_change_g: number | null;
    length_change_cm: number | null;
  };
};

export function getReportSnapshot(report: Report): ReportSnapshot | null {
  const data = report.report_data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const snapshot = data as unknown as Partial<ReportSnapshot>;
  if (snapshot.version !== 1 || !snapshot.readings || !snapshot.alerts || !snapshot.growth) return null;
  return snapshot as ReportSnapshot;
}
