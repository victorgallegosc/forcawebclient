import type { RideAdjustment } from "./rotation";

/**
 * Ride history for the 3er Torneo 2026 (Gabo / Mau / Víctor only).
 * Rotation: Gabo → Mau → Víctor, starting 2026-07-04 with Gabo.
 * Cancelled / sin-ride days skip the turn. No motive notes.
 */
export const TOURNAMENT_RIDE_SEED: RideAdjustment[] = [
  { day: "2026-07-04", cancelled: false, override_driver: null, actual_driver: "Gabo", note: null },
  { day: "2026-07-11", cancelled: false, override_driver: null, actual_driver: "Mau", note: null },
  { day: "2026-07-18", cancelled: false, override_driver: null, actual_driver: "Gabo", note: null },
  { day: "2026-07-25", cancelled: false, override_driver: null, actual_driver: "Víctor", note: null },
  { day: "2026-08-01", cancelled: false, override_driver: null, actual_driver: "Mau", note: null },
  { day: "2026-08-08", cancelled: false, override_driver: null, actual_driver: "Víctor", note: null },
  { day: "2026-08-15", cancelled: false, override_driver: null, actual_driver: "Gabo", note: null },
  { day: "2026-08-22", cancelled: true, override_driver: null, actual_driver: null, note: null },
  { day: "2026-08-29", cancelled: false, override_driver: null, actual_driver: "Mau", note: null },
];

/** Seed owns known tournament history; DB can still set overrides for “Cambiar”. */
export function mergeRideAdjustments(
  seed: RideAdjustment[],
  stored: RideAdjustment[],
): RideAdjustment[] {
  const byDay = new Map<string, RideAdjustment>();
  const seedDays = new Set(seed.map((entry) => entry.day));

  for (const entry of seed) {
    byDay.set(entry.day, { ...entry });
  }

  for (const entry of stored) {
    if (seedDays.has(entry.day)) {
      const base = byDay.get(entry.day)!;
      byDay.set(entry.day, {
        ...base,
        // Seed owns who actually drove on known history days.
        actual_driver: base.actual_driver ?? entry.actual_driver,
        // Seed cancelled (e.g. Aug 22) sticks; otherwise DB “Sin ride” applies.
        cancelled: base.cancelled || entry.cancelled,
        override_driver: entry.override_driver ?? base.override_driver,
        note: null,
      });
      continue;
    }
    byDay.set(entry.day, { ...entry, note: null });
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
