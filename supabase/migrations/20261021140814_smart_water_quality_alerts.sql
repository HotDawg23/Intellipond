-- Turn repeated sensor threshold events into durable, deduplicated incidents.

ALTER TABLE public.admin_settings
  ADD COLUMN critical_do_high numeric,
  ADD COLUMN critical_ph_low numeric,
  ADD COLUMN critical_ph_high numeric,
  ADD COLUMN critical_temp_low numeric,
  ADD COLUMN critical_turbidity_high numeric;

ALTER TABLE public.admin_settings
  ADD CONSTRAINT admin_settings_critical_do_high_check
    CHECK (critical_do_high IS NULL OR critical_do_high > do_max),
  ADD CONSTRAINT admin_settings_critical_ph_low_check
    CHECK (critical_ph_low IS NULL OR critical_ph_low < ph_min),
  ADD CONSTRAINT admin_settings_critical_ph_high_check
    CHECK (critical_ph_high IS NULL OR critical_ph_high > ph_max),
  ADD CONSTRAINT admin_settings_critical_temp_low_check
    CHECK (critical_temp_low IS NULL OR critical_temp_low < temp_min),
  ADD CONSTRAINT admin_settings_critical_turbidity_high_check
    CHECK (critical_turbidity_high IS NULL OR critical_turbidity_high > turbidity_max);

ALTER TABLE public.alerts
  ADD COLUMN condition_key text,
  ADD COLUMN sensor_type text,
  ADD COLUMN last_sensor_value numeric,
  ADD COLUMN last_reading_id uuid REFERENCES public.sensor_readings(id) ON DELETE SET NULL,
  ADD COLUMN last_detected_at timestamptz,
  ADD COLUMN last_processed_reading_at timestamptz,
  ADD COLUMN last_notified_at timestamptz,
  ADD COLUMN reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN normal_reading_streak smallint NOT NULL DEFAULT 0,
  ADD COLUMN status text NOT NULL DEFAULT 'legacy_archived',
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolution_reason text,
  ADD COLUMN legacy_archived_at timestamptz;

UPDATE public.alerts
SET status = 'legacy_archived',
    last_detected_at = COALESCE(last_detected_at, created_at),
    legacy_archived_at = clock_timestamp();

ALTER TABLE public.alerts
  ALTER COLUMN status SET DEFAULT 'active',
  ADD CONSTRAINT alerts_status_check
    CHECK (status IN ('active', 'resolved', 'legacy_archived')),
  ADD CONSTRAINT alerts_nonnegative_reminder_count_check CHECK (reminder_count >= 0),
  ADD CONSTRAINT alerts_nonnegative_normal_streak_check CHECK (normal_reading_streak >= 0);

CREATE UNIQUE INDEX alerts_one_active_condition_idx
  ON public.alerts (pond_id, condition_key)
  WHERE status = 'active' AND pond_id IS NOT NULL AND condition_key IS NOT NULL;

CREATE INDEX alerts_status_created_at_idx
  ON public.alerts (status, created_at DESC);

CREATE TABLE public.alert_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  pond_id uuid NOT NULL REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('new', 'reminder', 'escalation')),
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  message text NOT NULL,
  recommendation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_notification_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.alert_notification_events TO authenticated;

CREATE POLICY "approved users view alert notification events"
  ON public.alert_notification_events FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.approved = true
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'alert_notification_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_notification_events;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "auth view alerts" ON public.alerts;
CREATE POLICY "approved users view alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.approved = true
    )
  );

CREATE POLICY "approved operators acknowledge active alerts"
  ON public.alerts FOR UPDATE TO authenticated
  USING (
    status = 'active'
    AND acknowledged = false
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR (
        public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
        AND EXISTS (
          SELECT 1 FROM public.profiles AS p
          WHERE p.id = (SELECT auth.uid()) AND p.approved = true
        )
      )
    )
  )
  WITH CHECK (
    status = 'active'
    AND acknowledged = true
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR (
        public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
        AND EXISTS (
          SELECT 1 FROM public.profiles AS p
          WHERE p.id = (SELECT auth.uid()) AND p.approved = true
        )
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.alerts FROM authenticated;
GRANT UPDATE (acknowledged) ON public.alerts TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_alert_acknowledgement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.acknowledged IS DISTINCT FROM OLD.acknowledged THEN
    IF OLD.status <> 'active' OR OLD.acknowledged OR NEW.acknowledged IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Only an unacknowledged active alert can be acknowledged';
    END IF;

    IF current_user NOT IN ('postgres', 'service_role')
       AND (
         auth.uid() IS NULL
         OR NOT (
           public.has_role(auth.uid(), 'admin'::public.app_role)
           OR (
             public.has_role(auth.uid(), 'operator'::public.app_role)
             AND EXISTS (
               SELECT 1 FROM public.profiles AS p
               WHERE p.id = auth.uid() AND p.approved = true
             )
           )
         )
       ) THEN
      RAISE EXCEPTION 'Only approved admins and operators can acknowledge alerts';
    END IF;

    NEW.acknowledged_at := clock_timestamp();
    NEW.acknowledged_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.capture_alert_acknowledgement()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER alerts_capture_acknowledgement
  BEFORE UPDATE OF acknowledged ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.capture_alert_acknowledgement();

CREATE OR REPLACE FUNCTION public.apply_water_alert_condition(
  p_pond_id uuid,
  p_sensor_type text,
  p_condition_key text,
  p_category text,
  p_value numeric,
  p_is_abnormal boolean,
  p_parameter_normal boolean,
  p_severity text,
  p_message text,
  p_recommendation text,
  p_reading_id uuid,
  p_recorded_at timestamptz,
  p_alerts_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_alert public.alerts%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_next_severity text;
  v_notification_type text;
  v_normal_streak smallint;
  v_resolved boolean;
BEGIN
  IF p_pond_id IS NULL THEN
    RETURN;
  END IF;

  -- Serialize a pond/condition pair so simultaneous sensor inserts cannot open two incidents.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_pond_id::text || ':' || p_condition_key, 0));

  SELECT * INTO v_alert
  FROM public.alerts AS a
  WHERE a.pond_id = p_pond_id
    AND a.condition_key = p_condition_key
    AND a.status = 'active'
  FOR UPDATE;

  IF FOUND THEN
    IF v_alert.last_processed_reading_at IS NOT NULL
       AND p_recorded_at <= v_alert.last_processed_reading_at THEN
      RETURN;
    END IF;

    IF p_is_abnormal THEN
      v_next_severity := CASE
        WHEN v_alert.severity = 'critical' OR p_severity = 'critical' THEN 'critical'
        ELSE 'warning'
      END;
      v_notification_type := NULL;

      IF p_alerts_enabled THEN
        IF v_alert.severity = 'warning' AND v_next_severity = 'critical' THEN
          v_notification_type := 'escalation';
        ELSIF NOT v_alert.acknowledged AND (
          v_alert.last_notified_at IS NULL
          OR v_alert.last_notified_at <= v_now - CASE
            WHEN v_next_severity = 'critical' THEN interval '30 minutes'
            ELSE interval '6 hours'
          END
        ) THEN
          v_notification_type := 'reminder';
        END IF;
      END IF;

      UPDATE public.alerts
      SET severity = v_next_severity,
          message = p_message,
          recommendation = p_recommendation,
          sensor_type = p_sensor_type,
          last_sensor_value = p_value,
          last_reading_id = p_reading_id,
          last_detected_at = p_recorded_at,
          last_processed_reading_at = p_recorded_at,
          normal_reading_streak = 0,
          last_notified_at = CASE WHEN v_notification_type IS NOT NULL THEN v_now ELSE last_notified_at END,
          reminder_count = reminder_count + CASE WHEN v_notification_type = 'reminder' THEN 1 ELSE 0 END
      WHERE id = v_alert.id
      RETURNING * INTO v_alert;

      IF v_notification_type IS NOT NULL THEN
        INSERT INTO public.alert_notification_events
          (alert_id, pond_id, notification_type, severity, message, recommendation, created_at)
        VALUES
          (v_alert.id, p_pond_id, v_notification_type, v_alert.severity,
           v_alert.message, v_alert.recommendation, v_now);
      END IF;
    ELSE
      v_normal_streak := CASE
        WHEN p_parameter_normal THEN v_alert.normal_reading_streak + 1
        ELSE 0
      END;
      v_resolved := v_normal_streak >= 2;

      UPDATE public.alerts
      SET last_sensor_value = p_value,
          last_reading_id = p_reading_id,
          last_processed_reading_at = p_recorded_at,
          normal_reading_streak = v_normal_streak,
          status = CASE WHEN v_resolved THEN 'resolved' ELSE status END,
          resolved_at = CASE WHEN v_resolved THEN v_now ELSE resolved_at END,
          resolution_reason = CASE WHEN v_resolved THEN 'returned_to_normal' ELSE resolution_reason END
      WHERE id = v_alert.id;
    END IF;

    RETURN;
  END IF;

  IF NOT p_is_abnormal OR NOT p_alerts_enabled THEN
    RETURN;
  END IF;

  INSERT INTO public.alerts (
    pond_id, severity, category, message, recommendation, acknowledged,
    condition_key, sensor_type, last_sensor_value, last_reading_id,
    last_detected_at, last_processed_reading_at, last_notified_at,
    reminder_count, normal_reading_streak, status
  ) VALUES (
    p_pond_id, p_severity, p_category, p_message, p_recommendation, false,
    p_condition_key, p_sensor_type, p_value, p_reading_id,
    p_recorded_at, p_recorded_at, v_now,
    0, 0, 'active'
  ) RETURNING * INTO v_alert;

  INSERT INTO public.alert_notification_events
    (alert_id, pond_id, notification_type, severity, message, recommendation, created_at)
  VALUES
    (v_alert.id, p_pond_id, 'new', v_alert.severity,
     v_alert.message, v_alert.recommendation, v_now);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_water_alert_condition(
  uuid, text, text, text, numeric, boolean, boolean, text, text, text, uuid, timestamptz, boolean
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_alerts_from_reading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  s public.admin_settings%ROWTYPE;
  v_do_min numeric;
  v_do_max numeric;
  v_ph_min numeric;
  v_ph_max numeric;
  v_temp_min numeric;
  v_temp_max numeric;
  v_turbidity_max numeric;
  v_critical_do_high numeric;
  v_critical_ph_low numeric;
  v_critical_ph_high numeric;
  v_critical_temp_low numeric;
  v_critical_turbidity_high numeric;
  v_alerts_enabled boolean;
  v_severity text;
BEGIN
  SELECT * INTO s FROM public.admin_settings ORDER BY updated_at DESC LIMIT 1;
  IF FOUND THEN
    v_do_min := s.do_min;
    v_do_max := s.do_max;
    v_ph_min := s.ph_min;
    v_ph_max := s.ph_max;
    v_temp_min := s.temp_min;
    v_temp_max := s.temp_max;
    v_turbidity_max := s.turbidity_max;
    v_critical_do_high := s.critical_do_high;
    v_critical_ph_low := s.critical_ph_low;
    v_critical_ph_high := s.critical_ph_high;
    v_critical_temp_low := s.critical_temp_low;
    v_critical_turbidity_high := s.critical_turbidity_high;
    v_alerts_enabled := COALESCE(s.alerts_enabled, true);
  ELSE
    v_do_min := 4;
    v_do_max := 9;
    v_ph_min := 6.5;
    v_ph_max := 8.5;
    v_temp_min := 26;
    v_temp_max := 32;
    v_turbidity_max := 80;
    v_critical_do_high := NULL;
    v_critical_ph_low := NULL;
    v_critical_ph_high := NULL;
    v_critical_temp_low := NULL;
    v_critical_turbidity_high := NULL;
    v_alerts_enabled := true;
  END IF;

  IF NEW.do_mg_l IS NOT NULL THEN
    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'DO', 'do_low', 'water_quality', NEW.do_mg_l,
      NEW.do_mg_l < v_do_min, NEW.do_mg_l BETWEEN v_do_min AND v_do_max,
      'critical',
      'Low dissolved oxygen detected (' || NEW.do_mg_l || ' mg/L).',
      'Activate aerators immediately and reduce feeding until oxygen levels recover above ' || v_do_min || ' mg/L.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );

    v_severity := CASE
      WHEN v_critical_do_high IS NOT NULL AND NEW.do_mg_l >= v_critical_do_high THEN 'critical'
      ELSE 'warning'
    END;
    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'DO', 'do_high', 'water_quality', NEW.do_mg_l,
      NEW.do_mg_l > v_do_max, NEW.do_mg_l BETWEEN v_do_min AND v_do_max,
      v_severity,
      'High dissolved oxygen detected (' || NEW.do_mg_l || ' mg/L).',
      'Reduce aeration intensity and re-check sensor calibration.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );
  END IF;

  IF NEW.ph IS NOT NULL THEN
    v_severity := CASE
      WHEN v_critical_ph_low IS NOT NULL AND NEW.ph <= v_critical_ph_low THEN 'critical'
      ELSE 'warning'
    END;
    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'pH', 'ph_low', 'water_quality', NEW.ph,
      NEW.ph < v_ph_min, NEW.ph BETWEEN v_ph_min AND v_ph_max,
      v_severity,
      'Acidic water detected (pH ' || NEW.ph || ').',
      'Apply agricultural lime in measured doses and re-test pH after a few hours.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );

    v_severity := CASE
      WHEN v_critical_ph_high IS NOT NULL AND NEW.ph >= v_critical_ph_high THEN 'critical'
      ELSE 'warning'
    END;
    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'pH', 'ph_high', 'water_quality', NEW.ph,
      NEW.ph > v_ph_max, NEW.ph BETWEEN v_ph_min AND v_ph_max,
      v_severity,
      'Alkaline water detected (pH ' || NEW.ph || ').',
      'Partially exchange pond water and reduce organic load to lower pH.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );
  END IF;

  IF NEW.temperature_c IS NOT NULL THEN
    v_severity := CASE
      WHEN v_critical_temp_low IS NOT NULL AND NEW.temperature_c <= v_critical_temp_low THEN 'critical'
      ELSE 'warning'
    END;
    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'temperature', 'temperature_low', 'temperature', NEW.temperature_c,
      NEW.temperature_c < v_temp_min, NEW.temperature_c BETWEEN v_temp_min AND v_temp_max,
      v_severity,
      'Water temperature below optimal (' || NEW.temperature_c || ' °C).',
      'Reduce water exchange during cool periods and monitor feeding response.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );

    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'temperature', 'temperature_high', 'temperature', NEW.temperature_c,
      NEW.temperature_c > v_temp_max, NEW.temperature_c BETWEEN v_temp_min AND v_temp_max,
      'critical',
      'Water temperature above optimal (' || NEW.temperature_c || ' °C).',
      'Increase aeration, add fresh cooler water if available, and avoid heavy feeding during midday.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );
  END IF;

  IF NEW.turbidity_ntu IS NOT NULL THEN
    v_severity := CASE
      WHEN v_critical_turbidity_high IS NOT NULL AND NEW.turbidity_ntu >= v_critical_turbidity_high THEN 'critical'
      ELSE 'warning'
    END;
    PERFORM public.apply_water_alert_condition(
      NEW.pond_id, 'turbidity', 'turbidity_high', 'turbidity', NEW.turbidity_ntu,
      NEW.turbidity_ntu > v_turbidity_max, NEW.turbidity_ntu <= v_turbidity_max,
      v_severity,
      'High turbidity detected (' || NEW.turbidity_ntu || ' NTU).',
      'Inspect for algal blooms or sediment disturbance; consider partial water exchange.',
      NEW.id, NEW.recorded_at, v_alerts_enabled
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_alerts_from_reading()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_alerts ON public.sensor_readings;
CREATE TRIGGER trg_generate_alerts
  AFTER INSERT ON public.sensor_readings
  FOR EACH ROW EXECUTE FUNCTION public.generate_alerts_from_reading();
