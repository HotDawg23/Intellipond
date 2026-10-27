import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { Activity, Download, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { LoadError, LoadingState, PageHeader } from "@/components/Common";
import { ReportList } from "@/components/ReportList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { downloadGrowthRecordsCsv } from "@/lib/growth-records-export";
import type { Report } from "@/lib/report-snapshot";

type SensorReading = Database["public"]["Tables"]["sensor_readings"]["Row"];
type Pond = Pick<Database["public"]["Tables"]["pond_profiles"]["Row"], "id" | "name">;
type Batch = Pick<Database["public"]["Tables"]["fish_batches"]["Row"], "id" | "pond_id" | "batch_name">;
type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email" | "approved">;
type UserRole = Pick<Database["public"]["Tables"]["user_roles"]["Row"], "user_id" | "role">;
type Recipient = Database["public"]["Tables"]["report_recipients"]["Row"];

const readingColumns = ["recorded_at", "pond_id", "do_mg_l", "ph", "temperature_c", "turbidity_ntu"] as const satisfies readonly (keyof SensorReading)[];

const emptyForm = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    title: "",
    description: "",
    pondId: "",
    batchId: "",
    start: `${today.slice(0, 7)}-01`,
    end: today,
    operatorIds: [] as string[],
  };
};

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sharingReport, setSharingReport] = useState<Report | null>(null);
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [savingShare, setSavingShare] = useState(false);
  const [exportingReadings, setExportingReadings] = useState(false);
  const [exportingGrowth, setExportingGrowth] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoadError("");
    try {
      const [reportResult, pondResult, batchResult, profileResult, roleResult, recipientResult] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }),
        supabase.from("pond_profiles").select("id,name").order("name"),
        supabase.from("fish_batches").select("id,pond_id,batch_name").order("stocking_date", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email,approved"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("report_recipients").select("report_id,user_id"),
      ]);
      for (const result of [reportResult, pondResult, batchResult, profileResult, roleResult, recipientResult]) {
        if (result.error) throw result.error;
      }
      setReports(reportResult.data ?? []);
      setPonds(pondResult.data ?? []);
      setBatches(batchResult.data ?? []);
      setProfiles(profileResult.data ?? []);
      setRoles(roleResult.data ?? []);
      setRecipients(recipientResult.data ?? []);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load reports: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  useEffect(() => { void load(); }, []);

  const operators = profiles.filter(profile => {
    const userRoles = roles.filter(role => role.user_id === profile.id).map(role => role.role);
    return profile.approved && userRoles.includes("operator") && !userRoles.includes("admin");
  });
  const selectedBatches = batches.filter(batch => batch.pond_id === form.pondId);

  const toggleOperator = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.pondId || !form.start || !form.end || form.start > form.end) {
      toast.error("Choose a pond and valid date range");
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.rpc("create_pond_report", {
        p_title: form.title.trim(),
        p_description: form.description.trim(),
        p_pond_id: form.pondId,
        p_batch_id: form.batchId || null,
        p_period_start: form.start,
        p_period_end: form.end,
        p_operator_ids: form.operatorIds,
      });
      if (error) throw error;
      toast.success("Report created");
      setOpen(false);
      setForm(emptyForm());
      void load();
    } catch (error) {
      toast.error(`Could not create report: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  };

  const manageAccess = (report: Report) => {
    setSharingReport(report);
    setShareIds(recipients
      .filter(recipient => recipient.report_id === report.id && operators.some(operator => operator.id === recipient.user_id))
      .map(recipient => recipient.user_id));
  };

  const saveAccess = async () => {
    if (!sharingReport) return;
    setSavingShare(true);
    try {
      const { error } = await supabase.rpc("set_report_recipients", {
        p_report_id: sharingReport.id,
        p_operator_ids: shareIds,
      });
      if (error) throw error;
      toast.success(shareIds.length ? "Report access updated" : "Report is now admin only");
      setSharingReport(null);
      void load();
    } catch (error) {
      toast.error(`Could not update access: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingShare(false);
    }
  };

  const exportCSV = async () => {
    setExportingReadings(true);
    try {
      const { data, error } = await supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(1000);
      if (error) throw error;
      if (!data?.length) return toast.error("No readings to export");
      const csv = [readingColumns.join(","), ...data.map(reading => readingColumns.map(column => reading[column] ?? "").join(","))].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `sensor-readings-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success(`Exported ${data.length} sensor reading${data.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(`Could not export readings: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setExportingReadings(false);
    }
  };

  const exportGrowthCsv = async () => {
    setExportingGrowth(true);
    try {
      const count = await downloadGrowthRecordsCsv();
      if (count === 0) toast.error("No growth records to export");
      else toast.success(`Exported ${count} growth record${count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(`Could not export growth records: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setExportingGrowth(false);
    }
  };

  return (
    <AppShell admin>
      <PageHeader
        title="Reports"
        subtitle="Generate pond reports and export system data."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-aqua border-0 text-white"><Plus className="mr-2 h-4 w-4" />New report</Button>
            </DialogTrigger>
            <DialogContent className="report-scrollbar max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create pond report</DialogTitle>
                <DialogDescription>Save a snapshot of readings, alerts, and growth for a selected period.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="report-title">Title</Label>
                  <Input id="report-title" required maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-pond">Pond</Label>
                  <Select value={form.pondId} onValueChange={pondId => setForm({ ...form, pondId, batchId: "" })}>
                    <SelectTrigger id="report-pond"><SelectValue placeholder="Choose a pond" /></SelectTrigger>
                    <SelectContent>{ponds.map(pond => <SelectItem key={pond.id} value={pond.id}>{pond.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-batch">Fish batch</Label>
                  <Select value={form.batchId || "all"} onValueChange={batchId => setForm({ ...form, batchId: batchId === "all" ? "" : batchId })} disabled={!form.pondId}>
                    <SelectTrigger id="report-batch"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All batches in this pond</SelectItem>
                      {selectedBatches.map(batch => <SelectItem key={batch.id} value={batch.id}>{batch.batch_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose a batch to compare growth within one stocking cycle.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="report-start">From</Label><Input id="report-start" type="date" required value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="report-end">Through</Label><Input id="report-end" type="date" required value={form.end} onChange={event => setForm({ ...form, end: event.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-description">Notes and actions taken</Label>
                  <Textarea id="report-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Optional observations or follow-up actions" />
                </div>
                <div>
                  <Label>Share with operators</Label>
                  <p className="mb-2 text-xs text-muted-foreground">Only selected approved operators can view this report. Leave all unchecked to keep it admin only.</p>
                  <div className="report-scrollbar max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                    {operators.length === 0 && <p className="text-sm text-muted-foreground">No approved operators available.</p>}
                    {operators.map(operator => (
                      <div key={operator.id} className="flex items-center gap-2">
                        <Checkbox id={`report-operator-${operator.id}`} checked={form.operatorIds.includes(operator.id)}
                          onCheckedChange={() => setForm({ ...form, operatorIds: toggleOperator(form.operatorIds, operator.id) })} />
                        <Label htmlFor={`report-operator-${operator.id}`} className="cursor-pointer font-normal">
                          {operator.full_name || operator.email || "Unnamed operator"}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={creating || !form.pondId}>
                  {creating ? "Creating report…" : "Create report"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <section aria-labelledby="export-data-title" className="mb-8">
        <div className="mb-3">
          <h2 id="export-data-title" className="text-base font-semibold">Export data</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Download data for your own analysis.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="flex flex-col gap-4 border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"><Activity className="h-5 w-5" aria-hidden="true" /></div>
              <div><h3 className="font-semibold">Sensor readings</h3><p className="text-sm text-muted-foreground">Latest 1,000 readings</p></div>
            </div>
            <Button variant="outline" className="w-full shrink-0 lg:w-auto" onClick={() => void exportCSV()} disabled={exportingReadings}>
              <Download className="mr-2 h-4 w-4" />{exportingReadings ? "Exporting readings…" : "Export readings"}
            </Button>
          </Card>
          <Card className="flex flex-col gap-4 border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><TrendingUp className="h-5 w-5" aria-hidden="true" /></div>
              <div><h3 className="font-semibold">Growth records</h3><p className="text-sm text-muted-foreground">All available measurements</p></div>
            </div>
            <Button variant="outline" className="w-full shrink-0 lg:w-auto" onClick={() => void exportGrowthCsv()} disabled={exportingGrowth}>
              <Download className="mr-2 h-4 w-4" />{exportingGrowth ? "Exporting growth…" : "Export growth CSV"}
            </Button>
          </Card>
        </div>
      </section>

      <section aria-labelledby="saved-reports-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="saved-reports-title" className="text-base font-semibold">Saved reports</h2>
            <p className="text-sm text-muted-foreground">Open a report to review or print its saved snapshot.</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            {hasLoaded ? `${reports.length} ${reports.length === 1 ? "report" : "reports"}` : "—"}
          </span>
        </div>
        {loadError && <div className="mb-3"><LoadError message={loadError} onRetry={() => void load()} /></div>}
        {!hasLoaded ? (loadError ? null : <Card><LoadingState label="Loading reports" /></Card>) : (
          <ReportList reports={reports} basePath="/admin/reports" onManageAccess={manageAccess} />
        )}
      </section>

      <Dialog open={sharingReport !== null} onOpenChange={isOpen => { if (!isOpen) setSharingReport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage report access</DialogTitle>
            <DialogDescription>Choose which approved operators can view {sharingReport?.title}.</DialogDescription>
          </DialogHeader>
          <div className="report-scrollbar max-h-48 space-y-2 overflow-y-auto">
            {operators.length === 0 && <p className="text-sm text-muted-foreground">No approved operators available.</p>}
            {operators.map(operator => (
              <div key={operator.id} className="flex items-center gap-2">
                <Checkbox id={`share-operator-${operator.id}`} checked={shareIds.includes(operator.id)}
                  onCheckedChange={() => setShareIds(toggleOperator(shareIds, operator.id))} />
                <Label htmlFor={`share-operator-${operator.id}`} className="cursor-pointer font-normal">
                  {operator.full_name || operator.email || "Unnamed operator"}
                </Label>
              </div>
            ))}
          </div>
          <Button onClick={() => void saveAccess()} disabled={savingShare}>
            {savingShare ? "Saving…" : "Save access"}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Reports;
