import type { RideAdjustment } from "./rotation";

/**
 * Ride history for the 4to Torneo Fin de Semana 2026 (Gabo / Mau / Víctor).
 * Rotation order: Gabo → Mau → Víctor. Starts with Víctor (carry-over after the
 * previous match had no ride). Empty until rides of this tournament are logged.
 */
export const TOURNAMENT_RIDE_SEED: RideAdjustment[] = [];

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
        // Seed cancelled sticks; otherwise DB “Sin ride” applies.
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
