
CREATE OR REPLACE FUNCTION public.generate_alerts_from_reading()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM public.admin_settings ORDER BY updated_at DESC LIMIT 1;
  IF s IS NULL THEN
    s.do_min := 4; s.do_max := 9; s.ph_min := 6.5; s.ph_max := 8.5;
    s.temp_min := 26; s.temp_max := 32; s.turbidity_max := 80; s.alerts_enabled := true;
  END IF;

  IF NOT COALESCE(s.alerts_enabled, true) THEN
    RETURN NEW;
  END IF;

  -- Dissolved Oxygen
  IF NEW.do_mg_l IS NOT NULL AND NEW.do_mg_l < s.do_min THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'critical', 'water_quality',
      'Low dissolved oxygen detected (' || NEW.do_mg_l || ' mg/L).',
      'Activate aerators immediately and reduce feeding until oxygen levels recover above ' || s.do_min || ' mg/L.');
  ELSIF NEW.do_mg_l IS NOT NULL AND NEW.do_mg_l > s.do_max THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'warning', 'water_quality',
      'High dissolved oxygen detected (' || NEW.do_mg_l || ' mg/L).',
      'Reduce aeration intensity and re-check sensor calibration.');
  END IF;

  -- pH
  IF NEW.ph IS NOT NULL AND NEW.ph < s.ph_min THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'warning', 'water_quality',
      'Acidic water detected (pH ' || NEW.ph || ').',
      'Apply agricultural lime in measured doses and re-test pH after a few hours.');
  ELSIF NEW.ph IS NOT NULL AND NEW.ph > s.ph_max THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'warning', 'water_quality',
      'Alkaline water detected (pH ' || NEW.ph || ').',
      'Partially exchange pond water and reduce organic load to lower pH.');
  END IF;

  -- Temperature
  IF NEW.temperature_c IS NOT NULL AND NEW.temperature_c < s.temp_min THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'warning', 'temperature',
      'Water temperature below optimal (' || NEW.temperature_c || ' °C).',
      'Reduce water exchange during cool periods and monitor feeding response.');
  ELSIF NEW.temperature_c IS NOT NULL AND NEW.temperature_c > s.temp_max THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'critical', 'temperature',
      'Water temperature above optimal (' || NEW.temperature_c || ' °C).',
      'Increase aeration, add fresh cooler water if available, and avoid heavy feeding during midday.');
  END IF;

  -- Turbidity
  IF NEW.turbidity_ntu IS NOT NULL AND NEW.turbidity_ntu > s.turbidity_max THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'warning', 'turbidity',
      'High turbidity detected (' || NEW.turbidity_ntu || ' NTU).',
      'Inspect for algal blooms or sediment disturbance; consider partial water exchange.');
  END IF;

  -- Multi-parameter stress warning
  IF (NEW.do_mg_l IS NOT NULL AND NEW.do_mg_l < s.do_min)
     AND (NEW.temperature_c IS NOT NULL AND NEW.temperature_c > s.temp_max) THEN
    INSERT INTO public.alerts(pond_id, severity, category, message, recommendation)
    VALUES (NEW.pond_id, 'critical', 'fish_stress',
      'Possible fish stress: low oxygen combined with high temperature.',
      'Stop feeding, run all aerators, and prepare emergency water exchange.');
  END IF;

  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.generate_alerts_from_reading() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_alerts ON public.sensor_readings;
CREATE TRIGGER trg_generate_alerts
AFTER INSERT ON public.sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.generate_alerts_from_reading();
