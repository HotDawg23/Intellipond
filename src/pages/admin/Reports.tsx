import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, FileText, Download, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { downloadGrowthRecordsCsv } from "@/lib/growth-records-export";

type Report = Database["public"]["Tables"]["reports"]["Row"];
type SensorReading = Database["public"]["Tables"]["sensor_readings"]["Row"];
const readingColumns = ["recorded_at", "pond_id", "do_mg_l", "ph", "temperature_c", "turbidity_ntu"] as const satisfies readonly (keyof SensorReading)[];

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [open, setOpen] = useState(false);
  const [exportingReadings, setExportingReadings] = useState(false);
  const [exportingGrowth, setExportingGrowth] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  const load = () => supabase.from("reports").select("*").order("created_at", { ascending: false }).then(({ data }) => setReports(data ?? []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reports").insert({ title: form.title, description: form.description || null, generated_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success("Report saved"); setOpen(false); setForm({ title: "", description: "" }); load();
  };

  const exportCSV = async () => {
    setExportingReadings(true);
    try {
      const { data, error } = await supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(1000);
      if (error) throw error;
      if (!data?.length) return toast.error("No readings to export");
      const csv = [readingColumns.join(","), ...data.map(r => readingColumns.map(column => r[column] ?? "").join(","))].join("\n");
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
      <PageHeader title="Reports" subtitle="Create report entries and export system data."
        actions={<>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-aqua text-white border-0"><Plus className="h-4 w-4 mr-2" />New report</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create report</DialogTitle><DialogDescription>Save a title and description for this report entry.</DialogDescription></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label htmlFor="report-title">Title</Label><Input id="report-title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label htmlFor="report-description">Description</Label><Textarea id="report-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </>}
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
          <h2 id="saved-reports-title" className="text-base font-semibold">Saved reports</h2>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">{reports.length} {reports.length === 1 ? "entry" : "entries"}</span>
        </div>
      {reports.length === 0 ? (
        <Card className="p-6"><EmptyState icon={FileText} title="No reports yet." /></Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden border-border/70 shadow-sm">
          {reports.map(r => (
            <div key={r.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"><FileText className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{r.title}</h3>
                {r.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{r.description}</p>}
              </div>
              <time dateTime={r.created_at} className="text-xs text-muted-foreground sm:shrink-0 sm:pt-1">{format(new Date(r.created_at), "MMM d, yyyy · HH:mm")}</time>
            </div>
          ))}
        </Card>
      )}
      </section>
    </AppShell>
  );
};
export default Reports;
