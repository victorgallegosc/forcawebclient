CREATE OR REPLACE FUNCTION public.apply_ride_change(_action text, _summary text, _rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Only the keys present in each patch are written; everything else keeps the
  -- value read under this same lock, so concurrent edits cannot clobber fields.
  INSERT INTO public.ride_days AS t (day, cancelled, override_driver, actual_driver, note)
  SELECT (r->>'day')::date,
         CASE WHEN r ? 'cancelled' THEN coalesce((r->>'cancelled')::boolean, false)
              ELSE coalesce(cur.cancelled, false) END,
         CASE WHEN r ? 'override_driver' THEN nullif(r->>'override_driver', '')
              ELSE cur.override_driver END,
         CASE WHEN r ? 'actual_driver' THEN nullif(r->>'actual_driver', '')
              ELSE cur.actual_driver END,
         CASE WHEN r ? 'note' THEN nullif(r->>'note', '')
              ELSE cur.note END
  FROM jsonb_array_elements(_rows) r
  LEFT JOIN public.ride_days cur ON cur.day = (r->>'day')::date
  ON CONFLICT (day) DO UPDATE SET
    cancelled = excluded.cancelled,
    override_driver = excluded.override_driver,
    actual_driver = excluded.actual_driver,
    note = excluded.note;

  INSERT INTO public.ride_log (action, summary, prev_state)
  VALUES (_action, _summary, _prev);
END;
$function$;