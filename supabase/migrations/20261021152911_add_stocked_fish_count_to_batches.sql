ALTER TABLE public.fish_batches
  ADD COLUMN stocked_fish_count integer,
  ADD CONSTRAINT fish_batches_stocked_fish_count_check
    CHECK (stocked_fish_count IS NULL OR stocked_fish_count > 0);
