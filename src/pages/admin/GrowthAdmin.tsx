import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Archive, ChevronDown, Fish, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader, LoadingState, LoadError } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { GrowthWaterAveragesRecord } from "@/lib/growth-records-export";
import { formatStockingDensity } from "@/lib/stocking-density";
import { toast } from "sonner";

type Pond = { id: string; name: string; area_sqm: number | null };
type FishBatch = {
  id: string;
  pond_id: string;
  batch_name: string;
  stocking_date: string;
  stocked_fish_count: number | null;
  initial_weight_g: number | null;
  initial_length_cm: number | null;
  is_active: boolean;
  pond_profiles?: { name: string; area_sqm: number | null } | null;
};
type GrowthRecord = GrowthWaterAveragesRecord;

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const daysBetween = (startDate: string, endDate: string) => {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  return Math.floor((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000);
};

const displayWaterAverage = (value: number | null, count: number | null, unit: string) => {
  const readingCount = count ?? 0;
  if (value == null || readingCount === 0) return `— (${readingCount})`;
  return `${Number(value).toFixed(2)}${unit ? ` ${unit}` : ""} (${readingCount})`;
};

const displayDate = (date: string | null) => date
  ? format(new Date(`${date}T00:00:00`), "MMM d, yyyy")
  : "—";

const GrowthAdmin = () => {
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [batches, setBatches] = useState<FishBatch[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [savingStockedCount, setSavingStockedCount] = useState(false);
  const [editingBatch, setEditingBatch] = useState<FishBatch | null>(null);
  const [stockedFishCountInput, setStockedFishCountInput] = useState("");
  const [historyBatchId, setHistoryBatchId] = useState("all");
  const [batchForm, setBatchForm] = useState({ pond_id: "", batch_name: "", stocking_date: localDate(), stocked_fish_count: "", initial_weight_g: "", initial_length_cm: "" });
  const [recordForm, setRecordForm] = useState({ fish_batch_id: "", recorded_at: localDate(), avg_weight_g: "", avg_length_cm: "", feeding_notes: "", pond_condition: "", growth_status: "" });
  const activeBatches = batches.filter(batch => batch.is_active);
  const visibleRecords = historyBatchId === "all" ? records : records.filter(record => record.fish_batch_id === historyBatchId);
  const selectedPond = ponds.find(pond => pond.id === batchForm.pond_id);
  const newBatchDensity = formatStockingDensity(
    batchForm.stocked_fish_count ? Number(batchForm.stocked_fish_count) : null,
    selectedPond?.area_sqm,
  );

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [growthResult, batchResult, pondResult] = await Promise.all([
      supabase.from("growth_records_with_water_averages")
        .select("*")
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false }),
      supabase.from("fish_batches")
        .select("id,pond_id,batch_name,stocking_date,stocked_fish_count,initial_weight_g,initial_length_cm,is_active,pond_profiles(name,area_sqm)")
        .order("stocking_date", { ascending: false }),
      supabase.from("pond_profiles").select("id,name,area_sqm").order("name"),
    ]);
      if (growthResult.error) throw growthResult.error;
      if (batchResult.error) throw batchResult.error;
      if (pondResult.error) throw pondResult.error;
    setRecords(growthResult.data ?? []);
    setBatches((batchResult.data ?? []) as unknown as FishBatch[]);
    setPonds(pondResult.data ?? []);
    if (pondResult.data?.length) {
      const firstPondId = pondResult.data[0].id;
      setBatchForm(current => current.pond_id ? current : { ...current, pond_id: firstPondId });
    }
    if (batchResult.data?.length) {
      const defaultBatch = batchResult.data.find(batch => batch.is_active);
      if (defaultBatch) {
        setRecordForm(current => current.fish_batch_id ? current : { ...current, fish_batch_id: defaultBatch.id });
      }
    }
    setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load growth records: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("growth-water-averages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_readings" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const createBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    const weight = batchForm.initial_weight_g ? Number(batchForm.initial_weight_g) : null;
    const length = batchForm.initial_length_cm ? Number(batchForm.initial_length_cm) : null;
    const stockedFishCount = batchForm.stocked_fish_count ? Number(batchForm.stocked_fish_count) : null;
    if (!weight && !length) return toast.error("Enter a starting average weight or length for the batch.");
    if ((weight != null && weight <= 0) || (length != null && length <= 0)) return toast.error("Starting measurements must be greater than zero.");
    if (stockedFishCount != null && (!Number.isInteger(stockedFishCount) || stockedFishCount <= 0)) {
      return toast.error("Fish stocked must be a whole number greater than zero.");
    }

    const { error } = await supabase.from("fish_batches").insert({
      pond_id: batchForm.pond_id,
      batch_name: batchForm.batch_name.trim(),
      stocking_date: batchForm.stocking_date,
      stocked_fish_count: stockedFishCount,
      initial_weight_g: weight,
      initial_length_cm: length,
    });
    if (error) return toast.error(error.message.includes("fish_batches_one_active_per_pond")
      ? "Close the pond’s current batch before adding another one."
      : error.message);

    toast.success("Fish batch added");
    setBatchOpen(false);
    setBatchForm(current => ({ ...current, batch_name: "", stocking_date: localDate(), stocked_fish_count: "", initial_weight_g: "", initial_length_cm: "" }));
    await load();
  };

  const saveStockedFishCount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBatch) return;

    const stockedFishCount = stockedFishCountInput.trim() ? Number(stockedFishCountInput) : null;
    if (stockedFishCount != null && (!Number.isInteger(stockedFishCount) || stockedFishCount <= 0)) {
      return toast.error("Fish stocked must be a whole number greater than zero.");
    }

    setSavingStockedCount(true);
    const { data, error } = await supabase.from("fish_batches")
      .update({ stocked_fish_count: stockedFishCount })
      .eq("id", editingBatch.id)
      .select("id")
      .maybeSingle();
    setSavingStockedCount(false);
    if (error) return toast.error(`Could not update stocking count: ${error.message}`);
    if (!data) return toast.info("This fish batch could not be updated. Refresh the page and try again.");

    toast.success("Stocking count updated");
    setEditingBatch(null);
    await load();
  };

  const closeBatch = async (batch: FishBatch) => {
    const { error } = await supabase.from("fish_batches").update({ is_active: false }).eq("id", batch.id);
    if (error) return toast.error(error.message);
    toast.success(`${batch.batch_name} closed`);
    await load();
  };

  const addGrowthRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    const batch = activeBatches.find(item => item.id === recordForm.fish_batch_id);
    if (!batch) return toast.error("Select an active fish batch first.");
    const weight = recordForm.avg_weight_g ? Number(recordForm.avg_weight_g) : null;
    const length = recordForm.avg_length_cm ? Number(recordForm.avg_length_cm) : null;
    if (!weight && !length) return toast.error("Enter an average weight or length measurement.");
    if ((weight != null && weight <= 0) || (length != null && length <= 0)) return toast.error("Measurements must be greater than zero.");
    if (recordForm.recorded_at > localDate()) return toast.error("Measurement date cannot be in the future.");
    const ageDays = daysBetween(batch.stocking_date, recordForm.recorded_at);
    if (ageDays < 0) return toast.error("Measurement date cannot be before the batch stocking date.");

    const { error } = await supabase.from("bangus_growth_records").insert({
      fish_batch_id: batch.id,
      pond_id: batch.pond_id,
      age_days: ageDays,
      avg_weight_g: weight,
      avg_length_cm: length,
      recorded_at: new Date(`${recordForm.recorded_at}T00:00:00.000Z`).toISOString(),
      feeding_notes: recordForm.feeding_notes.trim() || null,
      pond_condition: recordForm.pond_condition.trim() || null,
      growth_status: recordForm.growth_status || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Growth measurement added");
    setRecordOpen(false);
    setRecordForm(current => ({ ...current, recorded_at: localDate(), avg_weight_g: "", avg_length_cm: "", feeding_notes: "", pond_condition: "", growth_status: "" }));
    await load();
  };

  return (
    <AppShell admin>
      <PageHeader
        title="Growth Records"
        subtitle="Manage Bangus stocking batches and record fish measurements."
        actions={
          <>
            <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />New batch</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Register fish batch</DialogTitle></DialogHeader>
                <form onSubmit={createBatch} className="space-y-3">
                  <div>
                    <Label>Pond</Label>
                    <Select required value={batchForm.pond_id} onValueChange={value => setBatchForm({ ...batchForm, pond_id: value })}>
                      <SelectTrigger><SelectValue placeholder="Select pond" /></SelectTrigger>
                      <SelectContent>{ponds.map(pond => <SelectItem key={pond.id} value={pond.id}>{pond.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Batch name</Label><Input required value={batchForm.batch_name} onChange={event => setBatchForm({ ...batchForm, batch_name: event.target.value })} placeholder="Example: BFAR October 2026" /></div>
                  <div><Label>Stocking date</Label><Input required type="date" value={batchForm.stocking_date} onChange={event => setBatchForm({ ...batchForm, stocking_date: event.target.value })} /></div>
                  <div>
                    <Label htmlFor="new-batch-stocked-fish-count">Number of fish stocked (optional)</Label>
                    <Input
                      id="new-batch-stocked-fish-count"
                      min="1"
                      step="1"
                      type="number"
                      inputMode="numeric"
                      value={batchForm.stocked_fish_count}
                      onChange={event => setBatchForm({ ...batchForm, stocked_fish_count: event.target.value })}
                      placeholder="Enter the total fish stocked"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {newBatchDensity && selectedPond?.area_sqm
                        ? `Initial density: ${newBatchDensity}, using the recorded pond area of ${selectedPond.area_sqm} m².`
                        : selectedPond?.area_sqm
                          ? "Enter the count to preview density using the recorded pond area."
                          : "A pond area is needed to calculate fish per square meter."}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><Label>Starting average weight (g)</Label><Input min="0.01" step="0.01" type="number" value={batchForm.initial_weight_g} onChange={event => setBatchForm({ ...batchForm, initial_weight_g: event.target.value })} /></div>
                    <div><Label>Starting average length (cm)</Label><Input min="0.01" step="0.01" type="number" value={batchForm.initial_length_cm} onChange={event => setBatchForm({ ...batchForm, initial_length_cm: event.target.value })} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter at least one starting measurement. The estimate uses the available measurement as its baseline.</p>
                  <Button className="w-full" type="submit" disabled={!ponds.length}>Save batch</Button>
                  {!ponds.length && <p className="text-sm text-destructive-text">Add a pond before registering a fish batch.</p>}
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
              <DialogTrigger asChild><Button className="gradient-aqua border-0 text-white" disabled={!activeBatches.length}><Plus className="mr-2 h-4 w-4" />Add measurement</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add growth measurement</DialogTitle></DialogHeader>
                <form onSubmit={addGrowthRecord} className="space-y-3">
                  <div>
                    <Label>Active fish batch</Label>
                    <Select required value={recordForm.fish_batch_id} onValueChange={value => setRecordForm({ ...recordForm, fish_batch_id: value })}>
                      <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                      <SelectContent>{activeBatches.map(batch => <SelectItem key={batch.id} value={batch.id}>{batch.batch_name} · {batch.pond_profiles?.name ?? "Pond"}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Measurement date</Label><Input required type="date" max={localDate()} value={recordForm.recorded_at} onChange={event => setRecordForm({ ...recordForm, recorded_at: event.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><Label>Average weight (g)</Label><Input min="0.01" step="0.01" type="number" value={recordForm.avg_weight_g} onChange={event => setRecordForm({ ...recordForm, avg_weight_g: event.target.value })} /></div>
                    <div><Label>Average length (cm)</Label><Input min="0.01" step="0.01" type="number" value={recordForm.avg_length_cm} onChange={event => setRecordForm({ ...recordForm, avg_length_cm: event.target.value })} /></div>
                  </div>
                  <div><Label>Feeding notes</Label><Input value={recordForm.feeding_notes} onChange={event => setRecordForm({ ...recordForm, feeding_notes: event.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><Label>Pond condition</Label><Input value={recordForm.pond_condition} onChange={event => setRecordForm({ ...recordForm, pond_condition: event.target.value })} /></div>
                    <div>
                      <Label>Growth status</Label>
                      <Select value={recordForm.growth_status} onValueChange={value => setRecordForm({ ...recordForm, growth_status: value })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>{["On Track", "Above Average", "Below Average", "Stunted"].map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Age in days is calculated from the selected batch’s stocking date.</p>
                  <Button type="submit" className="w-full">Save measurement</Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-4 text-sm">
        <div>
          <p className="font-semibold">{activeBatches.length} active {activeBatches.length === 1 ? "batch" : "batches"} · {records.length} recorded {records.length === 1 ? "sample" : "samples"}</p>
          <p className="mt-1 text-muted-foreground">Record weight or length regularly to keep the operator estimate current.</p>
        </div>
        <p className="text-muted-foreground">Latest sample: {records.length ? displayDate(records[0].measurement_date) : "None yet"}</p>
      </div>

      <Dialog open={editingBatch !== null} onOpenChange={open => { if (!open) setEditingBatch(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBatch?.stocked_fish_count == null ? "Add stocking count" : "Edit stocking count"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {editingBatch?.batch_name} · {editingBatch?.pond_profiles?.name ?? "Pond"}
          </p>
          <form onSubmit={saveStockedFishCount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stocked-fish-count">Number of fish stocked</Label>
              <Input
                id="edit-stocked-fish-count"
                min="1"
                step="1"
                type="number"
                inputMode="numeric"
                value={stockedFishCountInput}
                onChange={event => setStockedFishCountInput(event.target.value)}
                placeholder="Enter the total fish stocked"
              />
              <p className="text-xs text-muted-foreground">
                {editingBatch?.pond_profiles?.area_sqm
                  ? `Density uses the recorded pond area of ${editingBatch.pond_profiles.area_sqm} m². Leave blank if the count is unknown.`
                  : "A pond area is needed to calculate density. Leave blank if the count is unknown."}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingBatch(null)}>Cancel</Button>
              <Button type="submit" disabled={savingStockedCount}>
                {savingStockedCount ? "Saving..." : "Save count"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {loadError && <div className="mb-5"><LoadError message={loadError} onRetry={() => void load()} /></div>}
      {!hasLoaded ? (
        loadError ? null : <Card><LoadingState label="Loading growth records" /></Card>
      ) : <>
      <section className="mb-6 space-y-3" aria-labelledby="batches-heading">
        <div>
          <h2 id="batches-heading" className="text-lg font-semibold">Fish batches</h2>
          <p className="text-sm text-muted-foreground">Stocking details and the latest recorded measurements.</p>
        </div>
        {batches.length === 0 ? (
          <Card className="p-5"><p className="text-sm text-muted-foreground">No batches registered yet. Add the current batch’s stocking date and starting measurement to activate a forecast.</p></Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {batches.map(batch => {
              const latestWeight = records.find(record => record.fish_batch_id === batch.id && record.avg_weight_g != null);
              const latestLength = records.find(record => record.fish_batch_id === batch.id && record.avg_length_cm != null);
              const density = formatStockingDensity(batch.stocked_fish_count, batch.pond_profiles?.area_sqm);
              return (
                <Card key={batch.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{batch.batch_name}</h3>
                      <p className="text-sm text-muted-foreground">{batch.pond_profiles?.name ?? "Pond unavailable"}</p>
                    </div>
                    <Badge variant={batch.is_active ? "default" : "secondary"} className={batch.is_active ? "hover:bg-primary" : "hover:bg-secondary"}>{batch.is_active ? "Active" : "Closed"}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">Stocked {format(new Date(`${batch.stocking_date}T00:00:00`), "MMM d, yyyy")}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-4">
                    <div><p className="text-xs text-muted-foreground">Fish stocked</p><p className="font-medium">{batch.stocked_fish_count?.toLocaleString() ?? "Not recorded"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Initial density</p><p className="font-medium">{density ?? "Unavailable"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Latest weight</p><p className="font-medium">{latestWeight ? `${latestWeight.avg_weight_g} g` : "No sample"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Latest length</p><p className="font-medium">{latestLength ? `${latestLength.avg_length_cm} cm` : "No sample"}</p></div>
                  </div>
                  <Collapsible className="mt-3 border-t border-border pt-3 text-sm">
                    <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left font-medium text-primary">
                      <span>Starting measurements and details</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[batch-details-open_180ms_ease-out] data-[state=closed]:animate-[batch-details-close_180ms_ease-out] motion-reduce:animate-none">
                      <div className="mt-3 space-y-1 text-muted-foreground">
                        <p>Starting weight: {batch.initial_weight_g != null ? `${batch.initial_weight_g} g` : "Not recorded"}</p>
                        <p>Starting length: {batch.initial_length_cm != null ? `${batch.initial_length_cm} cm` : "Not recorded"}</p>
                        <p>Density uses the pond’s recorded area and the initial fish count. It does not represent surviving fish.</p>
                        {!density && <p>{batch.stocked_fish_count == null ? "Enter a fish count to calculate density." : "Record the pond area to calculate density."}</p>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setStockedFishCountInput(batch.stocked_fish_count?.toString() ?? ""); setEditingBatch(batch); }}>
                      {batch.stocked_fish_count == null ? "Enter fish count" : "Edit count"}
                    </Button>
                    {batch.is_active && <Button variant="ghost" size="sm" onClick={() => void closeBatch(batch)}><Archive className="mr-2 h-4 w-4" />Close batch</Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="measurements-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="measurements-heading" className="text-lg font-semibold">Measurements</h2>
            <p className="text-sm text-muted-foreground">Open a record for water conditions and notes.</p>
          </div>
          {batches.length > 1 && <div className="w-full sm:w-60">
            <Label htmlFor="measurement-batch">Filter by batch</Label>
            <Select value={historyBatchId} onValueChange={setHistoryBatchId}>
              <SelectTrigger id="measurement-batch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {batches.map(batch => <SelectItem key={batch.id} value={batch.id}>{batch.batch_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}
        </div>
        {visibleRecords.length === 0 ? (
          <Card className="p-4 sm:p-6"><EmptyState icon={Fish} title={records.length ? "No measurements for this batch." : "No growth measurements yet."} description={records.length ? "Choose another batch or add a measurement for this one." : "Record the next sample to update the estimate and begin checking it against BFAR fish."} /></Card>
        ) : (
          <div className="space-y-2">
            {visibleRecords.map(record => (
              <Card key={record.id} className="p-4">
                <div className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold">{displayDate(record.measurement_date)}</p>
                    <p className="truncate text-muted-foreground">{record.batch_name ?? "Unassigned"} · {record.pond_name ?? "Pond unavailable"}</p>
                  </div>
                  <div className="flex justify-between gap-2 sm:block"><span className="text-muted-foreground">Weight</span><span className="font-medium sm:block">{record.avg_weight_g != null ? `${record.avg_weight_g} g` : "Not recorded"}</span></div>
                  <div className="flex justify-between gap-2 sm:block"><span className="text-muted-foreground">Length</span><span className="font-medium sm:block">{record.avg_length_cm != null ? `${record.avg_length_cm} cm` : "Not recorded"}</span></div>
                  <div className="flex justify-between gap-2 sm:block"><span className="text-muted-foreground">Status</span><span className="font-medium sm:block">{record.growth_status ?? "Not set"}</span></div>
                </div>
                <Collapsible className="mt-3 border-t border-border pt-3 text-sm">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left font-medium text-primary">
                    <span>Details</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[batch-details-open_180ms_ease-out] data-[state=closed]:animate-[batch-details-close_180ms_ease-out] motion-reduce:animate-none">
                    <div className="mt-3 grid gap-3 text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                      <p><span className="font-medium text-foreground">Age:</span> {record.age_days != null ? `${record.age_days} days` : "Not recorded"}</p>
                      <p><span className="font-medium text-foreground">DO:</span> {displayWaterAverage(record.avg_do_mg_l, record.do_reading_count, "mg/L")}</p>
                      <p><span className="font-medium text-foreground">pH:</span> {displayWaterAverage(record.avg_ph, record.ph_reading_count, "")}</p>
                      <p><span className="font-medium text-foreground">Temperature:</span> {displayWaterAverage(record.avg_temperature_c, record.temperature_reading_count, "°C")}</p>
                      <p><span className="font-medium text-foreground">Turbidity:</span> {displayWaterAverage(record.avg_turbidity_ntu, record.turbidity_reading_count, "NTU")}</p>
                      <p><span className="font-medium text-foreground">Average window:</span> {displayDate(record.average_start_date)} – {displayDate(record.average_end_date)}</p>
                      <p><span className="font-medium text-foreground">Feeding notes:</span> {record.feeding_notes || "None"}</p>
                      <p><span className="font-medium text-foreground">Pond condition:</span> {record.pond_condition || "None"}</p>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Water averages use readings from this pond between the prior sampling date (or stocking) and this measurement. Parentheses show each non-null reading count; current-day averages may update.</p>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </section>
      </>}
    </AppShell>
  );
};

export default GrowthAdmin;
