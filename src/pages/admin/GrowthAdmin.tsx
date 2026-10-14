import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fish, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const GrowthAdmin = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [ponds, setPonds] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pond_id: "", age_days: "", avg_weight_g: "", avg_length_cm: "", feeding_notes: "", pond_condition: "", growth_status: "" });

  const load = async () => {
    const [r, p] = await Promise.all([
      supabase.from("bangus_growth_records").select("*, pond_profiles(name)").order("recorded_at", { ascending: false }),
      supabase.from("pond_profiles").select("id, name"),
    ]);
    setRecords(r.data ?? []); setPonds(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("bangus_growth_records").insert({
      pond_id: form.pond_id || null,
      age_days: form.age_days ? +form.age_days : null,
      avg_weight_g: form.avg_weight_g ? +form.avg_weight_g : null,
      avg_length_cm: form.avg_length_cm ? +form.avg_length_cm : null,
      feeding_notes: form.feeding_notes || null,
      pond_condition: form.pond_condition || null,
      growth_status: form.growth_status || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Growth record added"); setOpen(false); load();
    setForm({ pond_id: "", age_days: "", avg_weight_g: "", avg_length_cm: "", feeding_notes: "", pond_condition: "", growth_status: "" });
  };

  return (
    <AppShell admin>
      <PageHeader title="Growth Records" subtitle="Capture Bangus growth measurements."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-aqua text-white border-0"><Plus className="h-4 w-4 mr-2" />New record</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add growth record</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Pond</Label>
                  <Select value={form.pond_id} onValueChange={v => setForm({ ...form, pond_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select pond" /></SelectTrigger>
                    <SelectContent>{ponds.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div><Label>Age (days)</Label><Input type="number" value={form.age_days} onChange={e => setForm({ ...form, age_days: e.target.value })} /></div>
                  <div><Label>Weight (g)</Label><Input type="number" step="0.01" value={form.avg_weight_g} onChange={e => setForm({ ...form, avg_weight_g: e.target.value })} /></div>
                  <div><Label>Length (cm)</Label><Input type="number" step="0.01" value={form.avg_length_cm} onChange={e => setForm({ ...form, avg_length_cm: e.target.value })} /></div>
                </div>
                <div><Label>Feeding notes</Label><Input value={form.feeding_notes} onChange={e => setForm({ ...form, feeding_notes: e.target.value })} /></div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div><Label>Pond condition</Label><Input value={form.pond_condition} onChange={e => setForm({ ...form, pond_condition: e.target.value })} /></div>
                  <div>
                    <Label>Growth status</Label>
                    <Select value={form.growth_status} onValueChange={v => setForm({ ...form, growth_status: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["On Track", "Above Average", "Below Average", "Stunted"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="p-4 sm:p-6">
        {records.length === 0 ? (
          <EmptyState icon={Fish} title="No growth records found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Date</th><th className="pr-4">Pond</th><th className="pr-4">Age</th><th className="pr-4">Weight</th><th className="pr-4">Length</th><th>Status</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4 font-mono text-xs">{format(new Date(r.recorded_at), "MMM d, yyyy")}</td>
                    <td className="pr-4">{r.pond_profiles?.name ?? "—"}</td>
                    <td className="pr-4 font-mono">{r.age_days ?? "—"}d</td>
                    <td className="pr-4 font-mono">{r.avg_weight_g ?? "—"}g</td>
                    <td className="pr-4 font-mono">{r.avg_length_cm ?? "—"}cm</td>
                    <td>{r.growth_status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
};
export default GrowthAdmin;
