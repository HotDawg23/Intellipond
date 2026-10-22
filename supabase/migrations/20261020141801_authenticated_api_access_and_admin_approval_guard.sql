CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
      AND _user_id IS DISTINCT FROM auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles AS caller_role
        WHERE caller_role.user_id = auth.uid()
          AND caller_role.role = 'admin'
      )
    THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles AS target_role
      WHERE target_role.user_id = _user_id
        AND target_role.role = _role
    )
  END;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    IF current_user IN ('postgres', 'service_role') THEN
      RETURN NEW;
    END IF;

    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can change profile approval status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_approval_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_approval_guard ON public.profiles;
CREATE TRIGGER profiles_approval_guard
  BEFORE UPDATE OF approved ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_approval_change();
