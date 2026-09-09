export const DRIVERS = ["Víctor", "Mau", "Gabo"] as const;
export type Driver = (typeof DRIVERS)[number];

export type RideAdjustment = {
  day: string; // YYYY-MM-DD
  cancelled: boolean;
  override_driver: string | null;
  actual_driver: string | null;
  note: string | null;
};

export type RideDay = {
  day: string;
  cancelled: boolean;
  /** Who is supposed to drive (after swaps and skipped turns). */
  driver: Driver | null;
  /** Who actually drove, when recorded. */
  actualDriver: string | null;
  swapped: boolean;
  note: string | null;
};

export type RotationResult = {
  days: RideDay[];
  credits: Record<Driver, number>;
};

/**
 * Rotation is always recomputed from the fixture list plus the stored
 * adjustments, so swaps, cancelled games and covered turns can never desync.
 */
export function computeRotation(
  fixtureDays: string[],
  adjustments: RideAdjustment[],
): RotationResult {
  const byDay = new Map(adjustments.map((entry) => [entry.day, entry]));
  const credits: Record<Driver, number> = { "Víctor": 0, Mau: 0, Gabo: 0 };
  const days: RideDay[] = [];
  let cursor = 0;

  const takeNext = (): Driver => {
    for (let guard = 0; guard < 12; guard++) {
      const candidate = DRIVERS[cursor % DRIVERS.length]!;
      cursor += 1;
      if (credits[candidate] > 0) {
        credits[candidate] -= 1;
        continue;
      }
      return candidate;
    }
    return DRIVERS[cursor % DRIVERS.length]!;
  };

  for (const day of [...fixtureDays].sort()) {
    const entry = byDay.get(day);

    if (entry?.cancelled) {
      days.push({
        day,
        cancelled: true,
        driver: null,
        actualDriver: null,
        swapped: false,
        note: entry.note ?? null,
      });
      continue;
    }

    const rotationPick = takeNext();
    const override = (entry?.override_driver ?? null) as Driver | null;
    const driver = override ?? rotationPick;
    const actual = entry?.actual_driver ?? null;

    if (actual && actual !== driver && (DRIVERS as readonly string[]).includes(actual)) {
      credits[actual as Driver] += 1;
    }

    days.push({
      day,
      cancelled: false,
      driver,
      actualDriver: actual,
      swapped: Boolean(override && override !== rotationPick),
      note: entry?.note ?? null,
    });
  }

  return { days, credits };
}

export function formatDay(day: string): string {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, dayOfMonth ?? 1));
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export function todayInMonterrey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
