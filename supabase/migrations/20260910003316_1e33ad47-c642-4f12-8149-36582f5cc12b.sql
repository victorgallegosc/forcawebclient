-- Ride mutations stay behind the existing security-definer functions; only these
-- are callable from the app, so tables remain read-only to clients.
GRANT EXECUTE ON FUNCTION public.apply_ride_change(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_last_ride_change() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.read_league_cache(_key text)
RETURNS TABLE (payload jsonb, fetched_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.payload, c.fetched_at FROM public.league_cache c WHERE c.key = _key;
$$;

CREATE OR REPLACE FUNCTION public.write_league_cache(_key text, _payload jsonb, _fetched_at timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.league_cache (key, payload, fetched_at)
  VALUES (_key, _payload, _fetched_at)
  ON CONFLICT (key) DO UPDATE
    SET payload = excluded.payload, fetched_at = excluded.fetched_at;
$$;

GRANT EXECUTE ON FUNCTION public.read_league_cache(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_league_cache(text, jsonb, timestamptz) TO anon, authenticated;