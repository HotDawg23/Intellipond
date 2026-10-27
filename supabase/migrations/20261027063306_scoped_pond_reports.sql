-- Store complete, dated report snapshots and share them with selected operators.
ALTER TABLE public.reports
  ADD COLUMN pond_id uuid REFERENCES public.pond_profiles(id) ON DELETE SET NULL,
  ADD COLUMN fish_batch_id uuid,
  ADD COLUMN period_start date,
  ADD COLUMN period_end date,
  ADD COLUMN report_data jsonb,
  ADD COLUMN published_at timestamptz,
  ADD CONSTRAINT reports_period_order_check
    CHECK (period_start IS NULL OR period_end IS NULL OR period_start <= period_end),
  ADD CONSTRAINT reports_batch_pond_fkey
    FOREIGN KEY (fish_batch_id, pond_id)
    REFERENCES public.fish_batches(id, pond_id)
    ON DELETE SET NULL (fish_batch_id);

CREATE INDEX reports_created_at_idx ON public.reports (created_at DESC);

CREATE TABLE public.report_recipients (
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, user_id)
);
CREATE INDEX report_recipients_user_report_idx
  ON public.report_recipients (user_id, report_id);

ALTER TABLE public.report_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.report_recipients TO authenticated;

CREATE POLICY "admins manage report recipients"
  ON public.report_recipients FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "operators view own report recipients"
  ON public.report_recipients FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid()) AND profile.approved
    )
  );

CREATE POLICY "approved operators view shared reports"
  ON public.reports FOR SELECT TO authenticated
  USING (
    published_at IS NOT NULL
    AND report_data IS NOT NULL
    AND public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid()) AND profile.approved
    )
    AND EXISTS (
      SELECT 1 FROM public.report_recipients AS recipient
      WHERE recipient.report_id = reports.id
        AND recipient.user_id = (SELECT auth.uid())
    )
  );

CREATE FUNCTION public.set_report_recipients(
  p_report_id uuid,
  p_operator_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_operator_ids uuid[] := COALESCE(p_operator_ids, '{}'::uuid[]);
BEGIN
  IF NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can share reports' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE id = p_report_id) THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_operator_ids) AS selected(user_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = selected.user_id
        AND profile.approved
        AND public.has_role(selected.user_id, 'operator'::public.app_role)
        AND NOT public.has_role(selected.user_id, 'admin'::public.app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Reports can only be shared with approved operators';
  END IF;

  DELETE FROM public.report_recipients WHERE report_id = p_report_id;
  INSERT INTO public.report_recipients (report_id, user_id)
  SELECT p_report_id, selected.user_id
  FROM (SELECT DISTINCT user_id FROM unnest(v_operator_ids) AS recipients(user_id)) AS selected;

  UPDATE public.reports
  SET published_at = CASE
    WHEN cardinality(v_operator_ids) > 0 THEN COALESCE(published_at, now())
    ELSE NULL
  END
  WHERE id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_report_recipients(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_report_recipients(uuid, uuid[]) TO authenticated;

CREATE FUNCTION public.create_pond_report(
  p_title text,
  p_description text,
  p_pond_id uuid,
  p_batch_id uuid,
  p_period_start date,
  p_period_end date,
  p_operator_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_pond_name text;
  v_batch_name text;
  v_readings jsonb;
  v_latest_reading jsonb;
  v_alerts jsonb;
  v_alert_items jsonb;
  v_growth_count bigint;
  v_first_growth jsonb;
  v_last_growth jsonb;
BEGIN
  IF NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can create reports' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'A report title is required';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'Choose a valid date range';
  END IF;

  SELECT name INTO v_pond_name FROM public.pond_profiles WHERE id = p_pond_id;
  IF v_pond_name IS NULL THEN
    RAISE EXCEPTION 'Pond not found';
  END IF;
  IF p_batch_id IS NOT NULL THEN
    SELECT batch_name INTO v_batch_name
    FROM public.fish_batches
    WHERE id = p_batch_id AND pond_id = p_pond_id;
    IF v_batch_name IS NULL THEN
      RAISE EXCEPTION 'Batch does not belong to this pond';
    END IF;
  END IF;

  -- Report dates follow the local pond day, including the entire end date.
  v_start := p_period_start::timestamp AT TIME ZONE 'Asia/Manila';
  v_end := (p_period_end + 1)::timestamp AT TIME ZONE 'Asia/Manila';

  SELECT jsonb_build_object(
    'count', count(*),
    'first_at', min(recorded_at),
    'last_at', max(recorded_at),
    'do_mg_l', jsonb_build_object('count', count(do_mg_l), 'average', round(avg(do_mg_l), 2), 'min', min(do_mg_l), 'max', max(do_mg_l)),
    'ph', jsonb_build_object('count', count(ph), 'average', round(avg(ph), 2), 'min', min(ph), 'max', max(ph)),
    'temperature_c', jsonb_build_object('count', count(temperature_c), 'average', round(avg(temperature_c), 2), 'min', min(temperature_c), 'max', max(temperature_c)),
    'turbidity_ntu', jsonb_build_object('count', count(turbidity_ntu), 'average', round(avg(turbidity_ntu), 2), 'min', min(turbidity_ntu), 'max', max(turbidity_ntu))
  ) INTO v_readings
  FROM public.sensor_readings
  WHERE pond_id = p_pond_id AND recorded_at >= v_start AND recorded_at < v_end;

  SELECT jsonb_build_object(
    'at', recorded_at, 'do_mg_l', do_mg_l, 'ph', ph,
    'temperature_c', temperature_c, 'turbidity_ntu', turbidity_ntu
  ) INTO v_latest_reading
  FROM public.sensor_readings
  WHERE pond_id = p_pond_id AND recorded_at >= v_start AND recorded_at < v_end
  ORDER BY recorded_at DESC, id DESC LIMIT 1;

  SELECT jsonb_build_object(
    'count', count(*),
    'critical', count(*) FILTER (WHERE severity = 'critical'),
    'warning', count(*) FILTER (WHERE severity = 'warning'),
    'active', count(*) FILTER (WHERE status = 'active')
  ) INTO v_alerts
  FROM public.alerts
  WHERE pond_id = p_pond_id
    AND created_at >= v_start AND created_at < v_end
    AND status <> 'legacy_archived';

  SELECT COALESCE(jsonb_agg(to_jsonb(recent_alert)), '[]'::jsonb)
  INTO v_alert_items
  FROM (
    SELECT severity, message, status, created_at, recommendation
    FROM public.alerts
    WHERE pond_id = p_pond_id
      AND created_at >= v_start AND created_at < v_end
      AND status <> 'legacy_archived'
    ORDER BY created_at DESC, id DESC LIMIT 10
  ) AS recent_alert;

  SELECT count(*) INTO v_growth_count
  FROM public.bangus_growth_records
  WHERE pond_id = p_pond_id
    AND (p_batch_id IS NULL OR fish_batch_id = p_batch_id)
    AND recorded_at >= v_start AND recorded_at < v_end;

  SELECT jsonb_build_object(
    'at', recorded_at, 'weight_g', avg_weight_g, 'length_cm', avg_length_cm
  ) INTO v_first_growth
  FROM public.bangus_growth_records
  WHERE pond_id = p_pond_id
    AND (p_batch_id IS NULL OR fish_batch_id = p_batch_id)
    AND recorded_at >= v_start AND recorded_at < v_end
  ORDER BY recorded_at ASC, id ASC LIMIT 1;

  SELECT jsonb_build_object(
    'at', recorded_at, 'weight_g', avg_weight_g, 'length_cm', avg_length_cm
  ) INTO v_last_growth
  FROM public.bangus_growth_records
  WHERE pond_id = p_pond_id
    AND (p_batch_id IS NULL OR fish_batch_id = p_batch_id)
    AND recorded_at >= v_start AND recorded_at < v_end
  ORDER BY recorded_at DESC, id DESC LIMIT 1;

  INSERT INTO public.reports (
    title, description, generated_by, pond_id, fish_batch_id,
    period_start, period_end, report_data
  ) VALUES (
    btrim(p_title), NULLIF(btrim(COALESCE(p_description, '')), ''),
    (SELECT auth.uid()), p_pond_id, p_batch_id, p_period_start, p_period_end,
    jsonb_build_object(
      'version', 1,
      'generated_at', now(),
      'time_zone', 'Asia/Manila',
      'pond_name', v_pond_name,
      'batch_name', v_batch_name,
      'readings', v_readings || jsonb_build_object('latest', v_latest_reading),
      'alerts', v_alerts || jsonb_build_object('recent', v_alert_items),
      'growth', jsonb_build_object(
        'count', v_growth_count,
        'first', v_first_growth,
        'latest', v_last_growth,
        'weight_change_g', (v_last_growth->>'weight_g')::numeric - (v_first_growth->>'weight_g')::numeric,
        'length_change_cm', (v_last_growth->>'length_cm')::numeric - (v_first_growth->>'length_cm')::numeric
      )
    )
  ) RETURNING id INTO v_id;

  PERFORM public.set_report_recipients(v_id, p_operator_ids);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pond_report(text, text, uuid, uuid, date, date, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pond_report(text, text, uuid, uuid, date, date, uuid[]) TO authenticated;
