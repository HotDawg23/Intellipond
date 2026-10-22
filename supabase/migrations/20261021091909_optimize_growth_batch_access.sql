-- Cover both columns of the batch/pond foreign key and retain pond lookups.
DROP INDEX IF EXISTS public.bangus_growth_records_fish_batch_id_recorded_at_idx;
CREATE INDEX bangus_growth_records_fish_batch_pond_recorded_idx
  ON public.bangus_growth_records (fish_batch_id, pond_id, recorded_at DESC);
CREATE INDEX bangus_growth_records_pond_id_idx
  ON public.bangus_growth_records (pond_id);

-- Keep reads available to signed-in users and grant mutations only to admins.
DROP POLICY "admin manage fish batches" ON public.fish_batches;
CREATE POLICY "admin insert fish batches"
  ON public.fish_batches FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));
CREATE POLICY "admin update fish batches"
  ON public.fish_batches FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));
CREATE POLICY "admin delete fish batches"
  ON public.fish_batches FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));
