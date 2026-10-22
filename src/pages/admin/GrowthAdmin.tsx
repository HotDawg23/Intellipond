import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Archive, Download, Fish, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { downloadGrowthRecordsCsv, type GrowthWaterAveragesRecord } from "@/lib/growth-records-export";
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
  const [batchOpen, setBatchOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingStockedCount, setSavingStockedCount] = useState(false);
  const [editingBatch, setEditingBatch] = useState<FishBatch | null>(null);
  const [stockedFishCountInput, setStockedFishCountInput] = useState("");
  const [batchForm, setBatchForm] = useState({ pond_id: "", batch_name: "", stocking_date: localDate(), stocked_fish_count: "", initial_weight_g: "", initial_length_cm: "" });
  const [recordForm, setRecordForm] = useState({ fish_batch_id: "", recorded_at: localDate(), avg_weight_g: "", avg_length_cm: "", feeding_notes: "", pond_condition: "", growth_status: "" });
  const activeBatches = batches.filter(batch => batch.is_active);
  const selectedPond = ponds.find(pond => pond.id === batchForm.pond_id);
  const newBatchDensity = formatStockingDensity(
    batchForm.stocked_fish_count ? Number(batchForm.stocked_fish_count) : null,
    selectedPond?.area_sqm,
  );

  const load = useCallback(async () => {
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
    if (growthResult.error) toast.error(`Could not load growth records: ${growthResult.error.message}`);
    if (batchResult.error) toast.error(`Could not load fish batches: ${batchResult.error.message}`);
    if (pondResult.error) toast.error(`Could not load ponds: ${pondResult.error.message}`);
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
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("growth-water-averages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_readings" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const exportGrowthCsv = async () => {
    setExporting(true);
    try {
      const count = await downloadGrowthRecordsCsv();
      if (count === 0) toast.error("No growth records to export");
      else toast.success(`Exported ${count} growth record${count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(`Could not export growth records: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

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
            <Button variant="outline" onClick={() => void exportGrowthCsv()} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />{exporting ? "Exporting…" : "Export growth CSV"}
            </Button>
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
                  {!ponds.length && <p className="text-sm text-destructive">Add a pond before registering a fish batch.</p>}
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
                  <div><Label>Measurement date</Label><Input required type="date" value={recordForm.recorded_at} onChange={event => setRecordForm({ ...recordForm, recorded_at: event.target.value })} /></div>
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

      <Card className="mb-6 space-y-1 p-4 text-sm text-muted-foreground">
        <p>Water averages use readings from the same pond, starting at stocking or the day after the prior distinct fish-sampling date, through the measurement date.</p>
        <p>Each value shows its available reading count. Averages can update as readings arrive during the current day.</p>
      </Card>

      <section className="mb-6 space-y-3" aria-labelledby="batches-heading">
        <h2 id="batches-heading" className="text-lg font-semibold">Fish batches</h2>
        {batches.length === 0 ? (
          <Card className="p-5"><p className="text-sm text-muted-foreground">No batches registered yet. Add the current batch’s stocking date and starting measurement to activate a forecast.</p></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {batches.map(batch => (
              <Card key={batch.id} className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{batch.batch_name}</span><Badge variant={batch.is_active ? "default" : "secondary"}>{batch.is_active ? "Active" : "Closed"}</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{batch.pond_profiles?.name ?? "Pond"} · stocked {format(new Date(`${batch.stocking_date}T00:00:00`), "MMM d, yyyy")}</p>
                  <p className="mt-1 text-sm">{batch.initial_weight_g != null ? `${batch.initial_weight_g} g` : "Weight not recorded"} · {batch.initial_length_cm != null ? `${batch.initial_length_cm} cm` : "length not recorded"}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {batch.stocked_fish_count != null
                      ? `${batch.stocked_fish_count.toLocaleString()} fish stocked`
                      : "Fish count not recorded"}
                    {" · "}
                    {formatStockingDensity(batch.stocked_fish_count, batch.pond_profiles?.area_sqm)
                      ? `Initial density: ${formatStockingDensity(batch.stocked_fish_count, batch.pond_profiles?.area_sqm)}`
                      : batch.stocked_fish_count == null
                        ? "Enter fish count to calculate density"
                        : "Pond area required to calculate density"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Density uses the pond’s recorded area and describes the initial stocking, not the current surviving fish.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStockedFishCountInput(batch.stocked_fish_count?.toString() ?? "");
                      setEditingBatch(batch);
                    }}
                  >
                    {batch.stocked_fish_count == null ? "Enter fish count" : "Edit count"}
                  </Button>
                  {batch.is_active && <Button variant="ghost" size="sm" onClick={() => void closeBatch(batch)}><Archive className="mr-2 h-4 w-4" />Close</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="p-4 sm:p-6">
        {records.length === 0 ? (
          <EmptyState icon={Fish} title="No growth measurements yet." description="Record the next sample to update the estimate and begin checking it against BFAR fish." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[90rem] text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4">Date</th><th className="pr-4">Batch / pond</th><th className="pr-4">Age</th><th className="pr-4">Weight</th><th className="pr-4">Length</th><th className="pr-4">Avg DO</th><th className="pr-4">Avg pH</th><th className="pr-4">Avg temp.</th><th className="pr-4">Avg turbidity</th><th className="pr-4">Water average window</th><th>Status</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {records.map(record => (
                  <tr key={record.id}>
                    <td className="py-2.5 pr-4 font-mono text-xs">{displayDate(record.measurement_date)}</td>
                    <td className="pr-4">{record.batch_name ?? "Unassigned"} · {record.pond_name ?? "—"}</td>
                    <td className="pr-4 font-mono">{record.age_days ?? "—"}d</td>
                    <td className="pr-4 font-mono">{record.avg_weight_g ?? "—"}g</td>
                    <td className="pr-4 font-mono">{record.avg_length_cm ?? "—"}cm</td>
                    <td className="pr-4 font-mono">{displayWaterAverage(record.avg_do_mg_l, record.do_reading_count, "mg/L")}</td>
                    <td className="pr-4 font-mono">{displayWaterAverage(record.avg_ph, record.ph_reading_count, "")}</td>
                    <td className="pr-4 font-mono">{displayWaterAverage(record.avg_temperature_c, record.temperature_reading_count, "°C")}</td>
                    <td className="pr-4 font-mono">{displayWaterAverage(record.avg_turbidity_ntu, record.turbidity_reading_count, "NTU")}</td>
                    <td className="pr-4 text-xs">{displayDate(record.average_start_date)} – {displayDate(record.average_end_date)}</td>
                    <td>{record.growth_status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">Counts are the non-null readings used for each average.</p>
          </div>
        )}
      </Card>
    </AppShell>
  );
};

export default GrowthAdmin;
