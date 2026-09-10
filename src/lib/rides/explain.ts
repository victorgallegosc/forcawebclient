import {
  DRIVERS,
  formatBalance,
  formatDay,
  type Driver,
  type RotationResult,
} from "./rotation";

export type RideExplainEvent = {
  day: string;
  dueDriver: Driver;
  actualDriver: Driver;
};

export type RideExplainResult = {
  text: string;
  source: "ai" | "local";
};

/** Facts taken only from the page rotation (no WhatsApp / free-text motives). */
export function buildRideExplainContext(rotation: RotationResult): {
  balances: { driver: Driver; value: number; label: string }[];
  even: boolean;
  covers: RideExplainEvent[];
  matched: { day: string; driver: Driver }[];
  cancelled: string[];
  order: readonly Driver[];
} {
  const covers: RideExplainEvent[] = [];
  const matched: { day: string; driver: Driver }[] = [];
  const cancelled: string[] = [];

  for (const day of rotation.days) {
    if (day.cancelled) {
      cancelled.push(day.day);
      continue;
    }
    if (!day.dueDriver) continue;
    const actual = (day.actualDriver ?? day.driver) as Driver | null;
    if (!actual) continue;
    if (day.covered && actual !== day.dueDriver) {
      covers.push({ day: day.day, dueDriver: day.dueDriver, actualDriver: actual });
    } else if (actual === day.dueDriver) {
      matched.push({ day: day.day, driver: actual });
    }
  }

  return {
    balances: DRIVERS.map((driver) => ({
      driver,
      value: rotation.balance[driver],
      label: formatBalance(rotation.balance[driver]),
    })),
    even: rotation.even,
    covers,
    matched,
    cancelled,
    order: DRIVERS,
  };
}

/** Deterministic explanation grounded only in rotation history. */
export function buildLocalRideExplanation(rotation: RotationResult): string {
  const ctx = buildRideExplainContext(rotation);
  const lines: string[] = [];

  lines.push(
    `La rotación va ${ctx.order.join(" → ")}. Si A da el ride cuando le tocaba a B, A queda +1 a favor y B −1 en contra; si después se cubren al revés, se cancelan.`,
  );

  if (ctx.covers.length === 0) {
    lines.push(
      "En el historial de la página, cada sábado con ride coincidió con quien tocaba (o no hay coberturas registradas), así que no hubo movimientos de saldo.",
    );
  } else {
    lines.push("Coberturas que movieron el saldo:");
    for (const event of ctx.covers) {
      lines.push(
        `• ${formatDay(event.day)}: le tocaba a ${event.dueDriver} y dio el ride ${event.actualDriver} → ${event.actualDriver} +1 a favor, ${event.dueDriver} −1 en contra.`,
      );
    }
  }

  if (ctx.cancelled.length > 0) {
    lines.push(
      `Días sin ride (no cuentan turno): ${ctx.cancelled.map((day) => formatDay(day)).join(", ")}.`,
    );
  }

  if (ctx.even) {
    const pairs = summarizeBalancedPairs(ctx.covers);
    lines.push(
      pairs.length > 0
        ? `Por eso hoy todos están a mano: ${pairs.join(" ")}`
        : "Por eso hoy todos están a mano.",
    );
  } else {
    lines.push(
      `Saldos actuales: ${ctx.balances
        .map((row) => `${row.driver} ${row.label.toLowerCase()}`)
        .join("; ")}.`,
    );
  }

  return lines.join("\n\n");
}

function summarizeBalancedPairs(covers: RideExplainEvent[]): string[] {
  const deltas = new Map<string, number>();
  for (const event of covers) {
    const key = [event.actualDriver, event.dueDriver].sort().join("|");
    const [first] = key.split("|") as [string, string];
    const delta = event.actualDriver === first ? 1 : -1;
    deltas.set(key, (deltas.get(key) ?? 0) + delta);
  }
  const notes: string[] = [];
  for (const [key, value] of deltas) {
    if (value !== 0) continue;
    const [x, y] = key.split("|") as [string, string];
    notes.push(`${x} y ${y} se cubrieron entre sí y quedaron a mano.`);
  }
  return notes;
}

function openaiKey(): string | undefined {
  return (
    process.env["OPENAI_API_KEY"] ||
    process.env["OPENAI_KEY"] ||
    process.env["AI_API_KEY"] ||
    undefined
  );
}

export async function explainRideBalances(
  rotation: RotationResult,
): Promise<RideExplainResult> {
  const local = buildLocalRideExplanation(rotation);
  const key = openaiKey();
  if (!key) return { text: local, source: "local" };

  const ctx = buildRideExplainContext(rotation);
  const payload = {
    orden: ctx.order,
    saldos: Object.fromEntries(ctx.balances.map((row) => [row.driver, row.value])),
    coberturas: ctx.covers.map((event) => ({
      fecha: event.day,
      le_tocaba: event.dueDriver,
      dio_ride: event.actualDriver,
    })),
    dias_sin_ride: ctx.cancelled,
    a_mano: ctx.even,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env["OPENAI_MODEL"] || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Eres la voz clara de la app Cancha. Explicas saldos de rides en español mexicano, breve y concreto. SOLO puedes usar los hechos JSON del historial de la página. Regla: rotación Gabo → Mau → Víctor; si A cubre a B entonces A +1 y B −1; coberturas mutuas se cancelan. No inventes motivos, chats de WhatsApp, ni fechas que no vengan en el JSON. 3–6 oraciones o viñetas cortas.",
          },
          {
            role: "user",
            content: `Explica los saldos a favor / en contra / a mano y el porqué con este historial:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) return { text: local, source: "local" };

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { text: local, source: "local" };
    return { text, source: "ai" };
  } catch {
    return { text: local, source: "local" };
  }
}
