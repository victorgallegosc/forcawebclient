REVOKE EXECUTE ON FUNCTION public.apply_ride_change(TEXT, TEXT, JSONB) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.undo_last_ride_change() FROM anon, authenticated;