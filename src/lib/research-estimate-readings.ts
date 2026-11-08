export type ResearchEstimateReading = {
  id: string;
  pond_name: string;
  batch_name: string;
  recorded_at: string;
  do_mg_l: number;
  ph: number;
  temperature_c: number;
  turbidity_ntu: number;
};

export const RESEARCH_ESTIMATE_SOURCE = {
  title: "Barman et al. (2012), Field study of milkfish fry under different salinity and ration levels",
  url: "https://www.longdom.org/open-access-pdfs/effect-of-different-salinity-and-ration-levels-on-growth-2150-3508.1000053.pdf",
  note: "Contextual averages, not measurements from this BFAR batch. DO, pH, and turbidity reference values are arithmetic means across the four field-treatment means in Table 4; the temperature reference is the midpoint of the reported 26.4–32.8 °C range. The dated variation shown here is illustrative.",
};

// Dated illustrative values centered on published study averages. They are
// marked as research estimates wherever they appear and are not BFAR samples.
export const RESEARCH_ESTIMATE_READINGS: ResearchEstimateReading[] = [
  {
    id: "research-estimate-pond-1-1",
    pond_name: "BFAR 2025 Pond 1 (historical)",
    batch_name: "BFAR Pond 1 Second Cycle 2025",
    recorded_at: "2025-10-17T08:00:00+08:00",
    do_mg_l: 5.6,
    ph: 8.3,
    temperature_c: 28,
    turbidity_ntu: 25.84,
  },
  {
    id: "research-estimate-pond-1-2",
    pond_name: "BFAR 2025 Pond 1 (historical)",
    batch_name: "BFAR Pond 1 Second Cycle 2025",
    recorded_at: "2025-10-24T08:00:00+08:00",
    do_mg_l: 5.8,
    ph: 8.34,
    temperature_c: 29,
    turbidity_ntu: 26.84,
  },
  {
    id: "research-estimate-pond-1-3",
    pond_name: "BFAR 2025 Pond 1 (historical)",
    batch_name: "BFAR Pond 1 Second Cycle 2025",
    recorded_at: "2025-10-31T08:00:00+08:00",
    do_mg_l: 5.9,
    ph: 8.38,
    temperature_c: 29.6,
    turbidity_ntu: 27.84,
  },
  {
    id: "research-estimate-pond-1-4",
    pond_name: "BFAR 2025 Pond 1 (historical)",
    batch_name: "BFAR Pond 1 Second Cycle 2025",
    recorded_at: "2025-11-07T08:00:00+08:00",
    do_mg_l: 6.1,
    ph: 8.42,
    temperature_c: 30.2,
    turbidity_ntu: 28.84,
  },
  {
    id: "research-estimate-pond-1-5",
    pond_name: "BFAR 2025 Pond 1 (historical)",
    batch_name: "BFAR Pond 1 Second Cycle 2025",
    recorded_at: "2025-11-14T08:00:00+08:00",
    do_mg_l: 6.1,
    ph: 8.46,
    temperature_c: 31.2,
    turbidity_ntu: 29.84,
  },
  {
    id: "research-estimate-pond-5-1",
    pond_name: "BFAR 2025 Pond 5 (historical)",
    batch_name: "BFAR Pond 5 Second Cycle 2025",
    recorded_at: "2025-10-20T08:00:00+08:00",
    do_mg_l: 6.2,
    ph: 8.46,
    temperature_c: 31.2,
    turbidity_ntu: 29.84,
  },
  {
    id: "research-estimate-pond-5-2",
    pond_name: "BFAR 2025 Pond 5 (historical)",
    batch_name: "BFAR Pond 5 Second Cycle 2025",
    recorded_at: "2025-10-27T08:00:00+08:00",
    do_mg_l: 6,
    ph: 8.42,
    temperature_c: 30.2,
    turbidity_ntu: 28.84,
  },
  {
    id: "research-estimate-pond-5-3",
    pond_name: "BFAR 2025 Pond 5 (historical)",
    batch_name: "BFAR Pond 5 Second Cycle 2025",
    recorded_at: "2025-11-03T08:00:00+08:00",
    do_mg_l: 5.9,
    ph: 8.38,
    temperature_c: 29.6,
    turbidity_ntu: 27.84,
  },
  {
    id: "research-estimate-pond-5-4",
    pond_name: "BFAR 2025 Pond 5 (historical)",
    batch_name: "BFAR Pond 5 Second Cycle 2025",
    recorded_at: "2025-11-10T08:00:00+08:00",
    do_mg_l: 5.8,
    ph: 8.34,
    temperature_c: 29,
    turbidity_ntu: 26.84,
  },
  {
    id: "research-estimate-pond-5-5",
    pond_name: "BFAR 2025 Pond 5 (historical)",
    batch_name: "BFAR Pond 5 Second Cycle 2025",
    recorded_at: "2025-11-17T08:00:00+08:00",
    do_mg_l: 5.6,
    ph: 8.3,
    temperature_c: 28,
    turbidity_ntu: 25.84,
  },
];

export function getResearchEstimateReadings(selectedDate?: string, dateOrder: "newest" | "oldest" = "newest") {
  return RESEARCH_ESTIMATE_READINGS
    .filter(reading => !selectedDate || reading.recorded_at.slice(0, 10) === selectedDate)
    .sort((a, b) => (dateOrder === "newest" ? -1 : 1) * (a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id)));
}

export function getResearchEstimateReadingsForReport(
  pondName: string | null,
  batchName: string | null,
  periodStart: string | null,
  periodEnd: string | null,
) {
  if (!pondName || !batchName || !periodStart || !periodEnd) return [];

  return RESEARCH_ESTIMATE_READINGS
    .filter(reading => reading.pond_name === pondName && reading.batch_name === batchName)
    .filter(reading => {
      const localDate = reading.recorded_at.slice(0, 10);
      return localDate >= periodStart && localDate <= periodEnd;
    })
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}
