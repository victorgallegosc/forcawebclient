import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, Sparkles, Undo2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { isUs } from "@/components/league-bits";
import { rideStateQuery, scheduleQuery } from "@/lib/queries";
import {
  clearOverride,
  explainRideBalances,
  setActualDriver,
  setCancelled,
  setOverrideDriver,
  undoLast,
} from "@/lib/rides/rides-data";
import {
  DRIVERS,
  computeRotation,
  formatBalance,
  formatDay,
  todayInMonterrey,
  type Driver,
} from "@/lib/rides/rotation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aventones")({
  head: () => ({
    meta: [
      { title: "Ride · Cancha" },
      {
        name: "description",
        content:
          "Quién da el ride cada sábado: rotación Gabo → Mau → Víctor, con cambios y días sin ride.",
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
  const [changeDay, setChangeDay] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationSource, setExplanationSource] = useState<"ai" | "local" | null>(
    null,
  );

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
      setChangeDay(null);
      setExplanation(null);
      setExplanationSource(null);
      await queryClient.invalidateQueries({ queryKey: ["ride-state"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const explain = useMutation({
    mutationFn: () => explainRideBalances(fixtureDays),
    onSuccess: (result) => {
      setExplanation(result.text);
      setExplanationSource(result.source);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <PageShell
      eyebrow="Rol de rides"
      title="Ride"
      description="Rotación Gabo → Mau → Víctor los sábados que juega el equipo."
    >
      <div className="grid animate-rise gap-8 md:grid-cols-[1.25fr_1fr]">
        <Panel interactive>
          <SectionLabel>Próximo sábado</SectionLabel>
          {next ? (
            <Link
              to="/ride/$day"
              params={{ day: next.day }}
              className="mt-4 block transition-opacity hover:opacity-90"
            >
              <p className="display-title text-5xl md:text-6xl">{next.driver}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Da el ride el {formatDay(next.day)}
                {next.swapped ? " · cambio acordado" : ""}
              </p>
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Ver ride <ArrowRight className="size-4" />
              </p>
            </Link>
          ) : (
            <p className="mt-5 text-muted-foreground">No hay sábados pendientes en el calendario.</p>
          )}
        </Panel>

        <div className="rounded-2xl bg-secondary/35 p-5 md:p-6">
          <SectionLabel>Saldo a favor</SectionLabel>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {rotation.even
              ? "Todos están a mano."
              : "Si cubres a alguien quedas a favor; si te cubren, en contra."}
          </p>
          <div className="mt-5 space-y-2">
            {DRIVERS.map((driver) => (
              <div
                key={driver}
                className="flex items-center justify-between rounded-xl bg-background/70 px-4 py-3.5"
              >
                <span className="font-semibold">{driver}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatBalance(rotation.balance[driver as Driver])}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => explain.mutate()}
            disabled={explain.isPending || fixtureDays.length === 0}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-background/80 px-3.5 py-2.5 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-border)] transition-opacity disabled:opacity-60"
          >
            <Sparkles className="size-4" />
            {explain.isPending ? "Explicando…" : "Explicar saldos"}
          </button>
          {explanation ? (
            <div className="mt-4 rounded-xl bg-background/70 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                {explanationSource === "ai" ? "Explicación IA" : "Explicación"}
              </p>
              {explanation}
            </div>
          ) : null}
        </div>
      </div>

      {message ? (
        <p
          role="status"
          className="mt-6 animate-fade-in rounded-xl bg-accent/20 px-4 py-3.5 text-sm font-medium text-accent-foreground"
        >
          {message}
        </p>
      ) : null}

      <section className="mt-14 border-t border-border/50 pt-12">
        <SectionLabel>Agenda</SectionLabel>
        <h2 className="mt-3 text-2xl">Próximos sábados</h2>
        <div className="mt-6 space-y-2.5">
          {upcoming.map((day) => (
            <div
              key={day.day}
              className={cn(
                "rounded-2xl px-4 py-4",
                changeDay === day.day ? "surface-panel" : "bg-secondary/40",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                {day.cancelled ? (
                  <>
                    <span className="text-sm text-muted-foreground">{formatDay(day.day)}</span>
                    <span className="font-semibold text-muted-foreground">Sin ride</span>
                  </>
                ) : (
                  <Link
                    to="/ride/$day"
                    params={{ day: day.day }}
                    className="flex min-w-0 flex-wrap items-center gap-3 transition-opacity hover:opacity-80"
                  >
                    <span className="text-sm text-muted-foreground">{formatDay(day.day)}</span>
                    <span className="font-semibold text-foreground">{day.driver}</span>
                  </Link>
                )}
                {day.swapped ? (
                  <span className="rounded-md bg-accent/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                    cambio
                  </span>
                ) : null}
                <div className="ml-auto flex flex-wrap gap-2">
                  {!day.cancelled ? (
                    <button
                      type="button"
                      onClick={() => setChangeDay(changeDay === day.day ? null : day.day)}
                      className="rounded-lg bg-background/90 px-3 py-2 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                    >
                      Cambiar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => run.mutate(() => setCancelled(day.day, !day.cancelled))}
                    className="rounded-lg bg-background/90 px-3 py-2 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                  >
                    {day.cancelled ? "Sí hay ride" : "Sin ride"}
                  </button>
                  {day.swapped ? (
                    <button
                      type="button"
                      onClick={() => run.mutate(() => clearOverride(day.day))}
                      className="rounded-lg bg-background/90 px-3 py-2 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                    >
                      <RotateCcw className="mr-1 inline size-3" />
                      Normal
                    </button>
                  ) : null}
                </div>
              </div>

              {changeDay === day.day ? (
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Quién da el ride
                  </span>
                  {DRIVERS.map((driver) => (
                    <button
                      type="button"
                      key={driver}
                      onClick={() =>
                        run.mutate(async () => {
                          await setOverrideDriver(day.day, driver);
                          return `${driver} da el ride el ${formatDay(day.day)}.`;
                        })
                      }
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                        day.driver === driver
                          ? "bg-foreground text-background"
                          : "bg-primary/12 text-primary hover:bg-primary/18",
                      )}
                    >
                      {driver}
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

      <section className="mt-14 border-t border-border/50 pt-12">
        <SectionLabel>Pasado</SectionLabel>
        <h2 className="mt-3 text-2xl">Historial</h2>
        <div className="mt-6 space-y-2.5">
          {past.map((day) => (
            <div key={day.day} className="rounded-2xl bg-secondary/40 px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">{formatDay(day.day)}</span>
                <span className="font-semibold">
                  {day.cancelled
                    ? "Sin ride"
                    : `Dio el ride: ${day.actualDriver ?? day.driver}`}
                </span>
                {!day.cancelled && !day.actualDriver ? (
                  <div className="ml-auto flex flex-wrap gap-2">
                    {DRIVERS.map((driver) => (
                      <button
                        type="button"
                        key={driver}
                        onClick={() => run.mutate(() => setActualDriver(day.day, driver))}
                        className="rounded-lg bg-background/90 px-3 py-2 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
                      >
                        dio el ride {driver}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay sábados pasados.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-14 border-t border-border/50 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Actividad</SectionLabel>
            <h2 className="mt-3 text-2xl">Últimos cambios</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">Lo más reciente aparece arriba.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              run.mutate(() =>
                undoLast().then((s) => (s ? `Se deshizo: ${s}` : "No hay nada qué deshacer.")),
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/80"
          >
            <Undo2 className="size-4" /> Deshacer el último
          </button>
        </div>

        <div className="mt-6 space-y-2.5">
          {log.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-2xl px-4 py-4",
                entry.undone ? "bg-secondary/25" : "bg-secondary/40",
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
