import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MapPin, Navigation } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { DataNote, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { TeamName, isUs } from "@/components/league-bits";
import { resultLabel, shortTeamName } from "@/lib/league-helpers";
import { driverRouteQuery, rideStateQuery, scheduleQuery } from "@/lib/queries";
import { RIDE_STOPS } from "@/lib/rides/maps";
import {
  computeRotation,
  formatDay,
  type Driver,
} from "@/lib/rides/rotation";
import { OUR_TEAM_SHORT } from "@/lib/zione/constants";
import type { GroupSchedule, Match } from "@/lib/zione/types";

const searchSchema = z.object({
  home: z.string().optional(),
  away: z.string().optional(),
});

export const Route = createFileRoute("/partido/$iso")({
  validateSearch: (search) => searchSchema.parse(search),
  head: ({ params }) => ({
    meta: [
      { title: `Partido ${params.iso} · Cancha` },
      {
        name: "description",
        content: "Detalle del partido, resultado y trayecto del ride.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(rideStateQuery),
    ]);
  },
  component: PartidoPage,
  errorComponent: () => (
    <LeagueRetryError
      title="Partido"
      description="No pudimos cargar el detalle del partido."
    />
  ),
});

function ourFixtureDays(groups: GroupSchedule[]) {
  const days = new Set<string>();
  for (const group of groups) {
    for (const week of group.weeks) {
      for (const match of week.matches) {
        if (match.iso && (isUs(match.home) || isUs(match.away))) days.add(match.iso);
      }
    }
  }
  return [...days].sort();
}

function findMatch(
  groups: GroupSchedule[],
  iso: string,
  home?: string,
  away?: string,
): Match | null {
  const candidates: Match[] = [];
  for (const group of groups) {
    for (const week of group.weeks) {
      for (const match of week.matches) {
        if (match.iso === iso) candidates.push(match);
      }
    }
  }
  if (home && away) {
    const exact = candidates.find((match) => match.home === home && match.away === away);
    if (exact) return exact;
  }
  return (
    candidates.find((match) => isUs(match.home) || isUs(match.away)) ??
    candidates[0] ??
    null
  );
}

function PartidoPage() {
  const { iso } = Route.useParams();
  const search = Route.useSearch();
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const rideState = useSuspenseQuery(rideStateQuery).data;

  const match = useMemo(
    () => findMatch(schedule.data, iso, search.home, search.away),
    [schedule.data, iso, search.home, search.away],
  );

  const fixtureDays = useMemo(() => ourFixtureDays(schedule.data), [schedule.data]);
  const rotation = useMemo(
    () => computeRotation(fixtureDays, rideState.adjustments),
    [fixtureDays, rideState.adjustments],
  );
  const rideDay = rotation.days.find((day) => day.day === iso) ?? null;
  const driver = (rideDay?.actualDriver ?? rideDay?.driver) as Driver | null;

  if (!match) {
    return (
      <PageShell
        eyebrow="Partido"
        title="No encontrado"
        description="Ese partido no está en el calendario."
      >
        <Link to="/calendario" className="text-sm font-semibold text-primary">
          Volver al calendario
        </Link>
      </PageShell>
    );
  }

  const played = match.homeGoals !== null && match.awayGoals !== null;
  const ours = isUs(match.home) || isUs(match.away);
  const outcome = ours ? resultLabel(match) : null;

  return (
    <PageShell
      eyebrow={match.round || "Partido"}
      title={formatDay(iso)}
      description={`${shortTeamName(match.home)} vs ${shortTeamName(match.away)}`}
    >
      <Link
        to="/calendario"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Calendario
      </Link>

      <div className="grid animate-rise gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <SectionLabel>Marcador</SectionLabel>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0 text-right">
              <TeamName team={match.home} className="text-xl sm:text-2xl" />
              {isUs(match.home) ? (
                <p className="mt-1 text-[11px] uppercase tracking-wider text-primary">
                  {OUR_TEAM_SHORT}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg bg-background px-4 py-3 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
              <p className="display-title text-3xl tabular-nums sm:text-4xl">
                {played ? `${match.homeGoals} – ${match.awayGoals}` : "vs"}
              </p>
              {!played ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {match.time || "Por definir"}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <TeamName team={match.away} className="text-xl sm:text-2xl" />
              {isUs(match.away) ? (
                <p className="mt-1 text-[11px] uppercase tracking-wider text-primary">
                  {OUR_TEAM_SHORT}
                </p>
              ) : null}
            </div>
          </div>

          {outcome ? (
            <p className="mt-5 text-sm font-semibold text-muted-foreground">{outcome}</p>
          ) : null}

          <dl className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["Jornada", match.round],
              ["Hora", match.time || "—"],
              ["Cancha", match.place || "—"],
              ["Grupo", match.group || "—"],
              ["Estado", match.status || "—"],
              ["Fecha", match.date || formatDay(iso)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-secondary/45 px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 truncate font-semibold" title={String(value)}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        {ours ? (
          <Panel>
            <SectionLabel>Ride</SectionLabel>
            {rideDay?.cancelled ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Sin ride este sábado{rideDay.note ? `: ${rideDay.note}` : "."}
              </p>
            ) : (
              <>
                <p className="display-title mt-3 text-4xl">{driver ?? "Por definir"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {rideDay?.actualDriver
                    ? rideDay.covered
                      ? `Dio el ride (le tocaba a ${rideDay.driver})`
                      : "Dio el ride"
                    : rideDay?.driver
                      ? "Le toca el ride"
                      : "Aún no hay rol para este día"}
                </p>
                {rideDay?.note ? (
                  <p className="mt-3 rounded-lg bg-accent/20 px-3 py-2 text-sm">{rideDay.note}</p>
                ) : null}
              </>
            )}
          </Panel>
        ) : null}
      </div>

      {ours && driver && !rideDay?.cancelled ? <DriverRouteSection driver={driver} /> : null}

      <DataNote fetchedAt={schedule.fetchedAt} stale={schedule.stale} />
    </PageShell>
  );
}

function DriverRouteSection({ driver }: { driver: Driver }) {
  const { data: routePlan } = useSuspenseQuery(driverRouteQuery(driver));

  return (
    <section className="mt-10 animate-fade-in border-t border-border/60 pt-10">
      <SectionLabel>Trayecto · Google Maps</SectionLabel>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl">Ruta de {driver}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiempo estimado del recorrido completo hasta las canchas.
          </p>
        </div>
        <a
          href={routePlan.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          Abrir en Maps <ExternalLink className="size-4" />
        </a>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Panel>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="display-title mt-1 text-4xl">{routePlan.totalDurationText}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Distancia</p>
              <p className="mt-1 text-lg font-semibold">{routePlan.totalDistanceText}</p>
            </div>
          </div>
          {routePlan.warning ? (
            <p className="mt-4 text-sm text-muted-foreground">{routePlan.warning}</p>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Datos de Google Maps Directions · tráfico al momento de consultar.
            </p>
          )}
        </Panel>

        <div className="space-y-2">
          {routePlan.stops.map((stop, index) => (
            <div
              key={stop.id}
              className="flex items-start gap-3 rounded-lg bg-secondary/45 px-4 py-3"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-background text-xs font-bold shadow-[inset_0_0_0_1px_var(--color-border)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{stop.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <MapPin className="mr-1 inline size-3" />
                  {stop.plusCode}
                </p>
                {routePlan.legs[index] ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Navigation className="size-3" />
                    {routePlan.legs[index]!.durationText} · {routePlan.legs[index]!.distanceText} →{" "}
                    {routePlan.legs[index]!.to.label}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Paradas: {Object.values(RIDE_STOPS)
          .map((stop) => stop.label)
          .join(" · ")}
      </p>
    </section>
  );
}
