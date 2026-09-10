// Thin client-side wrappers: every mutation runs on the server, where the
// change and its history entry are written in a single transaction.
import {
  clearOverrideFn,
  setActualDriverFn,
  setCancelledFn,
  swapDaysFn,
  undoLastFn,
} from "./rides.functions";
import type { Driver } from "./rotation";

export type { RideLogEntry, RideState } from "./rides.functions";

export async function swapDays(dayA: string, driverA: string, dayB: string, driverB: string) {
  await swapDaysFn({
    data: { dayA, driverA: driverA as Driver, dayB, driverB: driverB as Driver },
  });
}

export async function setCancelled(day: string, cancelled: boolean) {
  await setCancelledFn({ data: { day, cancelled } });
}

export async function setActualDriver(day: string, driver: string | null) {
  await setActualDriverFn({ data: { day, driver: (driver as Driver | null) ?? null } });
}

export async function clearOverride(day: string) {
  await clearOverrideFn({ data: { day } });
}

export async function undoLast(): Promise<string | null> {
  return undoLastFn();
}
