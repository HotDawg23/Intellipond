DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sensor_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_status;
  END IF;
END;
$$;
