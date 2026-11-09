import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AnimatedResults } from "@/components/AnimatedResults";
import AlertPagination from "@/components/AlertPagination";
import { EmptyState, LoadError, LoadingState } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getReportSnapshot, type Report, type ReportParameter } from "@/lib/report-snapshot";
import type { BatchWaterQualityReference } from "@/lib/batch-water-quality-reference";
import { getResearchEstimateReadingsForReport, RESEARCH_ESTIMATE_SOURCE } from "@/lib/research-estimate-readings";
import { formatReportDateTime as dateTime, formatReportPeriod } from "@/lib/report-dates";

const valueWithUnit = (value: number | null, unit = "") =>
  value === null ? "—" : `${Number(value).toFixed(2)}${unit ? ` ${unit}` : ""}`;
const changeWithUnit = (value: number | null, unit: string) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${Number(value).toFixed(2)} ${unit}`;
const REPORT_ALERT_PAGE_SIZE = 2;

const ReportDetail = ({ admin = false }: { admin?: boolean }) => {
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [waterReference, setWaterReference] = useState<BatchWaterQualityReference | null>(null);
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
      if (data?.fish_batch_id) {
        const referenceResult = await supabase
          .from("batch_water_quality_references")
          .select("*")
          .eq("fish_batch_id", data.fish_batch_id)
          .maybeSingle();
        setWaterReference(referenceResult.error ? null : referenceResult.data);
      } else {
        setWaterReference(null);
      }
      setReport(data);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load report: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const snapshot = report ? getReportSnapshot(report) : null;
  const researchReadings = report && snapshot
    ? getResearchEstimateReadingsForReport(snapshot.pond_name, snapshot.batch_name, report.period_start, report.period_end)
    : [];
  const latestResearchReading = researchReadings[researchReadings.length - 1] ?? null;
  const parameters: { label: string; unit: string; key: "do_mg_l" | "ph" | "temperature_c" | "turbidity_ntu"; stats: ReportParameter; latest: number | null }[] = snapshot ? [
    { label: "Dissolved O₂", unit: "mg/L", key: "do_mg_l", stats: snapshot.readings.do_mg_l, latest: snapshot.readings.latest?.do_mg_l ?? null },
    { label: "pH", unit: "", key: "ph", stats: snapshot.readings.ph, latest: snapshot.readings.latest?.ph ?? null },
    { label: "Temperature", unit: "°C", key: "temperature_c", stats: snapshot.readings.temperature_c, latest: snapshot.readings.latest?.temperature_c ?? null },
    { label: "Turbidity", unit: "NTU", key: "turbidity_ntu", stats: snapshot.readings.turbidity_ntu, latest: snapshot.readings.latest?.turbidity_ntu ?? null },
  ] : [];
  const parametersWithReferences = parameters.map(parameter => {
    const referenceValue = parameter.key === "do_mg_l" ? waterReference?.do_mg_l
      : parameter.key === "ph" ? waterReference?.ph
        : parameter.key === "temperature_c" ? waterReference?.temperature_c
          : waterReference?.turbidity_ntu;
    const estimateValues = researchReadings.map(reading => reading[parameter.key]);
    const hasResearchSamples = parameter.stats.count === 0 && estimateValues.length > 0;
    const researchAverage = hasResearchSamples
      ? estimateValues.reduce((sum, value) => sum + value, 0) / estimateValues.length
      : null;
    const averageFromReference = !hasResearchSamples && parameter.stats.count === 0 && parameter.stats.average == null && referenceValue != null;
    const stats = hasResearchSamples ? {
      count: estimateValues.length,
      average: researchAverage,
      min: Math.min(...estimateValues),
      max: Math.max(...estimateValues),
    } : parameter.stats;
    return {
      ...parameter,
      latest: parameter.latest ?? (hasResearchSamples ? latestResearchReading?.[parameter.key] ?? null : null),
      stats,
      average: parameter.stats.average ?? researchAverage ?? (averageFromReference ? referenceValue : null),
      averageFromReference,
      isResearchEstimate: hasResearchSamples || averageFromReference,
    };
  });
  const hasReferenceWaterQuality = parametersWithReferences.some(parameter => parameter.isResearchEstimate);
  const coverageItems = snapshot ? [
    {
      label: "Sensor readings",
      count: snapshot.readings.count > 0 ? snapshot.readings.count : researchReadings.length,
      isResearchEstimate: snapshot.readings.count === 0 && researchReadings.length > 0,
    },
    { label: "Alerts raised", count: snapshot.alerts.count, isResearchEstimate: false },
    snapshot.growth.count > 0 ? { label: "Growth measurements", count: snapshot.growth.count, isResearchEstimate: false } : null,
  ].filter((item): item is { label: string; count: number; isResearchEstimate: boolean } => item !== null) : [];
  const alertSummary = snapshot ? [
    snapshot.alerts.critical > 0 ? `${snapshot.alerts.critical} critical` : null,
    snapshot.alerts.warning > 0 ? `${snapshot.alerts.warning} warning` : null,
    snapshot.alerts.active > 0 ? `${snapshot.alerts.active} still active` : null,
  ].filter(Boolean).join(" · ") : "";
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
              <span>Period: {formatReportPeriod(report.period_start, report.period_end)}</span>
              <span>Generated: {dateTime(snapshot.generated_at)} by an administrator</span>
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Data coverage</h2>
              {coverageItems.length > 0 ? (
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  {coverageItems.map(item => (
                    <div key={item.label}>
                      <p className="text-muted-foreground">
                        {item.label}
                        {item.isResearchEstimate && <span className="mt-0.5 block text-[11px]">Research estimate</span>}
                      </p>
                      <p className="font-sans text-2xl font-normal tabular-nums">{item.count}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-muted-foreground">Report coverage details are unavailable.</p>}
              {snapshot.readings.first_at && snapshot.readings.last_at && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Reading range: {dateTime(snapshot.readings.first_at)} to {dateTime(snapshot.readings.last_at)}.
                </p>
              )}
              {!snapshot.readings.first_at && researchReadings.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Research-estimate period: {dateTime(researchReadings[0].recorded_at)} to {dateTime(latestResearchReading?.recorded_at ?? null)}.
                </p>
              )}
              {hasReferenceWaterQuality && (
                <p className="mt-3 text-xs text-muted-foreground">Research-estimate values are included in the water quality section and are separate from recorded readings.</p>
              )}
            </Card>
            {notesCard}
          </div>

          {snapshot.harvest && snapshot.harvest.length > 0 && <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Final harvest</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fish counted at harvest are the yield. Mortality is calculated from the stocked count.</p>
            <div className="mt-4 divide-y divide-border">
              {snapshot.harvest.map((item, index) => <div key={`${item.batch_name}-${item.harvest_date}-${index}`} className="grid gap-3 py-3 text-sm first:pt-0 sm:grid-cols-4">
                <div><p className="text-muted-foreground">Batch / date</p><p>{item.batch_name}<br />{formatReportPeriod(item.harvest_date, item.harvest_date)}</p></div>
                <div><p className="text-muted-foreground">Yield (fish)</p><p>{item.harvested_fish_count.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Calculated mortality</p><p>{item.mortality_count?.toLocaleString() ?? "Unavailable"}</p></div>
                <div><p className="text-muted-foreground">Mortality rate</p><p>{item.mortality_rate == null ? "Unavailable" : `${Number(item.mortality_rate).toFixed(2)}%`}</p></div>
              </div>)}
            </div>
          </Card>}

          <Card className="overflow-hidden">
            <div className="border-b border-border p-5 sm:px-6">
              <h2 className="text-lg font-semibold">Water quality</h2>
              <p className="text-sm text-muted-foreground">
                {hasReferenceWaterQuality
                  ? "Recorded sensor values with clearly marked research estimates where readings are unavailable."
                  : "Recorded sensor values for the selected period."}
              </p>
            </div>
            {snapshot.readings.count > 0 || hasReferenceWaterQuality ? (
              <>
                <div className="divide-y divide-border sm:hidden">
                  {parametersWithReferences.map(parameter => (
                    <div key={parameter.label} className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">{parameter.label}</h3>
                        <div className="flex shrink-0 items-center gap-2">
                          {parameter.isResearchEstimate && <span className="text-[11px] text-muted-foreground">Research estimate</span>}
                          {parameter.stats.count > 0 && <span className="text-xs text-muted-foreground">{parameter.stats.count} {parameter.isResearchEstimate ? "estimates" : "samples"}</span>}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-xs text-muted-foreground">Latest</p><p className="tabular-nums">{valueWithUnit(parameter.latest, parameter.unit)}</p></div>
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="tabular-nums">{valueWithUnit(parameter.average, parameter.unit)}</p>
                          {parameter.averageFromReference && <p className="text-[11px] text-muted-foreground">Research estimate</p>}
                        </div>
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
                      {parametersWithReferences.map(parameter => (
                        <tr key={parameter.label}>
                          <th scope="row" className="px-5 py-3 font-medium">
                            {parameter.label}
                            {parameter.isResearchEstimate && <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Research estimate</span>}
                          </th>
                          <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.latest, parameter.unit)}</td>
                          <td className="px-3 py-3 tabular-nums">
                            {valueWithUnit(parameter.average, parameter.unit)}
                            {parameter.averageFromReference && <span className="ml-2 text-[11px] text-muted-foreground">Research estimate</span>}
                          </td>
                          <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.stats.min, parameter.unit)}</td>
                          <td className="px-3 py-3 tabular-nums">{valueWithUnit(parameter.stats.max, parameter.unit)}</td>
                          <td className="px-5 py-3 tabular-nums">{parameter.stats.count > 0 ? parameter.stats.count : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">Water-quality values are not available for this report.</p>
            )}
            {snapshot.readings.latest ? (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Latest reading: {dateTime(snapshot.readings.latest.at)}</p>
            ) : latestResearchReading && (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Latest research estimate: {dateTime(latestResearchReading.recorded_at)}</p>
            )}
            {(waterReference || researchReadings.length > 0) && (
              <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground sm:px-6">
                <p>{waterReference?.reference_note ?? RESEARCH_ESTIMATE_SOURCE.note}</p>
                <p className="mt-2">
                  Source: {" "}
                  <a className="text-primary underline underline-offset-2" href={waterReference?.source_url ?? RESEARCH_ESTIMATE_SOURCE.url} target="_blank" rel="noreferrer">
                    {waterReference?.source_title ?? RESEARCH_ESTIMATE_SOURCE.title}
                  </a>.
                  These values are contextual research references and are kept separate from measured sensor history.
                </p>
                {researchReadings.length > 0 && (
                  <p className="mt-2">The dated values are illustrative estimates centered on the published averages; they are not sensor measurements from this BFAR batch.</p>
                )}
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Alerts</h2>
              {alertSummary && <p className="mt-1 text-sm text-muted-foreground">{alertSummary}</p>}
              {snapshot.alerts.recent.length === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">No recorded alerts were raised in this period.</p>
              ) : (
                <AnimatedResults transitionKey={`alerts-page-${alertPage}`} resize={false} slide={false} skipWhenPrinting className="mt-4">
                <div className="divide-y divide-border">
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
                </AnimatedResults>
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

          <p className="text-xs text-muted-foreground">
            This report is a saved snapshot. Research estimates are added for display from cited averages and are not part of measured sensor history. Dates use the Asia/Manila time zone.
          </p>
        </article>
      )}
    </AppShell>
  );
};

export default ReportDetail;
