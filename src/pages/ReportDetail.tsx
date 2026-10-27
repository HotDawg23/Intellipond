import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import AlertPagination from "@/components/AlertPagination";
import { EmptyState, LoadError, LoadingState } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getReportSnapshot, type Report, type ReportParameter } from "@/lib/report-snapshot";

const manilaDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateTime = (value: string | null) => value ? manilaDateTime.format(new Date(value)) : "—";
const valueWithUnit = (value: number | null, unit = "") =>
  value === null ? "—" : `${Number(value).toFixed(2)}${unit ? ` ${unit}` : ""}`;
const changeWithUnit = (value: number | null, unit: string) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${Number(value).toFixed(2)} ${unit}`;
const REPORT_ALERT_PAGE_SIZE = 2;

const ReportDetail = ({ admin = false }: { admin?: boolean }) => {
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [alertPage, setAlertPage] = useState(0);
  const basePath = admin ? "/admin/reports" : "/dashboard/reports";

  const load = useCallback(async () => {
    setLoadError("");
    setAlertPage(0);
    if (!id) return;
    try {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      setReport(data);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load report: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const snapshot = report ? getReportSnapshot(report) : null;
  const parameters: { label: string; unit: string; stats: ReportParameter; latest: number | null }[] = snapshot ? [
    { label: "Dissolved O₂", unit: "mg/L", stats: snapshot.readings.do_mg_l, latest: snapshot.readings.latest?.do_mg_l ?? null },
    { label: "pH", unit: "", stats: snapshot.readings.ph, latest: snapshot.readings.latest?.ph ?? null },
    { label: "Temperature", unit: "°C", stats: snapshot.readings.temperature_c, latest: snapshot.readings.latest?.temperature_c ?? null },
    { label: "Turbidity", unit: "NTU", stats: snapshot.readings.turbidity_ntu, latest: snapshot.readings.latest?.turbidity_ntu ?? null },
  ] : [];
  const notesCard = report && (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Notes and actions</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
        {report.description || "No additional notes were recorded."}
      </p>
    </Card>
  );

  return (
    <AppShell admin={admin}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={basePath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to reports
        </Link>
        {snapshot && <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print or save PDF</Button>}
      </div>
      {loadError && <div className="mb-3"><LoadError message={loadError} onRetry={() => void load()} /></div>}
      {!hasLoaded ? (loadError ? null : <Card><LoadingState label="Loading report" /></Card>) : !report ? (
        <EmptyState icon={FileText} title="Report not found." description="This report may have been removed or is not shared with you." />
      ) : !snapshot ? (
        <Card className="p-6">
          <h1 className="text-2xl font-semibold">{report.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">This older entry has no generated data snapshot.</p>
          {report.description && <p className="mt-5 whitespace-pre-wrap">{report.description}</p>}
        </Card>
      ) : (
        <article className="report-print-area space-y-5">
          <header className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">IntelliPond pond report</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{report.title}</h1>
            <p className="mt-2 text-muted-foreground">
              {snapshot.pond_name}{snapshot.batch_name ? ` · ${snapshot.batch_name}` : ""}
            </p>
            <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-2">
              <span>Period: {report.period_start} to {report.period_end}</span>
              <span>Generated: {dateTime(snapshot.generated_at)} by an administrator</span>
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Data coverage</h2>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Sensor readings</p><p className="text-xl font-semibold tabular-nums">{snapshot.readings.count}</p></div>
                <div><p className="text-muted-foreground">Alerts raised</p><p className="text-xl font-semibold tabular-nums">{snapshot.alerts.count}</p></div>
                <div><p className="text-muted-foreground">Growth measurements</p><p className="text-xl font-semibold tabular-nums">{snapshot.growth.count}</p></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Reading range: {dateTime(snapshot.readings.first_at)} to {dateTime(snapshot.readings.last_at)}.
                {snapshot.readings.count === 0 && " No sensor readings were recorded in this period."}
              </p>
            </Card>
            {notesCard}
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-border p-5 sm:px-6">
              <h2 className="text-lg font-semibold">Water quality</h2>
              <p className="text-sm text-muted-foreground">Measured sensor values in the selected period.</p>
            </div>
            <div className="divide-y divide-border sm:hidden">
              {parameters.map(parameter => (
                <div key={parameter.label} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">{parameter.label}</h3>
                    <span className="text-xs text-muted-foreground">{parameter.stats.count} samples</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Latest</p><p className="tabular-nums">{valueWithUnit(parameter.latest, parameter.unit)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Average</p><p className="tabular-nums">{valueWithUnit(parameter.stats.average, parameter.unit)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Minimum</p><p className="tabular-nums">{valueWithUnit(parameter.stats.min, parameter.unit)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Maximum</p><p className="tabular-nums">{valueWithUnit(parameter.stats.max, parameter.unit)}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-5 py-3">Parameter</th><th className="px-3 py-3">Latest</th><th className="px-3 py-3">Average</th><th className="px-3 py-3">Minimum</th><th className="px-3 py-3">Maximum</th><th className="px-5 py-3">Samples</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parameters.map(parameter => (
                    <tr key={parameter.label}>
                      <th scope="row" className="px-5 py-3 font-medium">{parameter.label}</th>
                      <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.latest, parameter.unit)}</td>
                      <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.stats.average, parameter.unit)}</td>
                      <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.stats.min, parameter.unit)}</td>
                      <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.stats.max, parameter.unit)}</td>
                      <td className="px-5 py-3 tabular-nums">{parameter.stats.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {snapshot.readings.latest && <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Latest reading: {dateTime(snapshot.readings.latest.at)}</p>}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Alerts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshot.alerts.critical} critical · {snapshot.alerts.warning} warning · {snapshot.alerts.active} still active
              </p>
              {snapshot.alerts.recent.length === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">No alerts were raised in this period.</p>
              ) : (
                <div className="mt-4 divide-y divide-border">
                  {snapshot.alerts.recent.map((alert, index) => (
                    <div key={`${alert.created_at}-${index}`} className={`py-3 first:pt-0 ${index < alertPage * REPORT_ALERT_PAGE_SIZE || index >= (alertPage + 1) * REPORT_ALERT_PAGE_SIZE ? "hidden print:block" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{alert.severity}</Badge>
                        <span className="text-xs text-muted-foreground">{dateTime(alert.created_at)} · {alert.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{alert.message}</p>
                      {alert.recommendation && <p className="mt-1 text-xs text-muted-foreground">Recommendation: {alert.recommendation}</p>}
                    </div>
                  ))}
                  {snapshot.alerts.count > snapshot.alerts.recent.length && (
                    <p className="pt-3 text-xs text-muted-foreground">Showing the latest {snapshot.alerts.recent.length} alerts.</p>
                  )}
                </div>
              )}
              <div className="print:hidden"><AlertPagination page={alertPage} total={snapshot.alerts.recent.length} pageSize={REPORT_ALERT_PAGE_SIZE} onPageChange={setAlertPage} /></div>
            </Card>
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Measured growth</h2>
              {snapshot.growth.count === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">No growth measurements were recorded in this period.</p>
              ) : (
                <div className="mt-4 space-y-4 text-sm">
                  <div className="grid grid-cols-3 gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
                    <span>Measurement</span><span>Weight</span><span>Length</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>First<br /><small className="text-muted-foreground">{dateTime(snapshot.growth.first?.at ?? null)}</small></span>
                    <span className="tabular-nums">{valueWithUnit(snapshot.growth.first?.weight_g ?? null, "g")}</span>
                    <span className="tabular-nums">{valueWithUnit(snapshot.growth.first?.length_cm ?? null, "cm")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>Latest<br /><small className="text-muted-foreground">{dateTime(snapshot.growth.latest?.at ?? null)}</small></span>
                    <span className="tabular-nums">{valueWithUnit(snapshot.growth.latest?.weight_g ?? null, "g")}</span>
                    <span className="tabular-nums">{valueWithUnit(snapshot.growth.latest?.length_cm ?? null, "cm")}</span>
                  </div>
                  {snapshot.batch_name && snapshot.growth.count >= 2 ? (
                    <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 font-medium">
                      <span>Change</span>
                      <span className="tabular-nums">{changeWithUnit(snapshot.growth.weight_change_g, "g")}</span>
                      <span className="tabular-nums">{changeWithUnit(snapshot.growth.length_change_cm, "cm")}</span>
                    </div>
                  ) : (
                    <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                      {snapshot.batch_name
                        ? "At least two measurements are needed to show growth change."
                        : "Growth change is shown only when a report covers one fish batch."}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">This report is a saved snapshot. Dates use the Asia/Manila time zone.</p>
        </article>
      )}
    </AppShell>
  );
};

export default ReportDetail;
