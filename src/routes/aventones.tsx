import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Car, RotateCcw, Undo2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { PageShell, Panel } from "@/components/app-shell";
import { rideStateQuery, scheduleQuery } from "@/lib/queries";
import {
  clearOverride,
  setActualDriver,
  setCancelled,
  swapDays,
  undoLast,
} from "@/lib/rides/rides-data";
import {
  DRIVERS,
  computeRotation,
  formatDay,
  todayInMonterrey,
  type Driver,
} from "@/lib/rides/rotation";
import { cn } from "@/lib/utils";
import { isUs } from "@/components/league-bits";

export const Route = createFileRoute("/aventones")({
  head: () => ({
    meta: [
      { title: "Turnos de aventón · Sunderland A3860" },
      {
        name: "description",
        content:
          "A quién le toca manejar cada sábado: rotación entre Víctor, Mau y Gabo, con cambios, partidos cancelados y turnos cubiertos.",
      },
      { property: "og:title", content: "Turnos de aventón · Sunderland A3860" },
      { property: "og:description", content: "A quién le toca manejar este sábado." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(rideStateQuery),
    ]);
  },
  component: AventonesPage,
  errorComponent: () => (
    <PageShell title="Aventones" description="No pudimos cargar los turnos ahora mismo.">
      <Panel>Intenta de nuevo en unos minutos.</Panel>
    </PageShell>
  ),
});

function AventonesPage() {
  const queryClient = useQueryClient();
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const rideState = useSuspenseQuery(rideStateQuery).data;
  const adjustments = rideState.adjustments;
  const log = rideState.log;
  const [message, setMessage] = useState<string | null>(null);
  const [swapWith, setSwapWith] = useState<string | null>(null);

  const fixtureDays = useMemo(() => {
    const days = new Set<string>();
    for (const group of schedule.data) {
      for (const week of group.weeks) {
        for (const match of week.matches) {
          if (match.iso && (isUs(match.home) || isUs(match.away))) days.add(match.iso);
        }
      }
    }
    return [...days].sort();
  }, [schedule]);

  const rotation = useMemo(
    () => computeRotation(fixtureDays, adjustments),
    [fixtureDays, adjustments],
  );

  const today = todayInMonterrey();
  const upcoming = rotation.days.filter((day) => day.day >= today);
  const past = rotation.days.filter((day) => day.day < today).reverse();
  const next = upcoming.find((day) => !day.cancelled);

  const run = useMutation({
    mutationFn: async (task: () => Promise<string | null | void>) => task(),
    onSuccess: async (result) => {
      setMessage(typeof result === "string" ? result : "Listo, turnos actualizados.");
      setSwapWith(null);
      await queryClient.invalidateQueries({ queryKey: ["ride-state"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const swapTargets = upcoming.filter((day) => !day.cancelled && day.driver);

  return (
    <PageShell
      eyebrow="Rol de manejo"
      title="Turnos de aventón"
      description="Rotación fija entre Víctor, Mau y Gabo sobre los sábados que Sunderland juega."
    >
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <Panel className="relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Próximo sábado
          </p>
          {next ? (
            <>
              <p className="display-title mt-3 text-6xl">{next.driver}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Maneja el {formatDay(next.day)}
                {next.swapped ? " · cambio acordado" : ""}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    run.mutate(() => setActualDriver(next.day, next.driver as string))
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Car className="size-4" /> Confirmar que manejó
                </button>
                <button
                  onClick={() => run.mutate(() => setCancelled(next.day, true))}
                  className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
                >
                  <XCircle className="size-4" /> No hay partido
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-muted-foreground">No hay sábados pendientes en el calendario.</p>
          )}
        </Panel>

        <Panel>
          <h2 className="text-2xl">Turnos a favor</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quien cubre un turno ajeno se salta el suyo siguiente.
          </p>
          <div className="mt-4 space-y-2">
            {DRIVERS.map((driver) => (
              <div
                key={driver}
                className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3"
              >
                <span className="font-semibold">{driver}</span>
                <span className="text-sm text-muted-foreground">
                  {rotation.credits[driver as Driver]} a favor
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => run.mutate(() => undoLast().then((s) => (s ? `Se deshizo: ${s}` : "No hay nada que deshacer.")))}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
          >
            <Undo2 className="size-4" /> Deshacer último cambio
          </button>
        </Panel>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-accent/15 px-4 py-3 text-sm text-accent">{message}</p>
      ) : null}

      <Panel className="mt-6">
        <h2 className="text-2xl">Próximos sábados</h2>
        <div className="mt-4 space-y-2">
          {upcoming.map((day) => (
            <div key={day.day} className="rounded-xl bg-secondary/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">{formatDay(day.day)}</span>
                <span
                  className={cn(
                    "font-semibold",
                    day.cancelled ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {day.cancelled ? "Sin partido" : day.driver}
                </span>
                {day.swapped ? (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                    cambio
                  </span>
                ) : null}
                <div className="ml-auto flex flex-wrap gap-2">
                  {!day.cancelled ? (
                    <button
                      onClick={() => setSwapWith(swapWith === day.day ? null : day.day)}
                      className="rounded-full bg-background/70 px-3 py-1 text-xs font-medium"
                    >
                      Cambiar
                    </button>
                  ) : null}
                  <button
                    onClick={() => run.mutate(() => setCancelled(day.day, !day.cancelled))}
                    className="rounded-full bg-background/70 px-3 py-1 text-xs font-medium"
                  >
                    {day.cancelled ? "Sí hay partido" : "Sin partido"}
                  </button>
                  {day.swapped ? (
                    <button
                      onClick={() => run.mutate(() => clearOverride(day.day))}
                      className="rounded-full bg-background/70 px-3 py-1 text-xs font-medium"
                    >
                      <RotateCcw className="mr-1 inline size-3" />
                      Normal
                    </button>
                  ) : null}
                </div>
              </div>

              {swapWith === day.day ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Cambiar con
                  </span>
                  {swapTargets
                    .filter((target) => target.day !== day.day)
                    .slice(0, 6)
                    .map((target) => (
                      <button
                        key={target.day}
                        onClick={() =>
                          run.mutate(() =>
                            swapDays(
                              day.day,
                              day.driver as string,
                              target.day,
                              target.driver as string,
                            ),
                          )
                        }
                        className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {target.driver} · {formatDay(target.day)}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          ))}
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sábados por delante.</p>
          ) : null}
        </div>
      </Panel>

      <Panel className="mt-6">
        <h2 className="text-2xl">Historial</h2>
        <div className="mt-4 space-y-2">
          {past.slice(0, 8).map((day) => (
            <div
              key={day.day}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3"
            >
              <span className="text-sm text-muted-foreground">{formatDay(day.day)}</span>
              <span className="font-semibold">
                {day.cancelled ? "Sin partido" : (day.actualDriver ?? day.driver)}
              </span>
              {day.actualDriver && day.actualDriver !== day.driver ? (
                <span className="text-xs text-muted-foreground">
                  (le tocaba a {day.driver})
                </span>
              ) : null}
              {!day.cancelled && !day.actualDriver ? (
                <div className="ml-auto flex gap-2">
                  {DRIVERS.map((driver) => (
                    <button
                      key={driver}
                      onClick={() => run.mutate(() => setActualDriver(day.day, driver))}
                      className="rounded-full bg-background/70 px-3 py-1 text-xs font-medium"
                    >
                      manejó {driver}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay sábados pasados.</p>
          ) : null}
        </div>
      </Panel>

      {log.length > 0 ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Último cambio: {log[0]!.summary}
        </p>
      ) : null}
    </PageShell>
  );
}
