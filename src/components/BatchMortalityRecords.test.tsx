import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "date-fns";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BatchMortalityRecords } from "./BatchMortalityRecords";

const state = vi.hoisted(() => ({ readingTime: "", logDate: "", deadCount: 0, doValue: 3.4, phValue: 8.3, temperature: 28.1, transfersIn: 0, transfersOut: 0 }));
const model = JSON.parse(readFileSync(resolve(process.cwd(), "public/mortality-model.json"), "utf8"));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        limit() { return query; },
        then(resolveResult: (result: unknown) => void) {
          const data = table === "sensor_readings"
            ? [{ recorded_at: state.readingTime, do_mg_l: state.doValue, ph: state.phValue, temperature_c: state.temperature }]
            : [{ id: "log-1", fish_batch_id: "batch-1", observed_on: state.logDate, dead_count: state.deadCount,
              transferred_in_count: state.transfersIn, transferred_out_count: state.transfersOut, notes: null, created_at: state.readingTime }];
          return Promise.resolve({ data, error: null }).then(resolveResult);
        },
      };
      return query;
    },
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe("mortality research estimate", () => {
  it("shows the tested next-visit signal for a same-day log and fresh sensor reading", async () => {
    state.readingTime = new Date().toISOString();
    state.logDate = format(new Date(), "yyyy-MM-dd");
    state.deadCount = 0;
    state.doValue = 3.4;
    state.phValue = 8.3;
    state.temperature = 28.1;
    state.transfersIn = 0;
    state.transfersOut = 0;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => model }));

    render(<BatchMortalityRecords batches={[{
      id: "batch-1", pond_id: "pond-1", batch_name: "Test batch", stocking_date: state.logDate,
      stocked_fish_count: 100, is_active: true,
    }]} canEdit={false} />);

    expect(await screen.findByText("Elevated signal")).toBeVisible();
    expect(screen.getByText(/not a 24-hour forecast/)).toBeVisible();
    expect(screen.getByText(/does not trigger alerts/)).toBeVisible();
  });

  it("prioritizes 100 observed deaths when the model finds no elevated signal", async () => {
    state.readingTime = new Date().toISOString();
    state.logDate = format(new Date(), "yyyy-MM-dd");
    state.deadCount = 100;
    state.doValue = 7.38;
    state.phValue = 6.64;
    state.temperature = 32.94;
    state.transfersIn = 20;
    state.transfersOut = 30;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => model }));

    render(<BatchMortalityRecords batches={[{
      id: "batch-1", pond_id: "pond-1", batch_name: "Test batch", stocking_date: state.logDate,
      stocked_fish_count: 900, is_active: true,
    }]} canEdit={false} />);

    expect(await screen.findByText("Review observed mortality")).toBeVisible();
    expect(screen.getByText("11.24%")).toBeVisible();
    expect(screen.getByText(/100 fish found dead/)).toBeVisible();
    expect(screen.queryByText("No elevated signal detected")).not.toBeInTheDocument();
  });
});
