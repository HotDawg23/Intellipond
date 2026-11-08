import type { Tables } from "@/integrations/supabase/types";

export type MortalityLog = Tables<"batch_mortality_logs">;

export type MortalityDay = {
  log: MortalityLog;
  fishAtStart: number | null;
  fishRemaining: number | null;
  mortalityRate: number | null;
  cumulativeDeaths: number;
};

// The rate uses fish present after recorded transfers on that date and before deaths.
// It is unavailable when stocking count is unknown or the ledger is inconsistent.
export function summarizeMortality(logs: MortalityLog[], stockedCount: number | null): MortalityDay[] {
  let remaining = stockedCount;
  let cumulativeDeaths = 0;
  return [...logs]
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.id.localeCompare(b.id))
    .map(log => {
      const fishAtStart = remaining == null ? null : remaining + log.transferred_in_count - log.transferred_out_count;
      const validStart = fishAtStart != null && fishAtStart >= log.dead_count && fishAtStart >= 0;
      const mortalityRate = validStart && fishAtStart > 0 ? (log.dead_count / fishAtStart) * 100 : null;
      remaining = validStart ? fishAtStart - log.dead_count : null;
      cumulativeDeaths += log.dead_count;
      return { log, fishAtStart: validStart ? fishAtStart : null, fishRemaining: remaining, mortalityRate, cumulativeDeaths };
    });
}
