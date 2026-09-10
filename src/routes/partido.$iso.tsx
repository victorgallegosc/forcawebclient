import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { OpenMapsButton } from "@/components/open-maps-button";
import { DataNote, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { TeamName, isUs } from "@/components/league-bits";
import { resultLabel, shortTeamName } from "@/lib/league-helpers";
import { rideStateQuery, scheduleQuery } from "@/lib/queries";
import {
  DRIVERS,
  computeRotation,
  formatDay,
  type Driver,
} from "@/lib/rides/rotation";
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
        content: "Detalle del partido, resultado y ride.",
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
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Calendario
      </Link>

      <div className="grid animate-rise gap-8 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <SectionLabel>Marcador</SectionLabel>
          <div className="mt-4 flex items-center gap-2.5 sm:gap-3">
            <div className="min-w-0 flex-1 text-right">
              <TeamName
                team={match.home}
                className="text-[13px] leading-tight sm:text-sm"
              />
            </div>
            <div className="shrink-0 rounded-lg bg-background px-2.5 py-1.5 text-center shadow-[inset_0_0_0_1px_var(--color-border)] sm:px-3 sm:py-2">
              <p className="display-title text-xl tabular-nums leading-none sm:text-2xl">
                {played ? `${match.homeGoals} – ${match.awayGoals}` : "vs"}
              </p>
              {!played ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {match.time || "Por definir"}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <TeamName
                team={match.away}
                className="text-[13px] leading-tight sm:text-sm"
              />
            </div>
          </div>

          {outcome ? (
            <p className="mt-3 text-sm font-medium text-muted-foreground">{outcome}</p>
          ) : null}

          <dl className="mt-6 grid gap-2 sm:grid-cols-2">
            {[
              ["Jornada", match.round],
              ["Hora", match.time || "—"],
              ["Cancha", match.place || "—"],
              ["Grupo", match.group || "—"],
              ["Estado", match.status || "—"],
              ["Fecha", match.date || formatDay(iso)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-secondary/45 px-3 py-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold leading-snug">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        {ours ? (
          <Panel>
            <SectionLabel>Ride</SectionLabel>
            {rideDay?.cancelled ? (
              <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                Sin ride este sábado.
              </p>
            ) : (
              <>
                <p className="display-title mt-4 text-4xl md:text-5xl">
                  {driver ?? "Por definir"}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                  {rideDay?.actualDriver
                    ? "Dio el ride"
                    : rideDay?.driver
                      ? "Le toca el ride"
                      : "Aún no hay rol para este día"}
                </p>
                {driver && DRIVERS.includes(driver as Driver) ? (
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <OpenMapsButton driver={driver as Driver} />
                    <Link
                      to="/ride/$day"
                      params={{ day: iso }}
                      className="inline-flex items-center rounded-xl bg-secondary px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/80"
                    >
                      Ver ride
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </Panel>
        ) : null}
      </div>

      <DataNote fetchedAt={schedule.fetchedAt} stale={schedule.stale} />
    </PageShell>
  );
}
