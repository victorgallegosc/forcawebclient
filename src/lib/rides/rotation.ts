export const DRIVERS = ["Gabo", "Mau", "Víctor"] as const;
export type Driver = (typeof DRIVERS)[number];

/** First ride day of the tournament (2026-07-04) belonged to Gabo. */
export const ROTATION_START: Driver = "Gabo";

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
  /**
   * Signed favor balance: +1 when you cover someone, −1 when someone covers you.
   * Mutual covers between the same pair cancel out. All zeros ⇒ a mano.
   */
  balance: Record<Driver, number>;
  /** Alias of balance (kept for existing callers). */
  credits: Record<Driver, number>;
  even: boolean;
};

function isDriver(value: string | null | undefined): value is Driver {
  return Boolean(value && (DRIVERS as readonly string[]).includes(value));
}

/**
 * Round-robin Gabo → Mau → Víctor, starting at ROTATION_START.
 * Cancelled / sin-ride days skip the turn.
 *
 * If A drives when it was B’s turn: A +1 a favor, B −1 (en contra).
 * Later if B covers A, those entries cancel and both return toward a mano.
 */
export function computeRotation(
  fixtureDays: string[],
  adjustments: RideAdjustment[],
): RotationResult {
  const byDay = new Map(adjustments.map((entry) => [entry.day, entry]));
  const balance: Record<Driver, number> = { Gabo: 0, Mau: 0, "Víctor": 0 };
  const days: RideDay[] = [];
  let cursor = DRIVERS.indexOf(ROTATION_START);

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
      balance[actual] += 1;
      balance[dueDriver] -= 1;
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

  const even = balance.Gabo === 0 && balance.Mau === 0 && balance["Víctor"] === 0;

  return { days, balance, credits: { ...balance }, even };
}

export function formatBalance(value: number): string {
  if (value === 0) return "A mano";
  if (value > 0) return `${value} a favor`;
  return `${Math.abs(value)} en contra`;
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
