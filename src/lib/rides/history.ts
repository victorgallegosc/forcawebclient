import type { RideAdjustment } from "./rotation";

/**
 * Ride history reconstructed from the group chat for the 3er Torneo 2026.
 * Only Víctor, Mau and Gabo rotate — the fourth chat member does not do rides.
 *
 * Rotation is Víctor → Mau → Gabo. When someone else drove, `actual_driver`
 * records it (and that person gets a ride a favor). 22 ago was marked without
 * ride for the trio (vestidor / no se armaron), so it does not advance the rol.
 */
export const TOURNAMENT_RIDE_SEED: RideAdjustment[] = [
  {
    day: "2026-07-04",
    cancelled: false,
    override_driver: null,
    actual_driver: "Mau",
    note: "Le tocaba a Víctor. Gabo iba a pasar pero no pudo; Mau pasó por Víctor y dio el ride.",
  },
  {
    day: "2026-07-11",
    cancelled: false,
    override_driver: null,
    actual_driver: "Mau",
    note: "Gabo no llegó (dentista). Mau dio el ride.",
  },
  {
    day: "2026-07-18",
    cancelled: false,
    override_driver: null,
    actual_driver: "Gabo",
    note: null,
  },
  {
    day: "2026-07-25",
    cancelled: false,
    override_driver: null,
    actual_driver: "Víctor",
    note: null,
  },
  {
    day: "2026-08-01",
    cancelled: false,
    override_driver: null,
    actual_driver: "Mau",
    note: null,
  },
  {
    day: "2026-08-08",
    cancelled: false,
    override_driver: null,
    actual_driver: "Víctor",
    note: "Le tocaba a Gabo; Víctor dio el ride.",
  },
  {
    day: "2026-08-15",
    cancelled: false,
    override_driver: null,
    actual_driver: "Gabo",
    note: "Le tocaba a Víctor; Gabo dio el ride.",
  },
  {
    day: "2026-08-22",
    cancelled: true,
    override_driver: null,
    actual_driver: null,
    note: "Sin ride del trio (vestidor / no se armaron ese sábado).",
  },
  {
    day: "2026-08-29",
    cancelled: false,
    override_driver: null,
    actual_driver: "Mau",
    note: null,
  },
];

/** Seed is source of truth for known tournament days; DB can still set overrides. */
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
        override_driver: entry.override_driver ?? base.override_driver,
      });
      continue;
    }
    byDay.set(entry.day, { ...entry });
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
