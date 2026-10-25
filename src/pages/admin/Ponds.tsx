import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState, LoadingState, LoadError } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info, MapPin, Pencil, Plus, Ruler, Trash2, Waves, X } from "lucide-react";
import { toast } from "sonner";

type PondProfile = {
  id: string;
  name: string;
  location: string | null;
  area_sqm: number | null;
  notes: string | null;
};

type PondForm = {
  name: string;
  location: string;
  area_sqm: string;
  notes: string;
};

const emptyForm = (): PondForm => ({ name: "", location: "", area_sqm: "", notes: "" });

const Ponds = () => {
  const [ponds, setPonds] = useState<PondProfile[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [editingPond, setEditingPond] = useState<PondProfile | null>(null);
  const [pondToDelete, setPondToDelete] = useState<PondProfile | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PondForm>(emptyForm);

  const load = async () => {
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("pond_profiles")
        .select("id,name,location,area_sqm,notes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPonds(data ?? []);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load pond profiles: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  useEffect(() => { void load(); }, []);

  const startAdd = () => {
    setDeleteMode(false);
    setEditingPond(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const startEdit = (pond: PondProfile) => {
    setDeleteMode(false);
    setEditingPond(pond);
    setForm({
      name: pond.name,
      location: pond.location ?? "",
      area_sqm: pond.area_sqm?.toString() ?? "",
      notes: pond.notes ?? "",
    });
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingPond(null);
      setForm(emptyForm());
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
      notes: form.notes.trim() || null,
    };

    const { error } = editingPond
      ? await supabase.from("pond_profiles").update(values).eq("id", editingPond.id)
      : await supabase.from("pond_profiles").insert(values);

    if (error) return toast.error(error.message);
    toast.success(editingPond ? "Pond updated" : "Pond added");
    handleOpenChange(false);
    void load();
  };

  const confirmDelete = async () => {
    if (!pondToDelete || deleting) return;

    const pond = pondToDelete;
    setDeleting(true);
    try {
      const { error } = await supabase.from("pond_profiles").delete().eq("id", pond.id);
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Pond removed");
      setPonds(current => current.filter(item => item.id !== pond.id));
      if (ponds.length <= 1) setDeleteMode(false);
      setPondToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete pond. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell admin>
      <PageHeader
        title="Pond Profiles"
        subtitle="Manage your aquaculture sites."
        actions={
          <>
            <Button onClick={startAdd} className="gradient-aqua border-0 text-white">
              <Plus className="mr-2 h-4 w-4" />New pond
            </Button>
            {ponds.length > 0 && (
              <Button
                type="button"
                variant={deleteMode ? "secondary" : "outline"}
                onClick={() => setDeleteMode(current => !current)}
                aria-pressed={deleteMode}
              >
                {deleteMode ? <X className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deleteMode ? "Done" : "Delete ponds"}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-start gap-3 py-2 sm:flex-1 sm:items-center">
          <span className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            <Info className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-left text-sm text-muted-foreground">
            {deleteMode
              ? "Choose the trash icon on a pond card. We’ll ask you to confirm before removing it."
              : "Pond profiles hold site details. Stocking dates and fish counts are recorded for each batch in Growth Records."}
          </p>
        </div>
        <span className="self-start whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:self-auto">
          {hasLoaded ? `${ponds.length} ${ponds.length === 1 ? "pond" : "ponds"}` : "—"}
        </span>
      </div>

      {loadError && <div className="mb-4"><LoadError message={loadError} onRetry={() => void load()} /></div>}
      {!hasLoaded ? (
        loadError ? null : <Card><LoadingState label="Loading pond profiles" /></Card>
      ) : ponds.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Waves} title="No pond profiles yet." description="Add your first pond to start monitoring." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ponds.map(pond => (
            <Card key={pond.id} className="overflow-hidden border-border/80">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Waves className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-semibold leading-tight">{pond.name}</h2>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{pond.location || "Location not set"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(pond)} aria-label={`Edit ${pond.name}`}>
                      <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />Edit
                    </Button>
                    {deleteMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive-text hover:bg-destructive/10 hover:text-destructive-text"
                        onClick={() => setPondToDelete(pond)}
                        aria-label={`Delete ${pond.name}`}
                        title={`Delete ${pond.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-muted/60 p-2 text-primary">
                      <Ruler className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-xs text-muted-foreground">Pond area</div>
                      <div className="font-medium">
                        {pond.area_sqm == null
                          ? "Not recorded"
                          : `${pond.area_sqm.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`}
                      </div>
                    </div>
                  </div>
                </div>

                {pond.notes && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{pond.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPond ? "Edit pond" : "Add pond"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label htmlFor="pond-name">Name</Label><Input id="pond-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="pond-location">Location</Label><Input id="pond-location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label htmlFor="pond-area">Area (m²)</Label><Input id="pond-area" min="0" step="0.01" type="number" value={form.area_sqm} onChange={e => setForm({ ...form, area_sqm: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Stocking dates and fish counts belong to a fish batch. Add them in Growth Records.</p>
            <div><Label htmlFor="pond-notes">Notes</Label><Textarea id="pond-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button type="submit" className="w-full">{editingPond ? "Save changes" : "Save pond"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pondToDelete !== null}
        onOpenChange={nextOpen => {
          if (!nextOpen && !deleting) setPondToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pondToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the pond and its saved sensor readings, sensor status, fish batches, growth records, and alerts. Sensors configured for this pond will stop saving readings until they are reassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={event => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete pond"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Ponds;
