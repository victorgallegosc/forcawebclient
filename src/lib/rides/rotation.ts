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
  /** Who is supposed to drive (after swaps). */
  driver: Driver | null;
  /** Who actually drove, when recorded. */
  actualDriver: string | null;
  swapped: boolean;
  /** True when someone else drove instead of the assigned driver. */
  covered: boolean;
  note: string | null;
};

export type RotationResult = {
  days: RideDay[];
  credits: Record<Driver, number>;
};

function isDriver(value: string | null | undefined): value is Driver {
  return Boolean(value && (DRIVERS as readonly string[]).includes(value));
}

/**
 * Round-robin Víctor → Mau → Gabo. Cancelled days do not consume a turn.
 * Covering someone else's ride grants a "ride a favor" credit (shown in UI);
 * credits are not auto-spent so the rol stays aligned with how the group counts.
 */
export function computeRotation(
  fixtureDays: string[],
  adjustments: RideAdjustment[],
): RotationResult {
  const byDay = new Map(adjustments.map((entry) => [entry.day, entry]));
  const credits: Record<Driver, number> = { "Víctor": 0, Mau: 0, Gabo: 0 };
  const days: RideDay[] = [];
  let cursor = 0;

  for (const day of [...fixtureDays].sort()) {
    const entry = byDay.get(day);

    if (entry?.cancelled) {
      days.push({
        day,
        cancelled: true,
        driver: null,
        actualDriver: null,
        swapped: false,
        covered: false,
        note: entry.note ?? null,
      });
      continue;
    }

    const rotationPick = DRIVERS[cursor % DRIVERS.length]!;
    cursor += 1;

    const override = isDriver(entry?.override_driver) ? entry!.override_driver : null;
    const driver = (override ?? rotationPick) as Driver;
    const actual = entry?.actual_driver ?? null;
    const covered = Boolean(actual && actual !== driver && isDriver(actual));

    if (covered && isDriver(actual)) {
      credits[actual] += 1;
    }

    days.push({
      day,
      cancelled: false,
      driver,
      actualDriver: actual,
      swapped: Boolean(override && override !== rotationPick),
      covered,
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
