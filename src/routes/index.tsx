import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { DataNote, PageShell, Panel } from "@/components/app-shell";
import { MatchMeta, MatchRow, StandingsTable, isUs } from "@/components/league-bits";
import { rideStateQuery, scheduleQuery, standingsQuery } from "@/lib/queries";
import { computeRotation, formatDay, todayInMonterrey } from "@/lib/rides/rotation";
import {
  CATEGORY_NAME,
  OUR_GROUP_NAME,
  OUR_TEAM_SHORT,
  TOURNAMENT_NAME,
} from "@/lib/zione/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sunderland A3860 · Fin de Semana 2026" },
      {
        name: "description",
        content:
          "Próximo partido, posición en el Grupo 4 B y turno de aventón del A3860 Sunderland en la F7 Sabatino Vespertino.",
      },
      { property: "og:title", content: "Sunderland A3860 · Fin de Semana 2026" },
      {
        property: "og:description",
        content: "Próximo partido, tabla y turnos de aventón del equipo.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(standingsQuery),
      context.queryClient.ensureQueryData(rideStateQuery),
    ]);
  },
  component: Index,
  errorComponent: () => (
    <PageShell title="Sunderland" description="No pudimos leer los datos de la liga ahora mismo.">
      <Panel>Intenta de nuevo en unos minutos.</Panel>
    </PageShell>
  ),
});

function Index() {
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const standings = useSuspenseQuery(standingsQuery).data;
  const adjustments = useSuspenseQuery(rideStateQuery).data.adjustments;
  const today = todayInMonterrey();

  const ourMatches = useMemo(() => {
    const all = schedule.data
      .flatMap((group) => group.weeks.flatMap((week) => week.matches))
      .filter((match) => isUs(match.home) || isUs(match.away))
      .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""));
    return all;
  }, [schedule]);

  const nextMatch = ourMatches.find((match) => (match.iso ?? "") >= today) ?? null;
  const lastMatch = [...ourMatches].reverse().find((match) => match.homeGoals !== null) ?? null;

  const rotation = useMemo(
    () =>
      computeRotation(
        ourMatches.map((match) => match.iso).filter((iso): iso is string => Boolean(iso)),
        adjustments,
      ),
    [ourMatches, adjustments],
  );
  const nextDriver = rotation.days.find((day) => day.day >= today && !day.cancelled);

  const ourGroup = standings.data.find((group) => group.groupName === OUR_GROUP_NAME);
  const ourRow = ourGroup?.rows.find((row) => isUs(row.team));

  return (
    <PageShell
      eyebrow={`${CATEGORY_NAME} · ${OUR_GROUP_NAME}`}
      title={OUR_TEAM_SHORT}
      description={TOURNAMENT_NAME}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Próximo partido
          </p>
          {nextMatch ? (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                {nextMatch.date} · {nextMatch.time} hrs · {nextMatch.place}
              </p>
              <MatchRow match={nextMatch} />
              <MatchMeta match={nextMatch} />
            </div>
          ) : (
            <p className="mt-4 text-muted-foreground">Sin partidos programados.</p>
          )}
        </Panel>

        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Aventón de este sábado
          </p>
          {nextDriver ? (
            <>
              <p className="display-title mt-3 text-6xl">{nextDriver.driver}</p>
              <p className="mt-2 text-sm text-muted-foreground">{formatDay(nextDriver.day)}</p>
            </>
          ) : (
            <p className="mt-4 text-muted-foreground">Sin turno pendiente.</p>
          )}
          <Link
            to="/aventones"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
          >
            Ver rol completo <ArrowRight className="size-4" />
          </Link>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-4">
        {[
          { label: "Posición", value: ourRow ? `${ourRow.position}°` : "—" },
          { label: "Puntos", value: ourRow?.points ?? "—" },
          { label: "Goles a favor", value: ourRow?.goalsFor ?? "—" },
          { label: "Diferencia", value: ourRow?.diff ?? "—" },
        ].map((stat) => (
          <Panel key={stat.label} className="text-center">
            <p className="display-title text-4xl">{stat.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {stat.label}
            </p>
          </Panel>
        ))}
      </div>

      {lastMatch ? (
        <Panel className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Último resultado
          </p>
          <div className="mt-4">
            <MatchRow match={lastMatch} />
            <MatchMeta match={lastMatch} />
          </div>
        </Panel>
      ) : null}

      {ourGroup ? (
        <Panel className="mt-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">{ourGroup.groupName}</h2>
            <Link to="/tabla" className="text-sm text-primary">
              Ver ambos grupos
            </Link>
          </div>
          <StandingsTable rows={ourGroup.rows} />
        </Panel>
      ) : null}

      <DataNote fetchedAt={schedule.fetchedAt} stale={schedule.stale} />
    </PageShell>
  );
}
