import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  do_min: number; do_max: number;
  ph_min: number; ph_max: number;
  temp_min: number; temp_max: number;
  turbidity_max: number;
  critical_do_high: number | null;
  critical_ph_low: number | null;
  critical_ph_high: number | null;
  critical_temp_low: number | null;
  critical_turbidity_high: number | null;
};

export const DEFAULT_SETTINGS: Settings = {
  do_min: 4, do_max: 9, ph_min: 6.5, ph_max: 8.5, temp_min: 26, temp_max: 32, turbidity_max: 80,
  critical_do_high: null, critical_ph_low: null, critical_ph_high: null,
  critical_temp_low: null, critical_turbidity_high: null,
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("admin_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_SETTINGS;
}

export type Reading = {
  do_mg_l: number | null; ph: number | null; temperature_c: number | null; turbidity_ntu: number | null;
};

export function evaluatePond(r: Reading | null, s: Settings) {
  if (!r) return { status: "unknown" as const, score: 0, issues: [] as string[] };
  const issues: string[] = [];
  if (r.do_mg_l != null && (r.do_mg_l < s.do_min)) issues.push("Low dissolved oxygen");
  if (r.do_mg_l != null && (r.do_mg_l > s.do_max)) issues.push("High dissolved oxygen");
  if (r.ph != null && (r.ph < s.ph_min || r.ph > s.ph_max)) issues.push("pH out of range");
  if (r.temperature_c != null && (r.temperature_c < s.temp_min)) issues.push("Water too cold");
  if (r.temperature_c != null && (r.temperature_c > s.temp_max)) issues.push("Water too warm");
  if (r.turbidity_ntu != null && r.turbidity_ntu > s.turbidity_max) issues.push("High turbidity");
  let status: "healthy" | "watch" | "critical" | "unknown" = "healthy";
  if (issues.length === 1) status = "watch";
  if (issues.length >= 2) status = "critical";
  return { status, score: Math.max(0, 100 - issues.length * 25), issues };
}
