import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Car, RotateCcw, Undo2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
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
      { title: "Ride · Cancha" },
      {
        name: "description",
        content:
          "Quién da el ride cada sábado: rotación entre Víctor, Mau y Gabo, con cambios, partidos cancelados y rides cubiertos.",
      },
      { property: "og:title", content: "Ride · Cancha" },
      { property: "og:description", content: "A quién le toca el ride este sábado." },
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
    <LeagueRetryError
      title="Ride"
      description="No pudimos cargar los rides por ahora."
    />
  ),
});

/** "hace 5 min", "ayer" — friendlier than a raw timestamp in the change log. */
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

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
      setMessage(typeof result === "string" ? result : "Listo, rides actualizados.");
      setSwapWith(null);
      await queryClient.invalidateQueries({ queryKey: ["ride-state"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const swapTargets = upcoming.filter((day) => !day.cancelled && day.driver);

  return (
    <PageShell
      eyebrow="Rol de rides"
      title="Ride"
      description="Rotación entre Víctor, Mau y Gabo los sábados que juega el equipo."
    >
      <div className="grid gap-6 md:grid-cols-[1.25fr_1fr] animate-rise">
        <Panel interactive>
          <SectionLabel>Próximo sábado</SectionLabel>
          {next ? (
            <>
              <p className="display-title mt-3 text-5xl md:text-6xl">{next.driver}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Da el ride el {formatDay(next.day)}
                {next.swapped ? " · cambio acordado" : ""}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run.mutate(() => setActualDriver(next.day, next.driver as string))
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  <Car className="size-4" /> Confirmar que dio el ride
                </button>
                <button
                  type="button"
                  onClick={() => run.mutate(() => setCancelled(next.day, true))}
                  className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/80"
                >
                  <XCircle className="size-4" /> No hay partido
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-muted-foreground">No hay sábados pendientes en el calendario.</p>
          )}
        </Panel>

        <div>
          <SectionLabel>Rides a favor</SectionLabel>
          <p className="mt-2 text-xs text-muted-foreground">
            Si cubres el ride de alguien, te saltas el tuyo después.
          </p>
          <div className="mt-4 space-y-1">
            {DRIVERS.map((driver) => (
              <div
                key={driver}
                className="flex items-center justify-between rounded-lg bg-secondary/45 px-4 py-3"
              >
                <span className="font-semibold">{driver}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {rotation.credits[driver as Driver]} a favor
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {message ? (
        <p
          role="status"
          className="mt-5 rounded-lg bg-accent/20 px-4 py-3 text-sm font-medium text-accent-foreground animate-fade-in"
        >
          {message}
        </p>
      ) : null}

      <section className="mt-12 border-t border-border/60 pt-10">
        <SectionLabel>Agenda</SectionLabel>
        <h2 className="mt-2 text-2xl">Próximos sábados</h2>
        <div className="mt-5 space-y-2">
          {upcoming.map((day) => (
            <div
              key={day.day}
              className={cn(
                "rounded-lg px-4 py-3.5",
                swapWith === day.day ? "surface-panel" : "bg-secondary/45",
              )}
            >
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
                  <span className="rounded-md bg-accent/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                    cambio
                  </span>
                ) : null}
                <div className="ml-auto flex flex-wrap gap-2">
                  {!day.cancelled ? (
                    <button
                      type="button"
                      onClick={() => setSwapWith(swapWith === day.day ? null : day.day)}
                      className="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                    >
                      Cambiar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => run.mutate(() => setCancelled(day.day, !day.cancelled))}
                    className="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                  >
                    {day.cancelled ? "Sí hay partido" : "Sin partido"}
                  </button>
                  {day.swapped ? (
                    <button
                      type="button"
                      onClick={() => run.mutate(() => clearOverride(day.day))}
                      className="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
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
                        type="button"
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
                        className="rounded-md bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary"
                      >
                        {target.driver} · {formatDay(target.day)}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          ))}
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay más sábados por delante.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-12 border-t border-border/60 pt-10">
        <SectionLabel>Pasado</SectionLabel>
        <h2 className="mt-2 text-2xl">Historial</h2>
        <div className="mt-5 space-y-2">
          {past.slice(0, 8).map((day) => (
            <div
              key={day.day}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/45 px-4 py-3.5"
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
                <div className="ml-auto flex flex-wrap gap-2">
                  {DRIVERS.map((driver) => (
                    <button
                      type="button"
                      key={driver}
                      onClick={() => run.mutate(() => setActualDriver(day.day, driver))}
                      className="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                    >
                      dio el ride {driver}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay sábados pasados.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-12 border-t border-border/60 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Actividad</SectionLabel>
            <h2 className="mt-2 text-2xl">Últimos cambios</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Lo más reciente aparece arriba.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              run.mutate(() =>
                undoLast().then((s) => (s ? `Se deshizo: ${s}` : "No hay nada qué deshacer.")),
              )
            }
            className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/80"
          >
            <Undo2 className="size-4" /> Deshacer el último
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {log.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg px-4 py-3.5",
                entry.undone ? "bg-secondary/25" : "bg-secondary/45",
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  entry.undone ? "bg-muted-foreground/40" : "bg-primary",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  entry.undone ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {entry.summary}
              </span>
              {entry.undone ? (
                <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  deshecho
                </span>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {timeAgo(entry.created_at)}
              </span>
            </div>
          ))}
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay cambios registrados.</p>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
