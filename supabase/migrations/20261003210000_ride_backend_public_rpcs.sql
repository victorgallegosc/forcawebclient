CREATE TABLE IF NOT EXISTS public.ride_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day DATE NOT NULL UNIQUE,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  override_driver TEXT,
  actual_driver TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ride_days TO anon, authenticated;
GRANT ALL ON public.ride_days TO service_role;
ALTER TABLE public.ride_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ride_days open read" ON public.ride_days;
CREATE POLICY "ride_days open read" ON public.ride_days FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.ride_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  prev_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  undone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ride_log TO anon, authenticated;
GRANT ALL ON public.ride_log TO service_role;
ALTER TABLE public.ride_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ride_log open read" ON public.ride_log;
CREATE POLICY "ride_log open read" ON public.ride_log FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.league_cache (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.league_cache TO service_role;
ALTER TABLE public.league_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS ride_days_touch ON public.ride_days;
CREATE TRIGGER ride_days_touch BEFORE UPDATE ON public.ride_days
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.apply_ride_change(_action text, _summary text, _rows jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _days DATE[]; _prev JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ride_days'));
  SELECT array_agg((r->>'day')::date) INTO _days FROM jsonb_array_elements(_rows) r;
  IF _days IS NULL OR array_length(_days, 1) IS NULL THEN
    RAISE EXCEPTION 'apply_ride_change requires at least one day';
  END IF;
  SELECT coalesce(jsonb_agg(entry), '[]'::jsonb) INTO _prev FROM (
    SELECT jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'),
      'cancelled', coalesce(rd.cancelled, false), 'override_driver', rd.override_driver,
      'actual_driver', rd.actual_driver, 'note', rd.note) AS entry
    FROM unnest(_days) AS d LEFT JOIN public.ride_days rd ON rd.day = d) s;
  INSERT INTO public.ride_days AS t (day, cancelled, override_driver, actual_driver, note)
  SELECT (r->>'day')::date,
    CASE WHEN r ? 'cancelled' THEN coalesce((r->>'cancelled')::boolean, false) ELSE coalesce(cur.cancelled, false) END,
    CASE WHEN r ? 'override_driver' THEN nullif(r->>'override_driver', '') ELSE cur.override_driver END,
    CASE WHEN r ? 'actual_driver' THEN nullif(r->>'actual_driver', '') ELSE cur.actual_driver END,
    CASE WHEN r ? 'note' THEN nullif(r->>'note', '') ELSE cur.note END
  FROM jsonb_array_elements(_rows) r
  LEFT JOIN public.ride_days cur ON cur.day = (r->>'day')::date
  ON CONFLICT (day) DO UPDATE SET cancelled = excluded.cancelled,
    override_driver = excluded.override_driver, actual_driver = excluded.actual_driver, note = excluded.note;
  INSERT INTO public.ride_log (action, summary, prev_state) VALUES (_action, _summary, _prev);
END; $function$;

CREATE OR REPLACE FUNCTION public.undo_last_ride_change()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _entry public.ride_log%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ride_days'));
  SELECT * INTO _entry FROM public.ride_log WHERE undone = false ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.ride_days (day, cancelled, override_driver, actual_driver, note)
  SELECT (r->>'day')::date, coalesce((r->>'cancelled')::boolean, false),
    nullif(r->>'override_driver', ''), nullif(r->>'actual_driver', ''), nullif(r->>'note', '')
  FROM jsonb_array_elements(_entry.prev_state) r
  ON CONFLICT (day) DO UPDATE SET cancelled = excluded.cancelled,
    override_driver = excluded.override_driver, actual_driver = excluded.actual_driver, note = excluded.note;
  UPDATE public.ride_log SET undone = true WHERE id = _entry.id;
  RETURN _entry.summary;
END; $$;

CREATE OR REPLACE FUNCTION public.read_league_cache(_key text)
RETURNS TABLE (payload jsonb, fetched_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.payload, c.fetched_at FROM public.league_cache c WHERE c.key = _key;
$$;
CREATE OR REPLACE FUNCTION public.write_league_cache(_key text, _payload jsonb, _fetched_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.league_cache (key, payload, fetched_at) VALUES (_key, _payload, _fetched_at)
  ON CONFLICT (key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at;
$$;

REVOKE ALL ON FUNCTION public.apply_ride_change(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_last_ride_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ride_change(text, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_last_ride_change() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_league_cache(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.write_league_cache(text, jsonb, timestamptz) TO anon, authenticated, service_role;
