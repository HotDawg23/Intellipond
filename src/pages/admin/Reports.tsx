import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
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
    const { data } = await supabase.from("sensor_readings").select("*").order("recorded_at", { ascending: false }).limit(1000);
    if (!data || data.length === 0) return toast.error("No readings to export");
    const headers = ["recorded_at", "pond_id", "do_mg_l", "ph", "temperature_c", "turbidity_ntu"];
    const csv = [headers.join(","), ...data.map(r => headers.map(h => (r as any)[h] ?? "").join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `sensor-readings-${Date.now()}.csv`; a.click();
  };

  return (
    <AppShell admin>
      <PageHeader title="Reports" subtitle="Generate and export system reports."
        actions={<>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export readings</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-aqua text-white border-0"><Plus className="h-4 w-4 mr-2" />New report</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create report</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>Title</Label><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </>}
      />
      {reports.length === 0 ? (
        <Card className="p-6"><EmptyState icon={FileText} title="No reports yet." /></Card>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-accent mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium">{r.title}</div>
                  {r.description && <div className="text-sm text-muted-foreground mt-1">{r.description}</div>}
                  <div className="text-xs text-muted-foreground font-mono mt-2">{format(new Date(r.created_at), "MMM d, yyyy HH:mm")}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
export default Reports;
