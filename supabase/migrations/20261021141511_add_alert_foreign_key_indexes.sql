-- Index foreign keys used by alert history and notification lookups.
CREATE INDEX alert_notification_events_alert_id_created_at_idx
  ON public.alert_notification_events (alert_id, created_at DESC);

CREATE INDEX alert_notification_events_pond_id_created_at_idx
  ON public.alert_notification_events (pond_id, created_at DESC);

CREATE INDEX alerts_acknowledged_by_idx
  ON public.alerts (acknowledged_by)
  WHERE acknowledged_by IS NOT NULL;

CREATE INDEX alerts_last_reading_id_idx
  ON public.alerts (last_reading_id)
  WHERE last_reading_id IS NOT NULL;
