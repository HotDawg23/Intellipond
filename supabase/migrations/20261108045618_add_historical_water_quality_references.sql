CREATE TABLE public.batch_water_quality_references (
  fish_batch_id UUID PRIMARY KEY REFERENCES public.fish_batches(id) ON DELETE CASCADE,
  do_mg_l NUMERIC NOT NULL CHECK (do_mg_l >= 0),
  ph NUMERIC NOT NULL CHECK (ph BETWEEN 0 AND 14),
  temperature_c NUMERIC NOT NULL CHECK (temperature_c >= 0),
  turbidity_ntu NUMERIC NOT NULL CHECK (turbidity_ntu >= 0),
  source_title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  reference_note TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batch_water_quality_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated view batch water references"
  ON public.batch_water_quality_references FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins manage batch water references"
  ON public.batch_water_quality_references FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_water_quality_references TO authenticated;

WITH reference_values (pond_name, batch_name, do_mg_l, ph, temperature_c, turbidity_ntu) AS (
  VALUES
    ('BFAR 2025 Pond 1 (historical)', 'BFAR Pond 1 Second Cycle 2025', 5.90, 8.38, 29.60, 27.84),
    ('BFAR 2025 Pond 5 (historical)', 'BFAR Pond 5 Second Cycle 2025', 5.90, 8.38, 29.60, 27.84)
)
INSERT INTO public.batch_water_quality_references (
  fish_batch_id,
  do_mg_l,
  ph,
  temperature_c,
  turbidity_ntu,
  source_title,
  source_url,
  reference_note
)
SELECT
  fb.id,
  values.do_mg_l,
  values.ph,
  values.temperature_c,
  values.turbidity_ntu,
  'Barman et al. (2012), Field study of milkfish fry under different salinity and ration levels',
  'https://www.longdom.org/open-access-pdfs/effect-of-different-salinity-and-ration-levels-on-growth-2150-3508.1000053.pdf',
  'Contextual research averages, not measurements from this BFAR batch. DO (5.90 mg/L), pH (8.38), and turbidity (27.84 NTU) are arithmetic means of the four field-treatment means reported in Table 4. Temperature (29.60 C) is the midpoint of the reported 26.4–32.8 C range. The study used milkfish fry in inland saline ponds in India; conditions differ from this batch.'
FROM reference_values AS values
JOIN public.pond_profiles AS pond ON pond.name = values.pond_name
JOIN public.fish_batches AS fb ON fb.pond_id = pond.id AND fb.batch_name = values.batch_name AND NOT fb.is_active
ON CONFLICT (fish_batch_id) DO UPDATE SET
  do_mg_l = EXCLUDED.do_mg_l,
  ph = EXCLUDED.ph,
  temperature_c = EXCLUDED.temperature_c,
  turbidity_ntu = EXCLUDED.turbidity_ntu,
  source_title = EXCLUDED.source_title,
  source_url = EXCLUDED.source_url,
  reference_note = EXCLUDED.reference_note,
  updated_at = now();
