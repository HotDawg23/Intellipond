import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader, EmptyState, LoadingState, LoadError } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Droplets, FlaskConical, Thermometer, Eye, Activity, Fish, AlertCircle, Waves, TrendingUp, Siren, Lightbulb, WifiOff, ChevronDown } from "lucide-react";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { evaluatePond, getSettings, Settings, DEFAULT_SETTINGS } from "@/lib/pond";
import { isSensorOffline, SENSOR_OFFLINE_AFTER_MINUTES } from "@/lib/sensor-status";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { formatAlertReading, getAlertStatusLabel } from "@/lib/alerts";

type SensorReading = Tables<"sensor_readings">;
type PondAlert = Tables<"alerts">;

const Dashboard = () => {
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [pondCount, setPondCount] = useState(0);
  const [alerts, setAlerts] = useState<PondAlert[]>([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [growthCount, setGrowthCount] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const [dismissingAlertId, setDismissingAlertId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) setLoadError("");
      try {
        const [s, ponds, latestR, hist, al, activeAl, gr] = await Promise.all([
        getSettings(),
        supabase.from("pond_profiles").select("id", { count: "exact", head: true }),
        supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(24),
        supabase.from("alerts").select("*").eq("status", "active").order("last_detected_at", { ascending: false }).limit(5),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("bangus_growth_records").select("id", { count: "exact", head: true }),
      ]);
        if (!mounted) return;
        for (const result of [ponds, latestR, hist, al, activeAl, gr]) {
          if (result.error) throw result.error;
        }
      setSettings(s);
      setPondCount(ponds.count ?? 0);
      setLatest(latestR.data);
      setHistory((hist.data ?? []).reverse());
      setAlerts(al.data ?? []);
      setActiveAlertCount(activeAl.count ?? 0);
      setGrowthCount(gr.count ?? 0);
      setHasLoaded(true);
      } catch (error) {
        if (mounted) setLoadError(`Could not load pond overview: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };
    void load();
    const ch = supabase.channel("dash").on("postgres_changes", { event: "*", schema: "public", table: "sensor_readings" }, load).subscribe();
    const alertCh = supabase
      .channel("dash-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); supabase.removeChannel(alertCh); };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!dismissingAlertId) return;
    const timeoutId = window.setTimeout(() => {
      setDismissedAlertId(dismissingAlertId);
      setDismissingAlertId(null);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [dismissingAlertId]);

  const dismissAlert = (id: string) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDismissedAlertId(id);
      return;
    }
    setDismissingAlertId(id);
  };

  const dismissedIncidentIsActive = alerts.some(alert => alert.id === dismissedAlertId);
  const highlightAlert = alerts.find(alert => !dismissedIncidentIsActive || alert.id !== dismissedAlertId) ?? null;
  const isDismissingAlert = highlightAlert?.id === dismissingAlertId;

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
    : dashboardStatus === "critical" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground";

  const chartData = history.map(reading => ({
    ...reading,
    time: format(new Date(reading.recorded_at), "HH:mm"),
  }));
  const chartSeries = [
    { key: "do_mg_l", name: "Dissolved oxygen", unit: "mg/L", color: "hsl(var(--accent))", decimals: 1 },
    { key: "ph", name: "pH", unit: "", color: "hsl(var(--success))", decimals: 1 },
    { key: "temperature_c", name: "Temperature", unit: "°C", color: "hsl(var(--warning))", decimals: 1 },
    { key: "turbidity_ntu", name: "Turbidity", unit: "NTU", color: "hsl(var(--primary))", decimals: 0 },
  ] as const;

  return (
    <AppShell>
      <PageHeader title="Pond Overview" subtitle="Live snapshot of your aquaculture system." />

      {loadError && <div className="mb-5"><LoadError message={loadError} onRetry={() => window.location.reload()} /></div>}
      {!hasLoaded ? (
        loadError ? null : <Card><LoadingState label="Loading pond overview" /></Card>
      ) : <>
      {sensorOffline && (
        <Card role="alert" className="mb-6 border-0 bg-amber-50/80 p-4 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <div className="font-semibold text-amber-900 dark:text-amber-200">Sensor data is offline</div>
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

      {/* Hero status */}
      <Card className="relative mb-6 w-full overflow-hidden border-0 text-white" style={{ background: "var(--gradient-deep)" }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(188_85%_55%/0.3),transparent_50%)]" />
        <div className="relative grid gap-x-5 gap-y-0 p-5 text-white sm:gap-y-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)] lg:items-center">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div className="max-w-lg">
              <div className="flex items-center gap-2 text-white/90 text-sm mb-2">
                <Waves className="h-4 w-4" /> Overall Pond Condition
              </div>
              <div className="flex items-baseline gap-4">
                <div className="font-coolvetica text-5xl font-semibold capitalize">{dashboardStatus}</div>
                <Badge variant="outline" className={statusColor + " border-0"}>{sensorOffline ? "No live data" : <span className="font-bitcount-grid-single">{evaluation.score}/100</span>}</Badge>
              </div>
              <p className="mt-3 text-white/90 max-w-md">
                {sensorOffline
                  ? "The pond condition cannot be confirmed until fresh sensor readings arrive."
                  : evaluation.issues.length === 0 ? "All parameters are within optimal range." : evaluation.issues.join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-x-6 gap-y-3">
              <div className="shrink-0 text-xs font-mono text-white/90">
                Last reading · {latest ? format(new Date(latest.recorded_at), "MMM d, HH:mm") : "None yet"}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <MiniStat icon={Fish} label="Growth records" value={growthCount.toString()} />
                <MiniStat icon={TrendingUp} label="Ponds" value={pondCount.toString()} />
              </div>
            </div>
          </div>
          {highlightAlert && (
            <div className={`grid min-w-0 transition-[grid-template-rows,margin-top,opacity,transform] duration-300 ease-in-out motion-reduce:transition-none sm:overflow-visible ${
              isDismissingAlert
                ? "mt-0 grid-rows-[0fr] -translate-y-2 overflow-hidden opacity-0 sm:hidden"
                : "mt-5 grid-rows-[1fr] overflow-visible sm:mt-0"
            }`}>
            <div className={`min-h-0 ${isDismissingAlert ? "overflow-hidden" : "overflow-visible"}`}>
            <div className={`relative min-w-0 rounded-xl border p-4 shadow-lg shadow-slate-950/10 backdrop-blur-sm sm:p-5 ${
              highlightAlert.severity === "critical"
                ? "border-rose-200 bg-rose-50/95 text-slate-950 dark:border-rose-400/30 dark:bg-rose-950/70 dark:text-rose-50"
                : "border-amber-200 bg-amber-50/95 text-slate-950 dark:border-amber-400/30 dark:bg-amber-950/70 dark:text-amber-50"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  highlightAlert.severity === "critical"
                    ? "bg-destructive/15 text-destructive-text"
                    : "bg-warning/15 text-warning"
                }`}>
                  <Siren className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pr-12 sm:pr-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`max-w-full text-[10px] uppercase tracking-wider ${
                          highlightAlert.severity === "critical"
                            ? "border-destructive/40 text-destructive-text"
                            : "border-warning/40 text-warning"
                        }`}
                      >
                        <span className="break-words font-coolvetica">{highlightAlert.severity}{" \u00b7 "}{getAlertStatusLabel(highlightAlert)}</span>
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        First detected {format(new Date(highlightAlert.created_at), "MMM d \u00b7 HH:mm")}
                      </span>
                    </div>
                    <button
                      onClick={() => dismissAlert(highlightAlert.id)}
                      className="absolute right-4 top-4 text-xs text-muted-foreground hover:text-foreground sm:static sm:ml-auto"
                      aria-label="Dismiss"
                      disabled={isDismissingAlert}
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="mt-2 break-words text-[15px] font-semibold leading-snug">{highlightAlert.message}</div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    Last detected {format(new Date(highlightAlert.last_detected_at ?? highlightAlert.created_at), "MMM d \u00b7 HH:mm")}
                    {formatAlertReading(highlightAlert) && <span className="mt-1 block sm:mt-0 sm:inline"><span className="hidden sm:inline">{" \u00b7 "}</span>Latest value <span className="font-bitcount-grid-single">{formatAlertReading(highlightAlert)}</span></span>}
                  </div>
                </div>
              </div>
              {highlightAlert.recommendation && (
                <>
                  <Collapsible key={highlightAlert.id} className="mt-3 rounded-lg border border-border/70 bg-muted/70 text-foreground sm:hidden">
                    <CollapsibleTrigger className="group flex w-full items-center gap-2 p-3 text-left text-sm font-medium">
                      <Lightbulb className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      <span className="flex-1">Recommendation</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[batch-details-open_180ms_ease-out] data-[state=closed]:animate-[batch-details-close_180ms_ease-out] motion-reduce:animate-none">
                      <p className="break-words px-3 pb-3 text-sm">{highlightAlert.recommendation}</p>
                    </CollapsibleContent>
                  </Collapsible>
                  <div className="mt-3 hidden items-start gap-2 rounded-lg border border-border/70 bg-muted/70 p-3 text-sm text-foreground sm:flex">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="break-words">{highlightAlert.recommendation}</span>
                  </div>
                </>
              )}
            </div>
            </div>
            </div>
          )}
        </div>
      </Card>

      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sensor Readings</h2>
          <p className="text-sm text-muted-foreground">Latest water quality values from your pond.</p>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {sensors.map((s, i) => (
          <div
            key={i}
            className="stat-tile animate-fade-in p-3 hover-scale sm:p-5"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              {sensorOffline
                ? <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[10px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Offline</Badge>
                : <Badge variant="outline" className="gap-1.5 border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Online
                  </Badge>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              {!sensorOffline && latest && s.val != null && (
                <span
                  className={`ripple-dot ${s.ok ? "bg-success" : "bg-destructive"}`}
                  role="img"
                  aria-label={s.ok ? "Within range" : "Outside range"}
                  title={s.ok ? "Within range" : "Outside range"}
                />
              )}
            </div>
            <div className="mt-1 text-2xl font-bitcount-grid-single sm:text-3xl">
              {s.val != null ? (
                <span className="inline-block motion-safe:animate-[metric-number-enter_450ms_ease-out_both]">
                  <AnimatedNumber value={Number(s.val)} decimals={2} />
                </span>
              ) : <span>—</span>}
              <span className="text-sm text-muted-foreground ml-1">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 lg:col-span-2" aria-labelledby="water-quality-trends-title">
          <div className="mb-4">
            <h3 id="water-quality-trends-title" className="font-semibold">Water quality trends</h3>
            <p className="text-xs text-muted-foreground">Separate scales for each parameter · latest 24 readings</p>
          </div>
          {history.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={Activity} title="No sensor readings available yet." description="Charts will populate as data flows in." />
            </Card>
          ) : (
            <div key={history[history.length - 1]?.id ?? history.length} className="grid animate-fade-in gap-4 sm:grid-cols-2">
              {chartSeries.map(series => {
                const hasReadings = chartData.some(reading => reading[series.key] != null);

                return (
                  <Card key={series.key} className="min-w-0 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="truncate text-sm font-medium">{series.name}</h4>
                      {series.unit && <span className="shrink-0 text-xs text-muted-foreground">{series.unit}</span>}
                    </div>
                    {hasReadings ? (
                      <div className="h-48 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} minTickGap={20} />
                            <YAxis
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={10}
                              width={42}
                              tickCount={4}
                              tickFormatter={value => Number(value).toFixed(series.decimals)}
                            />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                              formatter={value => [`${Number(value).toFixed(2)}${series.unit ? ` ${series.unit}` : ""}`, series.name]}
                            />
                            <Line
                              type="monotone"
                              dataKey={series.key}
                              name={series.name}
                              stroke={series.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive
                              animationDuration={500}
                              animationEasing="ease-out"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="grid h-48 place-items-center rounded-lg bg-secondary/30 px-4 text-center text-xs text-muted-foreground">
                        No {series.name.toLowerCase()} readings in this period.
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card className="min-w-0 p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Alerts & Recommendations</h3>
            <Badge variant="outline" className="shrink-0 gap-1 border-border bg-muted/50 text-muted-foreground">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              Active alerts {activeAlertCount}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Current incidents across the pond</p>
          {alerts.length === 0 && !sensorOffline ? (
            <EmptyState icon={AlertCircle} title="All clear" description="No active alerts at this time." />
          ) : (
            <div className="space-y-3">
              {sensorOffline && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-amber-300 bg-amber-100 font-coolvetica text-[10px] text-amber-900 uppercase dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Offline</Badge>
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-coolvetica text-[10px] uppercase">{a.severity}</Badge>
                      <Badge variant="outline" className="font-coolvetica text-[10px]">{getAlertStatusLabel(a)}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(a.last_detected_at ?? a.created_at), "MMM d · HH:mm")}</span>
                  </div>
                  <div className="text-sm font-medium mt-2">{a.message}</div>
                  {formatAlertReading(a) && <div className="mt-1 text-xs text-muted-foreground">Latest value: <span className="font-bitcount-grid-single">{formatAlertReading(a)}</span></div>}
                  {a.recommendation && <div className="text-xs text-muted-foreground mt-1">→ {a.recommendation}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      </>}
    </AppShell>
  );
};

type MiniStatProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

const MiniStat = ({ icon: Icon, label, value }: MiniStatProps) => (
  <div className="flex items-center gap-2">
    <Icon className="h-[13px] w-[13px] shrink-0 text-white/80" aria-hidden="true" />
    <span className="text-[11px] uppercase tracking-wider text-white/90">{label}</span>
    <span className="font-bitcount-grid-single text-[13.5px] font-semibold text-white">{value}</span>
  </div>
);

export default Dashboard;
