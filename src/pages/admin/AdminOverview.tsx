import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, Bell, Database, Fish, Waves, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type OverviewCounts = {
  ponds: number;
  readings: number;
  alerts: number;
  openAlerts: number;
  historicalAlerts: number;
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
  last_detected_at: string | null;
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

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy · h:mm a");
};

const formatMetric = (label: string, value: number | null, unit: string) =>
  value == null ? null : label + " " + Number(value).toFixed(2) + (unit ? " " + unit : "");

const severityClass = (severity: string) => {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "high") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      try {
        const [
          pondsResult,
          readingsResult,
          alertsResult,
          openAlertsResult,
          totalAlertsResult,
          growthResult,
          usersResult,
          recentReadingsResult,
          recentAlertsResult,
        ] = await Promise.all([
          supabase.from("pond_profiles").select("id", { count: "exact", head: true }),
          supabase.from("sensor_readings").select("id", { count: "exact", head: true }),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active").eq("acknowledged", false),
          supabase.from("alerts").select("id", { count: "exact", head: true }),
          supabase.from("bangus_growth_records").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("sensor_readings")
            .select("id,recorded_at,do_mg_l,ph,temperature_c,turbidity_ntu,pond_profiles(name)")
            .order("recorded_at", { ascending: false })
            .limit(5),
          supabase.from("alerts")
            .select("id,created_at,last_detected_at,last_sensor_value,sensor_type,condition_key,category,severity,message,acknowledged,status,pond_profiles(name)")
            .order("last_detected_at", { ascending: false, nullsFirst: false })
            .limit(5),
        ]);

        const queryError = [
          pondsResult.error,
          readingsResult.error,
          alertsResult.error,
          openAlertsResult.error,
          totalAlertsResult.error,
          growthResult.error,
          usersResult.error,
          recentReadingsResult.error,
          recentAlertsResult.error,
        ].find(Boolean);

        if (queryError) throw queryError;
        if (!mounted) return;

        setCounts({
          ponds: pondsResult.count ?? 0,
          readings: readingsResult.count ?? 0,
          alerts: alertsResult.count ?? 0,
          openAlerts: openAlertsResult.count ?? 0,
          historicalAlerts: Math.max(0, (totalAlertsResult.count ?? 0) - (alertsResult.count ?? 0)),
          growth: growthResult.count ?? 0,
          users: usersResult.count ?? 0,
        });
        setRecentReadings((recentReadingsResult.data ?? []) as unknown as SensorActivity[]);
        setRecentAlerts((recentAlertsResult.data ?? []) as unknown as AlertActivity[]);
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

  const tiles = [
    { icon: Waves, label: "Pond profiles", value: counts?.ponds, detail: "Registered pond profiles", href: "/admin/ponds", tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" },
    { icon: Database, label: "Sensor readings", value: counts?.readings, detail: "All recorded measurements", href: "/admin/sensors", tone: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
    { icon: Bell, label: "Active alerts", value: counts?.alerts, detail: counts ? counts.openAlerts.toLocaleString() + " unacknowledged · " + counts.historicalAlerts.toLocaleString() + " historical" : "Incident totals", href: "/admin/alerts", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
    { icon: Fish, label: "Growth records", value: counts?.growth, detail: "Fish measurements logged", href: "/admin/growth", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
    { icon: Users, label: "Users", value: counts?.users, detail: "Registered user profiles", href: "/admin/users", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  ];

  return (
    <AppShell admin>
      <PageHeader title="Admin Console" subtitle="System-wide visibility for IntelliPond." />

      {error && (
        <Card className="mb-5 border-destructive/40 p-4 text-sm text-destructive" role="alert">
          Could not load all overview data: {error}
        </Card>
      )}

      <section aria-label="System totals" className="mb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map(tile => (
            <Link
              key={tile.label}
              to={tile.href}
              className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  {loading ? "—" : counts ? (tile.value ?? 0).toLocaleString() : "—"}
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
          <p className="mt-1 text-sm text-muted-foreground">The latest sensor readings and alerts across IntelliPond.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Database className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Latest sensor readings</h3>
                  <p className="text-xs text-muted-foreground">Most recent measurements</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link to="/admin/sensors">View all <ArrowUpRight aria-hidden="true" /></Link>
              </Button>
            </div>

            {loading ? (
              <p className="px-5 py-8 text-sm text-muted-foreground" role="status">Loading readings…</p>
            ) : error ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">Recent readings are unavailable.</p>
            ) : recentReadings.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">No sensor readings have been recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentReadings.map(reading => {
                  const metrics = [
                    formatMetric("DO", reading.do_mg_l, "mg/L"),
                    formatMetric("pH", reading.ph, ""),
                    formatMetric("Temp.", reading.temperature_c, "°C"),
                    formatMetric("Turbidity", reading.turbidity_ntu, "NTU"),
                  ].filter((metric): metric is string => Boolean(metric));

                  return (
                    <li key={reading.id} className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="font-medium">{reading.pond_profiles?.name ?? "Unassigned pond"}</span>
                        <time className="text-xs text-muted-foreground" dateTime={reading.recorded_at}>
                          {formatTimestamp(reading.recorded_at)}
                        </time>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {metrics.length ? metrics.join(" · ") : "No sensor values available"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Recent alerts</h3>
                  <p className="text-xs text-muted-foreground">Newest system notifications</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link to="/admin/alerts">View all <ArrowUpRight aria-hidden="true" /></Link>
              </Button>
            </div>

            {loading ? (
              <p className="px-5 py-8 text-sm text-muted-foreground" role="status">Loading alerts…</p>
            ) : error ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">Recent alerts are unavailable.</p>
            ) : recentAlerts.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">No alerts have been recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentAlerts.map(alert => (
                  <li key={alert.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={"capitalize " + severityClass(alert.severity)}>{alert.severity}</Badge>
                      <Badge variant="outline" className="font-normal">{alert.status === "legacy_archived" ? "Legacy record" : alert.status === "resolved" ? "Resolved" : alert.acknowledged ? "Acknowledged" : "Unacknowledged"}</Badge>
                      <span className="text-xs capitalize text-muted-foreground">{(alert.condition_key ?? alert.category).replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium">{alert.message}</p>
                    {alert.last_sensor_value != null && <p className="mt-1 text-xs text-muted-foreground">Latest value: {Number(alert.last_sensor_value).toFixed(2)}{alert.sensor_type?.toLowerCase() === "do" ? " mg/L" : alert.sensor_type === "temperature" ? " °C" : alert.sensor_type === "turbidity" ? " NTU" : ""}</p>}
                    <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{alert.pond_profiles?.name ?? "Pond not specified"}</span>
                      <time dateTime={alert.last_detected_at ?? alert.created_at}>Last detected {formatTimestamp(alert.last_detected_at ?? alert.created_at)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </AppShell>
  );
};

export default AdminOverview;
