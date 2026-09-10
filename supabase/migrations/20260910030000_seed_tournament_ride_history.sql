-- Seed tournament ride history from the group chat (Víctor / Mau / Gabo only).
-- Cancelled 2026-08-22 so the rol stays aligned with who was due on later Saturdays.

INSERT INTO public.ride_days (day, cancelled, override_driver, actual_driver, note)
VALUES
  ('2026-07-04', false, null, 'Mau', 'Le tocaba a Víctor. Gabo iba a pasar pero no pudo; Mau pasó por Víctor y dio el ride.'),
  ('2026-07-11', false, null, 'Mau', 'Gabo no llegó (dentista). Mau dio el ride.'),
  ('2026-07-18', false, null, 'Gabo', null),
  ('2026-07-25', false, null, 'Víctor', null),
  ('2026-08-01', false, null, 'Mau', null),
  ('2026-08-08', false, null, 'Víctor', 'Le tocaba a Gabo; Víctor dio el ride.'),
  ('2026-08-15', false, null, 'Gabo', 'Le tocaba a Víctor; Gabo dio el ride.'),
  ('2026-08-22', true, null, null, 'Sin ride del trio (vestidor / no se armaron ese sábado).'),
  ('2026-08-29', false, null, 'Mau', null)
ON CONFLICT (day) DO UPDATE SET
  cancelled = EXCLUDED.cancelled,
  actual_driver = EXCLUDED.actual_driver,
  note = EXCLUDED.note;
