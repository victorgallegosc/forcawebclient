-- Refresh ride history to confirmed tournament drivers (no motive notes).
-- 2026-07-04: Gabo (su turno). 2026-08-22: sin partido.

INSERT INTO public.ride_days (day, cancelled, override_driver, actual_driver, note)
VALUES
  ('2026-07-04', false, null, 'Gabo', null),
  ('2026-07-11', false, null, 'Mau', null),
  ('2026-07-18', false, null, 'Gabo', null),
  ('2026-07-25', false, null, 'Víctor', null),
  ('2026-08-01', false, null, 'Mau', null),
  ('2026-08-08', false, null, 'Víctor', null),
  ('2026-08-15', false, null, 'Gabo', null),
  ('2026-08-22', true, null, null, null),
  ('2026-08-29', false, null, 'Mau', null)
ON CONFLICT (day) DO UPDATE SET
  cancelled = EXCLUDED.cancelled,
  override_driver = EXCLUDED.override_driver,
  actual_driver = EXCLUDED.actual_driver,
  note = NULL;
