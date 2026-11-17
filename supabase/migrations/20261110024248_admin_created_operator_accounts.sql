ALTER TABLE public.profiles
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_initial_password_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Only the account service can change the initial password flag'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_initial_password_flag()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_initial_password_guard
  BEFORE UPDATE OF must_change_password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_initial_password_flag();
