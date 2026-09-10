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
  /** Who the rotation says was due (ignores overrides). */
  dueDriver: Driver | null;
  /** Who is assigned to drive after Cambiar (override or due). */
  driver: Driver | null;
  /** Who actually drove, when recorded. */
  actualDriver: string | null;
  swapped: boolean;
  /** True when someone else drove instead of who was due. */
  covered: boolean;
};

export type RotationResult = {
  days: RideDay[];
  /** Raw cover counts. */
  credits: Record<Driver, number>;
  /** Credits minus the minimum — when everyone is even, all are 0 (a mano). */
  balance: Record<Driver, number>;
  even: boolean;
};

function isDriver(value: string | null | undefined): value is Driver {
  return Boolean(value && (DRIVERS as readonly string[]).includes(value));
}

/**
 * Round-robin Víctor → Mau → Gabo. Cancelled / sin-ride days skip the turn.
 * Covering someone else's ride grants a favor credit. Balances are relative:
 * if everyone has the same raw credit, they are a mano (balance 0).
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
        dueDriver: null,
        driver: null,
        actualDriver: null,
        swapped: false,
        covered: false,
      });
      continue;
    }

    const dueDriver = DRIVERS[cursor % DRIVERS.length]!;
    cursor += 1;

    const override = isDriver(entry?.override_driver) ? entry!.override_driver : null;
    const driver = (override ?? dueDriver) as Driver;
    const actual = entry?.actual_driver ?? null;
    const covered = Boolean(actual && actual !== dueDriver && isDriver(actual));

    if (covered && isDriver(actual)) {
      credits[actual] += 1;
    }

    days.push({
      day,
      cancelled: false,
      dueDriver,
      driver,
      actualDriver: actual,
      swapped: Boolean(override && override !== dueDriver),
      covered,
    });
  }

  const values = DRIVERS.map((driver) => credits[driver]);
  const floor = Math.min(...values);
  const balance = {
    "Víctor": credits["Víctor"] - floor,
    Mau: credits.Mau - floor,
    Gabo: credits.Gabo - floor,
  };
  const even = balance["Víctor"] === 0 && balance.Mau === 0 && balance.Gabo === 0;

  return { days, credits, balance, even };
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
