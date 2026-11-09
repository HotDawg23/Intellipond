-- Keep legacy closed batches without harvest counts unchanged.
ALTER TABLE public.fish_batches
  ADD COLUMN harvest_date date,
  ADD COLUMN harvested_fish_count integer,
  ADD CONSTRAINT fish_batches_harvest_pair_check
    CHECK ((harvest_date IS NULL) = (harvested_fish_count IS NULL)),
  ADD CONSTRAINT fish_batches_harvest_count_check
    CHECK (harvested_fish_count IS NULL OR harvested_fish_count >= 0),
  ADD CONSTRAINT fish_batches_harvest_stock_check
    CHECK (stocked_fish_count IS NULL OR harvested_fish_count IS NULL OR harvested_fish_count <= stocked_fish_count),
  ADD CONSTRAINT fish_batches_harvest_date_check
    CHECK (harvest_date IS NULL OR (harvest_date >= stocking_date AND harvest_date <= (now() AT TIME ZONE 'Asia/Manila')::date)),
  ADD CONSTRAINT fish_batches_harvest_closed_check
    CHECK (harvest_date IS NULL OR NOT is_active);

-- The report function retains its signature and snapshots; new snapshots include final harvests.
CREATE OR REPLACE FUNCTION public.create_pond_report(
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
  v_harvest jsonb;
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'batch_name', batch_name,
    'harvest_date', harvest_date,
    'stocked_fish_count', stocked_fish_count,
    'harvested_fish_count', harvested_fish_count,
    'mortality_count', CASE WHEN stocked_fish_count IS NOT NULL THEN stocked_fish_count - harvested_fish_count ELSE NULL END,
    'mortality_rate', CASE WHEN stocked_fish_count IS NOT NULL THEN round((stocked_fish_count - harvested_fish_count)::numeric / stocked_fish_count * 100, 2) ELSE NULL END
  ) ORDER BY harvest_date, id), '[]'::jsonb)
  INTO v_harvest
  FROM public.fish_batches
  WHERE pond_id = p_pond_id
    AND (p_batch_id IS NULL OR id = p_batch_id)
    AND NOT is_active
    AND harvest_date BETWEEN p_period_start AND p_period_end
    AND harvested_fish_count IS NOT NULL;
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
      'harvest', v_harvest,
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

