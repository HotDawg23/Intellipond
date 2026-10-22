import type { Tables } from "@/integrations/supabase/types";

export type AlertRecord = Tables<"alerts">;

export function getAlertStatusLabel(alert: Pick<AlertRecord, "status" | "acknowledged">) {
  if (alert.status === "legacy_archived") return "Legacy record";
  if (alert.status === "resolved") return "Resolved";
  return alert.acknowledged ? "Acknowledged" : "Unacknowledged";
}

export function getAlertConditionLabel(conditionKey: string | null) {
  const labels: Record<string, string> = {
    do_low: "Low dissolved oxygen",
    do_high: "High dissolved oxygen",
    ph_low: "Low pH",
    ph_high: "High pH",
    temperature_low: "Low temperature",
    temperature_high: "High temperature",
    turbidity_high: "High turbidity",
  };
  return conditionKey ? labels[conditionKey] ?? conditionKey.replace(/_/g, " ") : "Historical alert";
}

export function formatAlertReading(alert: Pick<AlertRecord, "sensor_type" | "last_sensor_value">) {
  if (alert.last_sensor_value == null) return null;
  const value = Number(alert.last_sensor_value).toFixed(2);
  const sensor = alert.sensor_type?.toLowerCase();
  const unit = sensor === "do" ? " mg/L"
    : sensor === "temperature" ? " °C"
    : sensor === "turbidity" ? " NTU"
    : "";
  return `${value}${unit}`;
}
