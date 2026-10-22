-- Use Philippine local dates consistently when deriving each growth record's
-- water-average window. The view remains live-derived so late readings can
-- update today's average.
CREATE OR REPLACE VIEW public.growth_records_with_water_averages
WITH (security_invoker = true)
AS
WITH growth_dates AS (
  SELECT
    growth.id,
    growth.pond_id,
    growth.fish_batch_id,
    growth.age_days,
    growth.avg_weight_g,
    growth.avg_length_cm,
    growth.feeding_notes,
    growth.pond_condition,
    growth.growth_status,
    growth.recorded_at,
    (growth.recorded_at AT TIME ZONE 'Asia/Manila')::date AS measurement_date,
    pond.name AS pond_name,
    batch.batch_name,
    batch.stocking_date,
    CASE
      WHEN growth.fish_batch_id IS NULL OR batch.stocking_date IS NULL THEN NULL
      ELSE (
        SELECT max((previous.recorded_at AT TIME ZONE 'Asia/Manila')::date)
        FROM public.bangus_growth_records AS previous
        WHERE previous.fish_batch_id = growth.fish_batch_id
          AND previous.pond_id = growth.pond_id
          AND (previous.recorded_at AT TIME ZONE 'Asia/Manila')::date
            < (growth.recorded_at AT TIME ZONE 'Asia/Manila')::date
      )
    END AS previous_measurement_date
  FROM public.bangus_growth_records AS growth
  LEFT JOIN public.pond_profiles AS pond ON pond.id = growth.pond_id
  LEFT JOIN public.fish_batches AS batch ON batch.id = growth.fish_batch_id
), growth_windows AS (
  SELECT
    growth_dates.*,
    CASE
      WHEN stocking_date IS NULL THEN NULL
      ELSE greatest(
        stocking_date,
        coalesce(previous_measurement_date + 1, stocking_date)
      )
    END AS average_start_date,
    measurement_date AS average_end_date
  FROM growth_dates
)
SELECT
  record_window.id,
  record_window.pond_id,
  record_window.fish_batch_id,
  record_window.batch_name,
  record_window.pond_name,
  record_window.stocking_date,
  record_window.age_days,
  record_window.avg_weight_g,
  record_window.avg_length_cm,
  record_window.feeding_notes,
  record_window.pond_condition,
  record_window.growth_status,
  record_window.recorded_at,
  record_window.measurement_date,
  record_window.average_start_date,
  record_window.average_end_date,
  water.avg_do_mg_l,
  water.do_reading_count,
  water.avg_ph,
  water.ph_reading_count,
  water.avg_temperature_c,
  water.temperature_reading_count,
  water.avg_turbidity_ntu,
  water.turbidity_reading_count,
  'pH-derived estimate from the second pH probe'::text AS do_source
FROM growth_windows AS record_window
LEFT JOIN LATERAL (
  SELECT
    avg(reading.do_mg_l) AS avg_do_mg_l,
    count(reading.do_mg_l)::integer AS do_reading_count,
    avg(reading.ph) AS avg_ph,
    count(reading.ph)::integer AS ph_reading_count,
    avg(reading.temperature_c) AS avg_temperature_c,
    count(reading.temperature_c)::integer AS temperature_reading_count,
    avg(reading.turbidity_ntu) AS avg_turbidity_ntu,
    count(reading.turbidity_ntu)::integer AS turbidity_reading_count
  FROM public.sensor_readings AS reading
  WHERE record_window.average_start_date IS NOT NULL
    AND record_window.average_start_date <= record_window.measurement_date
    AND reading.pond_id = record_window.pond_id
    AND reading.recorded_at >= (
      record_window.average_start_date::timestamp AT TIME ZONE 'Asia/Manila'
    )
    AND reading.recorded_at < (
      (record_window.average_end_date + 1)::timestamp AT TIME ZONE 'Asia/Manila'
    )
) AS water ON true;

COMMENT ON VIEW public.growth_records_with_water_averages IS
  'Growth rows with same-pond water averages from stocking or the day after the prior distinct Philippine-local sample date through the local measurement date. DO values are pH-derived estimates.';

REVOKE ALL ON public.growth_records_with_water_averages FROM PUBLIC, anon;
GRANT SELECT ON public.growth_records_with_water_averages TO authenticated;
