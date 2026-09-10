// Thin client wrappers: every mutation runs on the server in one transaction.
import {
  clearOverrideFn,
  setActualDriverFn,
  setCancelledFn,
  setOverrideDriverFn,
  undoLastFn,
} from "./rides.functions";
import type { Driver } from "./rotation";

export type { RideLogEntry, RideState } from "./rides.functions";

export async function setOverrideDriver(day: string, driver: string) {
  await setOverrideDriverFn({ data: { day, driver: driver as Driver } });
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
