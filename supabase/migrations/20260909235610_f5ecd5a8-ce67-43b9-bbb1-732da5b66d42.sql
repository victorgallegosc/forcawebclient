DROP POLICY IF EXISTS "ride_days open write" ON public.ride_days;
DROP POLICY IF EXISTS "ride_log open write" ON public.ride_log;

REVOKE INSERT, UPDATE, DELETE ON public.ride_days FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ride_log FROM anon, authenticated;

GRANT SELECT ON public.ride_days TO anon, authenticated;
GRANT SELECT ON public.ride_log TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_ride_change(_action TEXT, _summary TEXT, _rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days DATE[];
  _prev JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ride_days'));

  SELECT array_agg((r->>'day')::date) INTO _days FROM jsonb_array_elements(_rows) r;
  IF _days IS NULL OR array_length(_days, 1) IS NULL THEN
    RAISE EXCEPTION 'apply_ride_change requires at least one day';
  END IF;

  SELECT coalesce(jsonb_agg(entry), '[]'::jsonb) INTO _prev
  FROM (
    SELECT jsonb_build_object(
      'day', to_char(d, 'YYYY-MM-DD'),
      'cancelled', coalesce(rd.cancelled, false),
      'override_driver', rd.override_driver,
      'actual_driver', rd.actual_driver,
      'note', rd.note
    ) AS entry
    FROM unnest(_days) AS d
    LEFT JOIN public.ride_days rd ON rd.day = d
  ) s;

  INSERT INTO public.ride_days (day, cancelled, override_driver, actual_driver, note)
  SELECT (r->>'day')::date,
         coalesce((r->>'cancelled')::boolean, false),
         nullif(r->>'override_driver', ''),
         nullif(r->>'actual_driver', ''),
         nullif(r->>'note', '')
  FROM jsonb_array_elements(_rows) r
  ON CONFLICT (day) DO UPDATE SET
    cancelled = excluded.cancelled,
    override_driver = excluded.override_driver,
    actual_driver = excluded.actual_driver,
    note = excluded.note;

  INSERT INTO public.ride_log (action, summary, prev_state)
  VALUES (_action, _summary, _prev);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_last_ride_change()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry public.ride_log%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ride_days'));

  SELECT * INTO _entry
  FROM public.ride_log
  WHERE undone = false
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.ride_days (day, cancelled, override_driver, actual_driver, note)
  SELECT (r->>'day')::date,
         coalesce((r->>'cancelled')::boolean, false),
         nullif(r->>'override_driver', ''),
         nullif(r->>'actual_driver', ''),
         nullif(r->>'note', '')
  FROM jsonb_array_elements(_entry.prev_state) r
  ON CONFLICT (day) DO UPDATE SET
    cancelled = excluded.cancelled,
    override_driver = excluded.override_driver,
    actual_driver = excluded.actual_driver,
    note = excluded.note;

  UPDATE public.ride_log SET undone = true WHERE id = _entry.id;

  RETURN _entry.summary;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ride_change(TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_last_ride_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ride_change(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_last_ride_change() TO service_role;

CREATE TABLE IF NOT EXISTS public.league_cache (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.league_cache TO service_role;
ALTER TABLE public.league_cache ENABLE ROW LEVEL SECURITY;