export function calculateStockingDensity(
  stockedFishCount: number | null | undefined,
  pondAreaSqm: number | null | undefined,
): number | null {
  if (
    stockedFishCount == null
    || !Number.isInteger(stockedFishCount)
    || stockedFishCount <= 0
    || pondAreaSqm == null
    || !Number.isFinite(pondAreaSqm)
    || pondAreaSqm <= 0
  ) {
    return null;
  }

  return stockedFishCount / pondAreaSqm;
}

export function formatStockingDensity(
  stockedFishCount: number | null | undefined,
  pondAreaSqm: number | null | undefined,
): string | null {
  const density = calculateStockingDensity(stockedFishCount, pondAreaSqm);
  if (density === null) return null;

  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(density)} fish/m²`;
}
