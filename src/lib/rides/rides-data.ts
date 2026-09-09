import { supabase } from "@/integrations/supabase/client";

import type { RideAdjustment } from "./rotation";

export type RideLogEntry = {
  id: string;
  action: string;
  summary: string;
  prev_state: RideAdjustment[];
  undone: boolean;
  created_at: string;
};

const EMPTY = {
  cancelled: false,
  override_driver: null as string | null,
  actual_driver: null as string | null,
  note: null as string | null,
};

export async function loadAdjustments(): Promise<RideAdjustment[]> {
  const { data, error } = await supabase
    .from("ride_days")
    .select("day, cancelled, override_driver, actual_driver, note")
    .order("day");
  if (error) throw error;
  return (data ?? []) as RideAdjustment[];
}

export async function loadLog(): Promise<RideLogEntry[]> {
  const { data, error } = await supabase
    .from("ride_log")
    .select("id, action, summary, prev_state, undone, created_at")
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw error;
  return (data ?? []) as unknown as RideLogEntry[];
}

async function snapshot(days: string[]): Promise<RideAdjustment[]> {
  const current = await loadAdjustments();
  const byDay = new Map(current.map((entry) => [entry.day, entry]));
  return days.map((day) => byDay.get(day) ?? { day, ...EMPTY });
}

async function upsert(rows: RideAdjustment[]) {
  const { error } = await supabase.from("ride_days").upsert(rows, { onConflict: "day" });
  if (error) throw error;
}

async function record(action: string, summary: string, prev: RideAdjustment[]) {
  const { error } = await supabase
    .from("ride_log")
    .insert({ action, summary, prev_state: prev as unknown as never });
  if (error) throw error;
}

/** Two Saturdays trade drivers; the rotation continues normally afterwards. */
export async function swapDays(
  dayA: string,
  driverA: string,
  dayB: string,
  driverB: string,
) {
  const prev = await snapshot([dayA, dayB]);
  const byDay = new Map(prev.map((entry) => [entry.day, entry]));
  await upsert([
    { ...byDay.get(dayA)!, override_driver: driverB },
    { ...byDay.get(dayB)!, override_driver: driverA },
  ]);
  await record("swap", `${driverA} y ${driverB} se cambiaron de sábado`, prev);
}

export async function setCancelled(day: string, cancelled: boolean) {
  const prev = await snapshot([day]);
  await upsert([{ ...prev[0]!, cancelled }]);
  await record(
    "cancel",
    cancelled ? `Sin partido el ${day}` : `Se restauró el partido del ${day}`,
    prev,
  );
}

export async function setActualDriver(day: string, driver: string | null) {
  const prev = await snapshot([day]);
  await upsert([{ ...prev[0]!, actual_driver: driver }]);
  await record(
    "drove",
    driver ? `${driver} manejó el ${day}` : `Se borró quién manejó el ${day}`,
    prev,
  );
}

export async function clearOverride(day: string) {
  const prev = await snapshot([day]);
  await upsert([{ ...prev[0]!, override_driver: null }]);
  await record("reset", `Se restauró el turno normal del ${day}`, prev);
}

/** Reverses the most recent change. */
export async function undoLast(): Promise<string | null> {
  const { data, error } = await supabase
    .from("ride_log")
    .select("id, summary, prev_state")
    .eq("undone", false)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const entry = data?.[0];
  if (!entry) return null;

  await upsert(entry.prev_state as unknown as RideAdjustment[]);
  const { error: markError } = await supabase
    .from("ride_log")
    .update({ undone: true })
    .eq("id", entry.id);
  if (markError) throw markError;
  return entry.summary;
}
