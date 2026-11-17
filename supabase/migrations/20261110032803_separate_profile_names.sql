ALTER TABLE public.profiles
  ADD COLUMN first_name text,
  ADD COLUMN middle_name text,
  ADD COLUMN last_name text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  given_name text := nullif(btrim(NEW.raw_user_meta_data->>'first_name'), '');
  family_name text := nullif(btrim(NEW.raw_user_meta_data->>'last_name'), '');
BEGIN
  INSERT INTO public.profiles (id, first_name, middle_name, last_name, full_name, email)
  VALUES (
    NEW.id,
    given_name,
    nullif(btrim(NEW.raw_user_meta_data->>'middle_name'), ''),
    family_name,
    CASE WHEN given_name IS NOT NULL AND family_name IS NOT NULL THEN NULL
      ELSE nullif(btrim(NEW.raw_user_meta_data->>'full_name'), '') END,
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END;
$function$;
