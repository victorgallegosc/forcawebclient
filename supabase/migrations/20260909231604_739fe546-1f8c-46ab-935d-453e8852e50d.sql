CREATE TABLE public.ride_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day DATE NOT NULL UNIQUE,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  override_driver TEXT,
  actual_driver TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_days TO anon, authenticated;
GRANT ALL ON public.ride_days TO service_role;
ALTER TABLE public.ride_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ride_days open read" ON public.ride_days FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ride_days open write" ON public.ride_days FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ride_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  prev_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  undone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_log TO anon, authenticated;
GRANT ALL ON public.ride_log TO service_role;
ALTER TABLE public.ride_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ride_log open read" ON public.ride_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ride_log open write" ON public.ride_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ride_days_touch BEFORE UPDATE ON public.ride_days
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();