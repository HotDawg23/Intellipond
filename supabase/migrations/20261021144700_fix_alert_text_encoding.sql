-- Repair the malformed degree sign in existing alert text and normalize future rows.
CREATE OR REPLACE FUNCTION public.normalize_alert_content_encoding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.message := replace(NEW.message, chr(194) || chr(176), chr(176));
  NEW.recommendation := replace(NEW.recommendation, chr(194) || chr(176), chr(176));
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_alert_content_encoding() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS alerts_normalize_content_encoding ON public.alerts;
CREATE TRIGGER alerts_normalize_content_encoding
  BEFORE INSERT OR UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_alert_content_encoding();

DROP TRIGGER IF EXISTS alert_events_normalize_content_encoding ON public.alert_notification_events;
CREATE TRIGGER alert_events_normalize_content_encoding
  BEFORE INSERT OR UPDATE ON public.alert_notification_events
  FOR EACH ROW EXECUTE FUNCTION public.normalize_alert_content_encoding();

UPDATE public.alerts
SET message = replace(message, chr(194) || chr(176), chr(176)),
    recommendation = replace(recommendation, chr(194) || chr(176), chr(176))
WHERE position(chr(194) || chr(176) IN coalesce(message, '') || coalesce(recommendation, '')) > 0;

UPDATE public.alert_notification_events
SET message = replace(message, chr(194) || chr(176), chr(176)),
    recommendation = replace(recommendation, chr(194) || chr(176), chr(176))
WHERE position(chr(194) || chr(176) IN coalesce(message, '') || coalesce(recommendation, '')) > 0;
