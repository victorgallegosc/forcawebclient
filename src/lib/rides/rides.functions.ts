import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { DRIVERS, type RideAdjustment } from "./rotation";

export type RideLogEntry = {
  id: string;
  action: string;
  summary: string;
  prev_state: RideAdjustment[];
  undone: boolean;
  created_at: string;
};

export type RideState = {
  adjustments: RideAdjustment[];
  log: RideLogEntry[];
};

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const driverSchema = z.enum(DRIVERS);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readState(): Promise<RideState> {
  const db = await admin();
  const [days, log] = await Promise.all([
    db
      .from("ride_days")
      .select("day, cancelled, override_driver, actual_driver, note")
      .order("day"),
    db
      .from("ride_log")
      .select("id, action, summary, prev_state, undone, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  if (days.error) throw new Error(days.error.message);
  if (log.error) throw new Error(log.error.message);
  return {
    adjustments: (days.data ?? []) as RideAdjustment[],
    log: (log.data ?? []) as unknown as RideLogEntry[],
  };
}

/**
 * Both the schedule change and its history entry are written by one database
 * function, inside a single transaction, so an update can never land without
 * its undo entry and concurrent edits cannot snapshot stale state.
 */
async function applyChange(action: string, summary: string, rows: RideAdjustment[]) {
  const db = await admin();
  const { error } = await db.rpc("apply_ride_change", {
    _action: action,
    _summary: summary,
    _rows: rows as unknown as never,
  });
  if (error) throw new Error(error.message);
}

async function currentRows(days: string[]): Promise<RideAdjustment[]> {
  const db = await admin();
  const { data, error } = await db
    .from("ride_days")
    .select("day, cancelled, override_driver, actual_driver, note")
    .in("day", days);
  if (error) throw new Error(error.message);
  const byDay = new Map((data ?? []).map((row) => [row.day, row as RideAdjustment]));
  return days.map(
    (day) =>
      byDay.get(day) ?? {
        day,
        cancelled: false,
        override_driver: null,
        actual_driver: null,
        note: null,
      },
  );
}

export const getRideState = createServerFn({ method: "GET" }).handler(
  async (): Promise<RideState> => readState(),
);

export const swapDaysFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        dayA: daySchema,
        driverA: driverSchema,
        dayB: daySchema,
        driverB: driverSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [a, b] = await currentRows([data.dayA, data.dayB]);
    await applyChange(
      "swap",
      `${data.driverA} y ${data.driverB} se cambiaron de sábado`,
      [
        { ...a!, override_driver: data.driverB },
        { ...b!, override_driver: data.driverA },
      ],
    );
    return null;
  });

export const setCancelledFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ day: daySchema, cancelled: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const [row] = await currentRows([data.day]);
    await applyChange(
      "cancel",
      data.cancelled
        ? `Sin partido el ${data.day}`
        : `Se restauró el partido del ${data.day}`,
      [{ ...row!, cancelled: data.cancelled }],
    );
    return null;
  });

export const setActualDriverFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ day: daySchema, driver: driverSchema.nullable() }).parse(data),
  )
  .handler(async ({ data }) => {
    const [row] = await currentRows([data.day]);
    await applyChange(
      "drove",
      data.driver
        ? `${data.driver} manejó el ${data.day}`
        : `Se borró quién manejó el ${data.day}`,
      [{ ...row!, actual_driver: data.driver }],
    );
    return null;
  });

export const clearOverrideFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ day: daySchema }).parse(data))
  .handler(async ({ data }) => {
    const [row] = await currentRows([data.day]);
    await applyChange("reset", `Se restauró el turno normal del ${data.day}`, [
      { ...row!, override_driver: null },
    ]);
    return null;
  });

/** Restores the last change and consumes its history entry in one transaction. */
export const undoLastFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<string | null> => {
    const db = await admin();
    const { data, error } = await db.rpc("undo_last_ride_change");
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  },
);
