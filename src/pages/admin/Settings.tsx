import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Sliders } from "lucide-react";

type ThresholdSettings = {
  do_min: number | string;
  do_max: number | string;
  ph_min: number | string;
  ph_max: number | string;
  temp_min: number | string;
  temp_max: number | string;
  turbidity_max: number | string;
  alerts_enabled: boolean;
  critical_do_high: number | string | null;
  critical_ph_low: number | string | null;
  critical_ph_high: number | string | null;
  critical_temp_low: number | string | null;
  critical_turbidity_high: number | string | null;
};

const Settings = () => {
  const [s, setS] = useState<ThresholdSettings>({ do_min: 4, do_max: 9, ph_min: 6.5, ph_max: 8.5, temp_min: 26, temp_max: 32, turbidity_max: 80, alerts_enabled: true, critical_do_high: null, critical_ph_low: null, critical_ph_high: null, critical_temp_low: null, critical_turbidity_high: null });
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from("admin_settings").select("*").limit(1).maybeSingle();
      if (row) { setS(row); setSettingsId(row.id); }
    })();
  }, []);

  const saveThresholds = async () => {
    const optionalNumber = (value: number | string | null) => value === "" || value == null ? null : Number(value);
    const criticalValues = {
      critical_do_high: optionalNumber(s.critical_do_high),
      critical_ph_low: optionalNumber(s.critical_ph_low),
      critical_ph_high: optionalNumber(s.critical_ph_high),
      critical_temp_low: optionalNumber(s.critical_temp_low),
      critical_turbidity_high: optionalNumber(s.critical_turbidity_high),
    };
    if (Object.values(criticalValues).some(value => value != null && !Number.isFinite(value))) {
      return toast.error("Critical bands must be valid numbers or left blank.");
    }
    if (criticalValues.critical_do_high != null && criticalValues.critical_do_high <= +s.do_max) return toast.error("Critical high DO must be above the warning maximum.");
    if (criticalValues.critical_ph_low != null && criticalValues.critical_ph_low >= +s.ph_min) return toast.error("Critical low pH must be below the warning minimum.");
    if (criticalValues.critical_ph_high != null && criticalValues.critical_ph_high <= +s.ph_max) return toast.error("Critical high pH must be above the warning maximum.");
    if (criticalValues.critical_temp_low != null && criticalValues.critical_temp_low >= +s.temp_min) return toast.error("Critical low temperature must be below the warning minimum.");
    if (criticalValues.critical_turbidity_high != null && criticalValues.critical_turbidity_high <= +s.turbidity_max) return toast.error("Critical turbidity must be above the warning maximum.");

    const payload = { do_min: +s.do_min, do_max: +s.do_max, ph_min: +s.ph_min, ph_max: +s.ph_max, temp_min: +s.temp_min, temp_max: +s.temp_max, turbidity_max: +s.turbidity_max, alerts_enabled: s.alerts_enabled, ...criticalValues, updated_at: new Date().toISOString() };
    const { error } = settingsId
      ? await supabase.from("admin_settings").update(payload).eq("id", settingsId)
      : await supabase.from("admin_settings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  return (
    <AppShell admin>
      <div className="mx-auto w-full max-w-4xl">
        <PageHeader title="System Configuration" subtitle="Water-quality thresholds and alerting." />
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1"><Sliders className="h-5 w-5 text-accent" /><h3 className="font-semibold">Threshold Configuration</h3></div>
          <p className="text-sm text-muted-foreground mb-5">Control when alerts trigger.</p>
          <div className="space-y-4">
            <Pair l="DO" a={[s.do_min, v => setS({ ...s, do_min: v })]} b={[s.do_max, v => setS({ ...s, do_max: v })]} unit="mg/L" />
            <Pair l="pH" a={[s.ph_min, v => setS({ ...s, ph_min: v })]} b={[s.ph_max, v => setS({ ...s, ph_max: v })]} />
            <Pair l="Temp" a={[s.temp_min, v => setS({ ...s, temp_min: v })]} b={[s.temp_max, v => setS({ ...s, temp_max: v })]} unit="°C" />
            <div>
              <Label>Max turbidity (NTU)</Label>
              <Input type="number" step="0.1" value={s.turbidity_max} onChange={e => setS({ ...s, turbidity_max: e.target.value })} />
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <div className="font-medium text-sm">Optional Critical bands</div>
                <p className="text-xs text-muted-foreground">Leave blank until BFAR approves values. Existing thresholds and Critical rules remain active.</p>
              </div>
              <OptionalThreshold label="High DO (mg/L)" value={s.critical_do_high} onChange={value => setS({ ...s, critical_do_high: value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionalThreshold label="Low pH" value={s.critical_ph_low} onChange={value => setS({ ...s, critical_ph_low: value })} />
                <OptionalThreshold label="High pH" value={s.critical_ph_high} onChange={value => setS({ ...s, critical_ph_high: value })} />
                <OptionalThreshold label="Low temperature (°C)" value={s.critical_temp_low} onChange={value => setS({ ...s, critical_temp_low: value })} />
                <OptionalThreshold label="High turbidity (NTU)" value={s.critical_turbidity_high} onChange={value => setS({ ...s, critical_turbidity_high: value })} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
              <div><div className="font-medium text-sm">Enable alerts</div><div className="text-xs text-muted-foreground">Send notifications when thresholds trip.</div></div>
              <Switch checked={s.alerts_enabled} onCheckedChange={v => setS({ ...s, alerts_enabled: v })} />
            </div>
            <Button className="w-full gradient-aqua text-white border-0" onClick={saveThresholds}>Save thresholds</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

type PairProps = {
  l: string;
  a: [number | string, (value: string) => void];
  b: [number | string, (value: string) => void];
  unit?: string;
};

const Pair = ({ l, a, b, unit }: PairProps) => (
  <div>
    <Label>{l} range {unit && <span className="text-muted-foreground">({unit})</span>}</Label>
    <div className="grid grid-cols-2 gap-2">
      <Input type="number" step="0.1" value={a[0]} onChange={e => a[1](e.target.value)} placeholder="min" />
      <Input type="number" step="0.1" value={b[0]} onChange={e => b[1](e.target.value)} placeholder="max" />
    </div>
  </div>
);
export default Settings;

const OptionalThreshold = ({ label, value, onChange }: { label: string; value: number | string | null; onChange: (value: string) => void }) => (
  <div>
    <Label>{label}</Label>
    <Input type="number" step="0.1" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder="Not set" />
  </div>
);
