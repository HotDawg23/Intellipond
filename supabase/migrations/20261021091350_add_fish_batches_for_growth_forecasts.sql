-- Separate stocking cycles so growth measurements and forecasts stay with one batch.
CREATE TABLE public.fish_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pond_id UUID NOT NULL REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  stocking_date DATE NOT NULL,
  initial_weight_g NUMERIC CHECK (initial_weight_g IS NULL OR initial_weight_g > 0),
  initial_length_cm NUMERIC CHECK (initial_length_cm IS NULL OR initial_length_cm > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, pond_id)
);

CREATE UNIQUE INDEX fish_batches_one_active_per_pond
  ON public.fish_batches (pond_id)
  WHERE is_active;

CREATE INDEX fish_batches_pond_id_stocking_date_idx
  ON public.fish_batches (pond_id, stocking_date DESC);

ALTER TABLE public.fish_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view fish batches"
  ON public.fish_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage fish batches"
  ON public.fish_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fish_batches TO authenticated;

ALTER TABLE public.bangus_growth_records
  ADD COLUMN fish_batch_id UUID;

ALTER TABLE public.bangus_growth_records
  ADD CONSTRAINT bangus_growth_records_batch_pond_check
    CHECK (fish_batch_id IS NULL OR pond_id IS NOT NULL),
  ADD CONSTRAINT bangus_growth_records_batch_pond_fkey
    FOREIGN KEY (fish_batch_id, pond_id)
    REFERENCES public.fish_batches (id, pond_id)
    ON DELETE SET NULL (fish_batch_id);

CREATE INDEX bangus_growth_records_fish_batch_id_recorded_at_idx
  ON public.bangus_growth_records (fish_batch_id, recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bangus_growth_records TO authenticated;
