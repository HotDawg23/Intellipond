export type HarvestBatch = {
  stocking_date: string;
  stocked_fish_count: number | null;
  harvest_date: string | null;
  harvested_fish_count: number | null;
};

export function harvestResult(batch: HarvestBatch) {
  const yieldCount = batch.harvested_fish_count;
  const mortalityCount = yieldCount != null && batch.stocked_fish_count != null
    ? batch.stocked_fish_count - yieldCount : null;
  return {
    yieldCount,
    mortalityCount,
    mortalityRate: mortalityCount != null && batch.stocked_fish_count != null
      ? mortalityCount / batch.stocked_fish_count * 100 : null,
  };
}

export function validateHarvest(date: string, countInput: string, batch: Pick<HarvestBatch, "stocking_date" | "stocked_fish_count">, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return "Enter a valid harvest date.";
  if (date < batch.stocking_date) return "Harvest date cannot be before the stocking date.";
  if (date > today) return "Harvest date cannot be in the future.";
  if (!/^\d+$/.test(countInput.trim()) || !Number.isSafeInteger(Number(countInput))) return "Enter the whole number of fish counted at harvest.";
  if (batch.stocked_fish_count != null && Number(countInput) > batch.stocked_fish_count) return "Harvest count cannot exceed the stocked count.";
  return null;
}
