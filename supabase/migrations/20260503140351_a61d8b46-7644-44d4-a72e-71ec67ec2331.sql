
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile + default operator role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Pond profiles
CREATE TABLE public.pond_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  area_sqm NUMERIC,
  stocking_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pond_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view ponds" ON public.pond_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ponds" ON public.pond_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sensor readings
CREATE TABLE public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pond_id UUID REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  do_mg_l NUMERIC,
  ph NUMERIC,
  temperature_c NUMERIC,
  turbidity_ntu NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view readings" ON public.sensor_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage readings" ON public.sensor_readings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sensor status
CREATE TABLE public.sensor_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pond_id UUID REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  last_sync TIMESTAMPTZ,
  error_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sensor_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view status" ON public.sensor_status FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage status" ON public.sensor_status FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Growth records
CREATE TABLE public.bangus_growth_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pond_id UUID REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  age_days INT,
  avg_weight_g NUMERIC,
  avg_length_cm NUMERIC,
  feeding_notes TEXT,
  pond_condition TEXT,
  growth_status TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bangus_growth_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view growth" ON public.bangus_growth_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage growth" ON public.bangus_growth_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Behavior predictions
CREATE TABLE public.behavior_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pond_id UUID REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  behavior_label TEXT NOT NULL,
  confidence NUMERIC,
  source_reading_id UUID REFERENCES public.sensor_readings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.behavior_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view predictions" ON public.behavior_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage predictions" ON public.behavior_predictions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pond_id UUID REFERENCES public.pond_profiles(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  recommendation TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage alerts" ON public.alerts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin settings (singleton row keyed by id=1 via slug)
CREATE TABLE public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_min NUMERIC NOT NULL DEFAULT 4,
  do_max NUMERIC NOT NULL DEFAULT 9,
  ph_min NUMERIC NOT NULL DEFAULT 6.5,
  ph_max NUMERIC NOT NULL DEFAULT 8.5,
  temp_min NUMERIC NOT NULL DEFAULT 26,
  temp_max NUMERIC NOT NULL DEFAULT 32,
  turbidity_max NUMERIC NOT NULL DEFAULT 80,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage settings" ON public.admin_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ML model config
CREATE TABLE public.ml_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selected_model TEXT NOT NULL DEFAULT 'random_forest',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.ml_model_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view model" ON public.ml_model_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage model" ON public.ml_model_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage reports" ON public.reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.behavior_predictions;
