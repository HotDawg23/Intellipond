import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, FlaskConical, Thermometer, Eye, Activity, Fish, AlertCircle, Waves, TrendingUp, Siren, Lightbulb, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { evaluatePond, getSettings, Settings, DEFAULT_SETTINGS } from "@/lib/pond";
import { isSensorOffline, SENSOR_OFFLINE_AFTER_MINUTES } from "@/lib/sensor-status";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

type SensorReading = Tables<"sensor_readings">;
type PondAlert = Tables<"alerts">;

const Dashboard = () => {
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [pondCount, setPondCount] = useState(0);
  const [alerts, setAlerts] = useState<PondAlert[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [growthCount, setGrowthCount] = useState(0);
  const [highlightAlert, setHighlightAlert] = useState<PondAlert | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [s, ponds, latestR, hist, al, gr] = await Promise.all([
        getSettings(),
        supabase.from("pond_profiles").select("id", { count: "exact", head: true }),
        supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(24),
        supabase.from("alerts").select("*").eq("acknowledged", false).order("created_at", { ascending: false }).limit(5),
        supabase.from("bangus_growth_records").select("id", { count: "exact", head: true }),
      ]);
      if (!mounted) return;
      setSettings(s);
      setPondCount(ponds.count ?? 0);
      setLatest(latestR.data);
      setHistory((hist.data ?? []).reverse());
      setAlerts(al.data ?? []);
      setGrowthCount(gr.count ?? 0);
    };
    load();
    const ch = supabase.channel("dash").on("postgres_changes", { event: "*", schema: "public", table: "sensor_readings" }, load).subscribe();
    const alertCh = supabase
      .channel("dash-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        const a = payload.new as PondAlert;
        if (a.severity === "critical" || a.severity === "warning") {
          setHighlightAlert(a);
          toast[a.severity === "critical" ? "error" : "warning" as "error"](a.message, {
            description: a.recommendation ?? undefined,
          });
        }
        setAlerts((prev) => [a, ...prev].slice(0, 5));
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); supabase.removeChannel(alertCh); };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Seed the highlight from the most recent unacknowledged critical/warning alert on load
  useEffect(() => {
    const top = alerts.find((a) => a.severity === "critical" || a.severity === "warning");
    if (top) setHighlightAlert((current) => current ?? top);
  }, [alerts]);

  const evaluation = evaluatePond(latest, settings);
  const sensorOffline = isSensorOffline(latest?.recorded_at ?? null, currentTime);
  const dashboardStatus = sensorOffline ? "offline" : evaluation.status;
  const sensors = [
    { icon: Droplets, label: "Dissolved O₂", val: latest?.do_mg_l, unit: "mg/L", ok: latest && latest.do_mg_l >= settings.do_min && latest.do_mg_l <= settings.do_max },
    { icon: FlaskConical, label: "pH Level", val: latest?.ph, unit: "", ok: latest && latest.ph >= settings.ph_min && latest.ph <= settings.ph_max },
    { icon: Thermometer, label: "Temperature", val: latest?.temperature_c, unit: "°C", ok: latest && latest.temperature_c >= settings.temp_min && latest.temperature_c <= settings.temp_max },
    { icon: Eye, label: "Turbidity", val: latest?.turbidity_ntu, unit: "NTU", ok: latest && latest.turbidity_ntu <= settings.turbidity_max },
  ];

  const statusColor = dashboardStatus === "healthy" ? "bg-success text-success-foreground"
    : dashboardStatus === "watch" ? "bg-warning text-warning-foreground"
    : dashboardStatus === "critical" || dashboardStatus === "offline" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground";

  return (
    <AppShell>
      <PageHeader title="Pond Overview" subtitle="Live snapshot of your aquaculture system." />

      {sensorOffline && (
        <Card role="alert" className="mb-6 border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <div className="font-semibold text-destructive">Sensor data is offline</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {latest
                  ? `No water parameter readings have arrived in the last ${SENSOR_OFFLINE_AFTER_MINUTES} minutes. Check that the sensors are in the water, powered on, and connected to the network.`
                  : "No water parameter readings have been received yet. Check that the sensors are in the water, powered on, and connected to the network."}
              </p>
              {latest && (
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  Last reading · {format(new Date(latest.recorded_at), "MMM d, HH:mm")}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {highlightAlert && (
        <Card
          className={`mb-6 flex flex-col items-start gap-3 border-l-4 p-4 animate-in fade-in slide-in-from-top-2 sm:flex-row sm:gap-4 sm:p-5 ${
            highlightAlert.severity === "critical"
              ? "border-l-destructive bg-destructive/5"
              : "border-l-warning bg-warning/5"
          }`}
        >
          <div
            className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${
              highlightAlert.severity === "critical"
                ? "bg-destructive/15 text-destructive"
                : "bg-warning/15 text-warning"
            }`}
          >
            <Siren className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] uppercase tracking-wider ${
                  highlightAlert.severity === "critical"
                    ? "border-destructive/40 text-destructive"
                    : "border-warning/40 text-warning"
                }`}
              >
                {highlightAlert.severity} · new recommendation
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">
                {format(new Date(highlightAlert.created_at), "MMM d · HH:mm")}
              </span>
            </div>
            <div className="break-words text-base font-semibold leading-snug">{highlightAlert.message}</div>
            {highlightAlert.recommendation && (
              <div className="mt-2 flex items-start gap-2 text-sm text-foreground/80 bg-background/60 rounded-lg p-3 border border-border/60">
                <Lightbulb className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span className="break-words">{highlightAlert.recommendation}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setHighlightAlert(null)}
            className="self-end text-xs text-muted-foreground hover:text-foreground sm:self-start sm:shrink-0"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </Card>
      )}

      {/* Hero status */}
      <Card className="overflow-hidden border-border/60 mb-6">
        <div className="grid md:grid-cols-3 gap-0">
          <div className="relative p-5 text-white gradient-deep sm:p-8 md:col-span-2">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(188_85%_55%/0.3),transparent_50%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                <Waves className="h-4 w-4" /> Overall Pond Condition
              </div>
              <div className="flex items-baseline gap-4">
                <div className="text-5xl font-semibold capitalize">{dashboardStatus}</div>
                <Badge className={statusColor + " border-0"}>{sensorOffline ? "No live data" : `${evaluation.score}/100`}</Badge>
              </div>
              <p className="mt-3 text-white/70 max-w-md">
                {sensorOffline
                  ? "The pond condition cannot be confirmed until fresh sensor readings arrive."
                  : evaluation.issues.length === 0 ? "All parameters are within optimal range." : evaluation.issues.join(" · ")}
              </p>
              {latest && <div className="text-xs text-white/50 mt-4 font-mono">Last reading · {format(new Date(latest.recorded_at), "MMM d, HH:mm")}</div>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-card p-4 sm:p-6">
            <MiniStat icon={Fish} label="Growth records" value={growthCount.toString()} />
            <MiniStat icon={AlertCircle} label="Open alerts" value={(alerts.length + (sensorOffline ? 1 : 0)).toString()} accent={alerts.length === 0 && !sensorOffline} />
            <MiniStat icon={TrendingUp} label="Ponds" value={pondCount.toString()} />
          </div>
        </div>
      </Card>

      {/* Sensors */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {sensors.map((s, i) => (
          <div
            key={i}
            className="stat-tile animate-fade-in hover-scale"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <div className="flex items-center justify-between mb-3">
              <s.icon className="h-5 w-5 text-accent" />
              {sensorOffline
                ? <Badge variant="destructive" className="text-[10px]">Offline</Badge>
                : latest && <span className={`ripple-dot ${s.ok ? "bg-success" : "bg-destructive"}`} />}
            </div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="font-mono text-3xl mt-1">
              {s.val != null ? Number(s.val).toFixed(2) : "—"}
              <span className="text-sm text-muted-foreground ml-1">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Water Quality Trend</h3>
              <p className="text-xs text-muted-foreground">Recent sensor readings</p>
            </div>
          </div>
          {history.length === 0 ? (
            <EmptyState icon={Activity} title="No sensor readings available yet." description="Charts will populate as data flows in." />
          ) : (
            <div className="h-72 min-h-[18rem]">
              <div key={history[history.length - 1]?.id ?? history.length} className="h-full w-full animate-fade-in">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.map(h => ({ ...h, t: format(new Date(h.recorded_at), "HH:mm") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="do_mg_l" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="DO" isAnimationActive animationDuration={500} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="ph" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="pH" isAnimationActive animationDuration={500} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="temperature_c" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="Temp" isAnimationActive animationDuration={500} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-1">Alerts & Recommendations</h3>
          <p className="text-xs text-muted-foreground mb-4">Active issues that need attention</p>
          {alerts.length === 0 && !sensorOffline ? (
            <EmptyState icon={AlertCircle} title="All clear" description="No active alerts at this time." />
          ) : (
            <div className="space-y-3">
              {sensorOffline && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="destructive" className="text-[10px] uppercase">Offline</Badge>
                    <span className="text-[10px] text-muted-foreground">Sensor connection</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">No recent water parameter readings.</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Check sensor placement, power, and network connection.
                  </div>
                </div>
              )}
              {alerts.map(a => (
                <div key={a.id} className="p-3 rounded-lg border border-border bg-secondary/30">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] uppercase">{a.severity}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "HH:mm")}</span>
                  </div>
                  <div className="text-sm font-medium mt-2">{a.message}</div>
                  {a.recommendation && <div className="text-xs text-muted-foreground mt-1">→ {a.recommendation}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

type MiniStatProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
};

const MiniStat = ({ icon: Icon, label, value, accent }: MiniStatProps) => (
  <div className="rounded-xl p-3 bg-secondary/40">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
    <div className={`mt-1.5 font-semibold ${accent ? "text-success" : ""}`}>{value}</div>
  </div>
);

export default Dashboard;
