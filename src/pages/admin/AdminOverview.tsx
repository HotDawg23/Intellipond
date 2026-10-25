import { useEffect, useState } from "react";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Database, Fish, Waves, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { alertHistoryCutoff } from "@/lib/alertFilters";

type OverviewCounts = {
  ponds: number;
  readings: number;
  alerts: number;
  openAlerts: number;
  olderAlerts: number;
  growth: number;
  users: number;
};

type SensorActivity = {
  id: string;
  recorded_at: string;
  do_mg_l: number | null;
  ph: number | null;
  temperature_c: number | null;
  turbidity_ntu: number | null;
  pond_profiles: { name: string } | null;
};

type AlertActivity = {
  id: string;
  created_at: string;
  last_sensor_value: number | null;
  sensor_type: string | null;
  condition_key: string | null;
  category: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  status: string;
  pond_profiles: { name: string } | null;
};

type ActivityDay = { date: string; label: string; readings: number; alerts: number };

const ACTIVITY_PAGE_SIZE = 3;

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy · h:mm a");
};

const formatMetric = (label: string, value: number | null, unit: string) =>
  value == null ? null : label + " " + Number(value).toFixed(2) + (unit ? " " + unit : "");

const severityClass = (severity: string) => {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "high") {
    return "border-destructive/30 bg-destructive/10 text-destructive-text";
  }
  if (normalized === "warning" || normalized === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-border bg-muted text-muted-foreground";
};

const AdminOverview = () => {
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [recentReadings, setRecentReadings] = useState<SensorActivity[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertActivity[]>([]);
  const [recentReadingsCount, setRecentReadingsCount] = useState(0);
  const [recentAlertsCount, setRecentAlertsCount] = useState(0);
  const [readingsPage, setReadingsPage] = useState(0);
  const [alertsPage, setAlertsPage] = useState(0);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readingsLoading, setReadingsLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [readingsError, setReadingsError] = useState("");
  const [alertsError, setAlertsError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      try {
        const cutoff = alertHistoryCutoff();
        const now = new Date();
        const nowIso = now.toISOString();
        const days = Array.from({ length: 7 }, (_, index) => startOfDay(subDays(now, 6 - index)));
        const activityResults = days.map(async (day) => {
          const start = day.toISOString();
          const end = addDays(day, 1).toISOString();
          const [readings, alerts] = await Promise.all([
            supabase.from("sensor_readings").select("id", { count: "exact", head: true }).gte("recorded_at", start).lt("recorded_at", end).lte("recorded_at", nowIso),
            supabase.from("alerts").select("id", { count: "exact", head: true }).neq("status", "legacy_archived").gte("created_at", start).lt("created_at", end).lte("created_at", nowIso),
          ]);
          if (readings.error) throw readings.error;
          if (alerts.error) throw alerts.error;
          return { date: format(day, "MMM d"), label: format(day, "EEEE, MMMM d"), readings: readings.count ?? 0, alerts: alerts.count ?? 0 };
        });
        const [
          pondsResult,
          readingsResult,
          alertsResult,
          openAlertsResult,
          olderAlertsResult,
          growthResult,
          usersResult,
          dailyActivity,
        ] = await Promise.all([
          supabase.from("pond_profiles").select("id", { count: "exact", head: true }),
          supabase.from("sensor_readings").select("id", { count: "exact", head: true }),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active").eq("acknowledged", false),
          supabase.from("alerts").select("id", { count: "exact", head: true }).lt("created_at", cutoff).neq("status", "active"),
          supabase.from("bangus_growth_records").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          Promise.all(activityResults),
        ]);

        const queryError = [
          pondsResult.error,
          readingsResult.error,
          alertsResult.error,
          openAlertsResult.error,
          olderAlertsResult.error,
          growthResult.error,
          usersResult.error,
        ].find(Boolean);

        if (queryError) throw queryError;
        if (!mounted) return;

        setCounts({
          ponds: pondsResult.count ?? 0,
          readings: readingsResult.count ?? 0,
          alerts: alertsResult.count ?? 0,
          openAlerts: openAlertsResult.count ?? 0,
          olderAlerts: olderAlertsResult.count ?? 0,
          growth: growthResult.count ?? 0,
          users: usersResult.count ?? 0,
        });
        setActivityDays(dailyActivity);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the admin overview.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadOverview();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadRecentReadings = async () => {
      setReadingsLoading(true);
      setReadingsError("");
      const now = new Date();
      try {
        const result = await supabase.from("sensor_readings")
          .select("id,recorded_at,do_mg_l,ph,temperature_c,turbidity_ntu,pond_profiles(name)", { count: "exact" })
          .gte("recorded_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .lte("recorded_at", now.toISOString())
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: false })
          .range(readingsPage * ACTIVITY_PAGE_SIZE, (readingsPage + 1) * ACTIVITY_PAGE_SIZE - 1);
        if (result.error) throw result.error;
        if (!mounted) return;
        const lastPage = Math.max(0, Math.ceil((result.count ?? 0) / ACTIVITY_PAGE_SIZE) - 1);
        if (readingsPage > lastPage) {
          setReadingsPage(lastPage);
          return;
        }
        setRecentReadings((result.data ?? []) as unknown as SensorActivity[]);
        setRecentReadingsCount(result.count ?? 0);
      } catch (loadError) {
        if (mounted) setReadingsError(loadError instanceof Error ? loadError.message : "Could not load recent readings.");
      } finally {
        if (mounted) setReadingsLoading(false);
      }
    };
    void loadRecentReadings();
    return () => { mounted = false; };
  }, [readingsPage]);

  useEffect(() => {
    let mounted = true;
    const loadRecentAlerts = async () => {
      setAlertsLoading(true);
      setAlertsError("");
      const now = new Date();
      try {
        const result = await supabase.from("alerts")
          .select("id,created_at,last_sensor_value,sensor_type,condition_key,category,severity,message,acknowledged,status,pond_profiles(name)", { count: "exact" })
          .neq("status", "legacy_archived")
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .lte("created_at", now.toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(alertsPage * ACTIVITY_PAGE_SIZE, (alertsPage + 1) * ACTIVITY_PAGE_SIZE - 1);
        if (result.error) throw result.error;
        if (!mounted) return;
        const lastPage = Math.max(0, Math.ceil((result.count ?? 0) / ACTIVITY_PAGE_SIZE) - 1);
        if (alertsPage > lastPage) {
          setAlertsPage(lastPage);
          return;
        }
        setRecentAlerts((result.data ?? []) as unknown as AlertActivity[]);
        setRecentAlertsCount(result.count ?? 0);
      } catch (loadError) {
        if (mounted) setAlertsError(loadError instanceof Error ? loadError.message : "Could not load recent alerts.");
      } finally {
        if (mounted) setAlertsLoading(false);
      }
    };
    void loadRecentAlerts();
    return () => { mounted = false; };
  }, [alertsPage]);

  const tiles = [
    { icon: Waves, label: "Pond profiles", value: counts?.ponds, detail: "Registered pond profiles", href: "/admin/ponds", tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" },
    { icon: Database, label: "Sensor readings", value: counts?.readings, detail: "All recorded measurements", href: "/admin/sensors", tone: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
    { icon: Bell, label: "Active alerts", value: counts?.alerts, detail: counts ? <><span>{counts.openAlerts.toLocaleString()} unacknowledged</span><span className="block sm:inline"><span className="hidden sm:inline"> · </span>{counts.olderAlerts.toLocaleString()} older alerts</span></> : "Incident totals", href: "/admin/alerts", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
    { icon: Fish, label: "Growth records", value: counts?.growth, detail: "Fish measurements logged", href: "/admin/growth", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
    { icon: Users, label: "Users", value: counts?.users, detail: "Registered user profiles", href: "/admin/users", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  ];
  const maxReadings = Math.max(1, ...activityDays.map(day => day.readings));
  const maxAlerts = Math.max(1, ...activityDays.map(day => day.alerts));
  const activityTotals = activityDays.reduce((totals, day) => ({ readings: totals.readings + day.readings, alerts: totals.alerts + day.alerts }), { readings: 0, alerts: 0 });
  const readingsPageCount = Math.ceil(recentReadingsCount / ACTIVITY_PAGE_SIZE);
  const alertsPageCount = Math.ceil(recentAlertsCount / ACTIVITY_PAGE_SIZE);

  return (
    <AppShell admin>
      <PageHeader title="Admin Console" subtitle="System-wide visibility for IntelliPond." />

      {error && (
        <Card className="mb-5 border-destructive/40 p-4 text-sm text-destructive-text" role="alert">
          Could not load all overview data: {error}
        </Card>
      )}

      <section aria-label="System totals" className="mb-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map(tile => (
            <Link
              key={tile.label}
              to={tile.href}
              className={`group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${tile.label === "Sensor readings" ? "order-first col-span-2 sm:order-none sm:col-span-1" : ""}`}
            >
              <Card className="h-full border-border/80 p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50 group-hover:shadow-md sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className={"grid h-10 w-10 place-items-center rounded-xl " + tile.tone}>
                    <tile.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <ArrowUpRight className="mt-1 h-4 w-4 text-muted-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
                <div className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{tile.label}</div>
                <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                  {loading || !counts ? "—" : (
                    <span className="inline-block motion-safe:animate-[metric-number-enter_450ms_ease-out_both]">
                      <AnimatedNumber value={tile.value ?? 0} startAtZero />
                    </span>
                  )}
                </div>
                <p className="mt-2 min-h-5 text-xs text-muted-foreground">{tile.detail}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-activity-heading" className="space-y-4">
        <div>
          <h2 id="recent-activity-heading" className="text-xl font-semibold tracking-tight">Recent activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Seven-day activity and new events from the last 24 hours.</p>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden p-4 sm:p-5 xl:h-[42rem]">
            <h3 className="font-semibold">Activity over 7 days</h3>
            <p className="mt-1 text-xs text-muted-foreground">Daily totals based on when readings were recorded and alerts were raised.</p>
            {loading ? (
              <p className="py-8 text-sm text-muted-foreground" role="status">Loading activity…</p>
            ) : error ? (
              <p className="py-8 text-sm text-muted-foreground">Activity is unavailable.</p>
            ) : (
              <div className="mt-6 space-y-10 xl:flex xl:h-[calc(100%-5rem)] xl:flex-col xl:justify-evenly xl:space-y-0">
                {([
                  { key: "readings" as const, title: "Sensor readings", total: activityTotals.readings, max: maxReadings, color: "bg-cyan-500" },
                  { key: "alerts" as const, title: "New alerts", total: activityTotals.alerts, max: maxAlerts, color: "bg-amber-500" },
                ]).map(series => (
                  <div key={series.key}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h4 className="text-sm font-medium">{series.title}</h4>
                      <span className="text-sm font-semibold tabular-nums">{series.total.toLocaleString()} <span className="font-normal text-muted-foreground">total</span></span>
                    </div>
                    <div className="grid grid-cols-7 gap-2" role="list" aria-label={`${series.title} per day`}>
                      {activityDays.map((day, index) => (
                        <div key={day.date} role="listitem" className="min-w-0 text-center" aria-label={`${day.label}: ${day[series.key]} ${series.title.toLowerCase()}`}>
                          <span className="block text-xs font-medium tabular-nums">{day[series.key].toLocaleString()}</span>
                          <div className="mt-2 flex h-28 items-end rounded-md bg-muted/50 sm:h-32">
                            <div
                              className={`w-full origin-bottom rounded-md motion-safe:animate-[activity-bar-grow_550ms_ease-out_both] ${series.color}`}
                              style={{
                                height: day[series.key] ? `${Math.max(8, day[series.key] / series.max * 100)}%` : "0%",
                                animationDelay: `${index * 55 + (series.key === "alerts" ? 100 : 0)}ms`,
                              }}
                            />
                          </div>
                          <span className="mt-2 block truncate text-[10px] text-muted-foreground sm:text-xs" aria-hidden="true">{day.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Each chart uses its own scale.</p>
              </div>
            )}
          </Card>

          <div className="space-y-4 xl:flex xl:h-[42rem] xl:flex-col xl:gap-4 xl:space-y-0">
            <Card className="overflow-hidden xl:flex xl:h-[20.5rem] xl:min-h-0 xl:flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">Recent alerts</h3>
                    <p className="text-xs text-muted-foreground">Raised in the last 24 hours</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/admin/alerts">View all <ArrowUpRight aria-hidden="true" /></Link>
                </Button>
              </div>

              {alertsLoading ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground" role="status">Loading alerts…</p>
              ) : alertsError ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground">Recent alerts are unavailable.</p>
              ) : recentAlerts.length === 0 ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground">No new alerts in the last 24 hours.</p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-hidden">
                  {recentAlerts.map(alert => (
                    <li key={alert.id} className="px-3 py-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Badge variant="outline" className={"shrink-0 px-1.5 py-0 text-[10px] capitalize " + severityClass(alert.severity)}>{alert.severity}</Badge>
                        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">{alert.status === "legacy_archived" ? "Legacy" : alert.status === "resolved" ? "Resolved" : alert.acknowledged ? "Acknowledged" : "Unacknowledged"}</Badge>
                        <span className="truncate text-[11px] capitalize text-muted-foreground">{(alert.condition_key ?? alert.category).replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs font-medium">{alert.message}</p>
                      <div className="mt-0.5 flex min-w-0 justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate">
                          {alert.pond_profiles?.name ?? "Pond not specified"}
                          {alert.last_sensor_value != null && ` · ${Number(alert.last_sensor_value).toFixed(2)}${alert.sensor_type?.toLowerCase() === "do" ? " mg/L" : alert.sensor_type === "temperature" ? " °C" : alert.sensor_type === "turbidity" ? " NTU" : ""}`}
                        </span>
                        <time className="shrink-0" dateTime={alert.created_at}>{formatTimestamp(alert.created_at)}</time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {alertsPageCount > 1 && (
                <div className="flex min-h-10 shrink-0 items-center justify-between border-t border-border px-3">
                  <span className="text-xs text-muted-foreground">Page {alertsPage + 1} of {alertsPageCount}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className={`h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent] ${alertsLoading && alertsPage !== 0 ? "disabled:opacity-100" : ""}`} disabled={alertsLoading || alertsPage === 0} onClick={() => setAlertsPage(page => page - 1)} aria-label="Previous alert page">
                      <ArrowLeft aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" className={`h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent] ${alertsLoading && alertsPage < alertsPageCount - 1 ? "disabled:opacity-100" : ""}`} disabled={alertsLoading || alertsPage >= alertsPageCount - 1} onClick={() => setAlertsPage(page => page + 1)} aria-label="Next alert page">
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card className="overflow-hidden xl:flex xl:h-[20.5rem] xl:min-h-0 xl:flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                    <Database className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">Latest sensor readings</h3>
                    <p className="text-xs text-muted-foreground">Recorded in the last 24 hours</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/admin/sensors">View all <ArrowUpRight aria-hidden="true" /></Link>
                </Button>
              </div>

              {readingsLoading ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground" role="status">Loading readings…</p>
              ) : readingsError ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground">Recent readings are unavailable.</p>
              ) : recentReadings.length === 0 ? (
                <p className="flex flex-1 items-center justify-center px-5 py-8 text-sm text-muted-foreground">No new sensor readings in the last 24 hours.</p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-hidden">
                  {recentReadings.map(reading => {
                    const metrics = [
                      formatMetric("DO", reading.do_mg_l, "mg/L"),
                      formatMetric("pH", reading.ph, ""),
                      formatMetric("Temp.", reading.temperature_c, "°C"),
                      formatMetric("Turbidity", reading.turbidity_ntu, "NTU"),
                    ].filter((metric): metric is string => Boolean(metric));

                    return (
                      <li key={reading.id} className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="font-medium">{reading.pond_profiles?.name ?? "Unassigned pond"}</span>
                          <time className="text-xs text-muted-foreground" dateTime={reading.recorded_at}>
                            {formatTimestamp(reading.recorded_at)}
                          </time>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">
                          {metrics.length ? metrics.join(" · ") : "No sensor values available"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {readingsPageCount > 1 && (
                <div className="flex min-h-10 shrink-0 items-center justify-between border-t border-border px-3">
                  <span className="text-xs text-muted-foreground">Page {readingsPage + 1} of {readingsPageCount}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className={`h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent] ${readingsLoading && readingsPage !== 0 ? "disabled:opacity-100" : ""}`} disabled={readingsLoading || readingsPage === 0} onClick={() => setReadingsPage(page => page - 1)} aria-label="Previous sensor reading page">
                      <ArrowLeft aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" className={`h-11 w-11 hover:bg-transparent hover:text-inherit [-webkit-tap-highlight-color:transparent] ${readingsLoading && readingsPage < readingsPageCount - 1 ? "disabled:opacity-100" : ""}`} disabled={readingsLoading || readingsPage >= readingsPageCount - 1} onClick={() => setReadingsPage(page => page + 1)} aria-label="Next sensor reading page">
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default AdminOverview;
