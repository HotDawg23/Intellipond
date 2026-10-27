-- Index report relationships used by access checks and foreign keys.
CREATE INDEX reports_batch_pond_idx ON public.reports (fish_batch_id, pond_id);
CREATE INDEX reports_pond_id_idx ON public.reports (pond_id);
CREATE INDEX reports_generated_by_idx ON public.reports (generated_by);
