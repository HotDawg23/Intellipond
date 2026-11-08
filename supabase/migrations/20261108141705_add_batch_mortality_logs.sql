-- Daily observed deaths and transfers belong to one stocking cycle.
CREATE TABLE public.batch_mortality_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fish_batch_id uuid NOT NULL REFERENCES public.fish_batches(id) ON DELETE CASCADE,
  observed_on date NOT NULL,
  dead_count integer NOT NULL DEFAULT 0 CHECK (dead_count >= 0),
  transferred_in_count integer NOT NULL DEFAULT 0 CHECK (transferred_in_count >= 0),
  transferred_out_count integer NOT NULL DEFAULT 0 CHECK (transferred_out_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fish_batch_id, observed_on)
);

CREATE INDEX batch_mortality_logs_batch_date_idx
  ON public.batch_mortality_logs (fish_batch_id, observed_on DESC);

ALTER TABLE public.batch_mortality_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated view batch mortality"
  ON public.batch_mortality_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert batch mortality"
  ON public.batch_mortality_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update batch mortality"
  ON public.batch_mortality_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete batch mortality"
  ON public.batch_mortality_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.batch_mortality_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_mortality_logs TO authenticated;
