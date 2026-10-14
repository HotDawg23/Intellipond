import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Waves, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Ponds = () => {
  const [ponds, setPonds] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", area_sqm: "", stocking_date: "", notes: "" });

  const load = () => supabase.from("pond_profiles").select("*").order("created_at", { ascending: false }).then(({ data }) => setPonds(data ?? []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("pond_profiles").insert({
      name: form.name, location: form.location || null,
      area_sqm: form.area_sqm ? +form.area_sqm : null,
      stocking_date: form.stocking_date || null, notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pond added"); setOpen(false); setForm({ name: "", location: "", area_sqm: "", stocking_date: "", notes: "" }); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("pond_profiles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pond removed"); load();
  };

  return (
    <AppShell admin>
      <PageHeader title="Pond Profiles" subtitle="Manage your aquaculture sites."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-aqua text-white border-0"><Plus className="h-4 w-4 mr-2" />New pond</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add pond</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>Area (sqm)</Label><Input type="number" value={form.area_sqm} onChange={e => setForm({ ...form, area_sqm: e.target.value })} /></div>
                  <div><Label>Stocking date</Label><Input type="date" value={form.stocking_date} onChange={e => setForm({ ...form, stocking_date: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {ponds.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Waves} title="No pond profiles yet." description="Add your first pond to start monitoring." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ponds.map(p => (
            <Card key={p.id} className="group p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="break-words text-lg font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.location ?? "—"}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Area</div><div className="font-mono">{p.area_sqm ?? "—"} m²</div></div>
                <div><div className="text-xs text-muted-foreground">Stocked</div><div className="font-mono">{p.stocking_date ?? "—"}</div></div>
              </div>
              {p.notes && <div className="mt-3 text-sm text-muted-foreground">{p.notes}</div>}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
export default Ponds;
