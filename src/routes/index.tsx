import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { DataNote, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { MatchMeta, MatchRow, StandingsTable, TeamName, isUs } from "@/components/league-bits";
import {
  countdownLabel,
  findStanding,
  formFromMatches,
  gapToLeader,
  headToHead,
  isMatchday,
  opponentName,
  resultLabel,
  shortTeamName,
} from "@/lib/league-helpers";
import { rideStateQuery, scheduleQuery, standingsQuery } from "@/lib/queries";
import { computeRotation, formatDay, todayInMonterrey } from "@/lib/rides/rotation";
import {
  OUR_GROUP_NAME,
  OUR_TEAM,
  OUR_TEAM_SHORT,
} from "@/lib/zione/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cancha · Fin de Semana 2026" },
      {
        name: "description",
        content:
          "Próximo partido, forma reciente, rival y quién da el ride — F7 Sabatino Vespertino, Grupo 4 B.",
      },
      { property: "og:title", content: "Cancha · Fin de Semana 2026" },
      {
        property: "og:description",
        content: "Lo del sábado: partido, tabla y ride.",
      },
    ],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureQueryData(rideStateQuery).catch(() => null);
    await Promise.allSettled([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(standingsQuery),
    ]);
  },
  component: Index,
  errorComponent: () => (
    <LeagueRetryError
      title="Cancha"
      description="No pudimos traer los datos de la liga por ahora."
    />
  ),
});

function Index() {
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const standings = useSuspenseQuery(standingsQuery).data;
  const rideState = useQuery(rideStateQuery);
  const adjustments = rideState.data?.adjustments ?? [];
  const today = todayInMonterrey();

  const ourMatches = useMemo(() => {
    return schedule.data
      .flatMap((group) => group.weeks.flatMap((week) => week.matches))
      .filter((match) => isUs(match.home) || isUs(match.away))
      .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""));
  }, [schedule]);

  const nextMatch = ourMatches.find((match) => (match.iso ?? "") >= today) ?? null;
  const lastMatch =
    [...ourMatches].reverse().find((match) => match.homeGoals !== null) ?? null;
  const form = useMemo(() => formFromMatches(ourMatches, 5), [ourMatches]);

  const rotation = useMemo(
    () =>
      computeRotation(
        ourMatches.map((match) => match.iso).filter((iso): iso is string => Boolean(iso)),
        adjustments,
      ),
    [ourMatches, adjustments],
  );
  const nextDriver = rotation.days.find((day) => day.day >= today && !day.cancelled);

  const ourGroup = standings?.data.find((group) => group.groupName === OUR_GROUP_NAME);
  const ourRow = ourGroup?.rows.find((row) => isUs(row.team));
  const rival = nextMatch ? opponentName(nextMatch) : null;
  const rivalRow = rival && ourGroup ? findStanding(ourGroup.rows, rival) : null;
  const kickoff = countdownLabel(nextMatch?.iso ?? null, today);
  const matchday = isMatchday(nextMatch?.iso ?? null, today);
  const race = ourGroup ? gapToLeader(ourGroup.rows, OUR_TEAM) : null;
  const h2h = rival ? headToHead(ourMatches, rival) : null;

  return (
    <PageShell title="Cancha" hero>
      <section className="relative -mx-4 overflow-hidden border-b border-border/50 px-4 pb-14 pt-10 md:-mx-6 md:px-6 md:pb-16 md:pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 70% 40%, oklch(0.7 0.09 195 / 22%), transparent 70%), linear-gradient(135deg, transparent 40%, oklch(0.22 0.02 250 / 3%) 40.5%, oklch(0.22 0.02 250 / 3%) 41%, transparent 41.5%)",
          }}
        />
        <div className="animate-rise">
          <div className="flex flex-wrap items-center gap-3">
            <p className="display-title text-6xl tracking-tight md:text-8xl">Cancha</p>
            {matchday ? (
              <span className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground">
                Día de partido
              </span>
            ) : null}
          </div>
          <h1 className="mt-5 max-w-lg text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
            {nextMatch
              ? `${kickoff ?? "Próximo sábado"} contra ${shortTeamName(rival ?? "")}.`
              : "Todo listo para el torneo."}
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {nextMatch
              ? [
                  nextMatch.date || (nextMatch.iso ? formatDay(nextMatch.iso) : null),
                  nextMatch.time ? `${nextMatch.time} hrs` : null,
                  nextMatch.place || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Detalles del partido por definir."
              : "Sin próximo partido en el calendario."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/calendario"
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Ver calendario <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/aventones"
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Quién da el ride
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-10 space-y-12 animate-rise" style={{ animationDelay: "80ms" }}>
        <section>
          <SectionLabel>Próximo partido</SectionLabel>
          {nextMatch ? (
            <Panel className="mt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {nextMatch.round}
                    {nextMatch.stage ? ` · ${nextMatch.stage}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {nextMatch.date} · {nextMatch.time} hrs
                    {nextMatch.place ? ` · ${nextMatch.place}` : ""}
                  </p>
                </div>
                {kickoff ? (
                  <span className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold">
                    {kickoff}
                  </span>
                ) : null}
              </div>
              <div className="mt-5">
                <MatchRow match={nextMatch} />
              </div>
              {rivalRow ? (
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Rival
                    </dt>
                    <dd className="mt-1 font-semibold">
                      <TeamName team={rivalRow.team} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Posición
                    </dt>
                    <dd className="display-title mt-1 text-2xl">{rivalRow.position}°</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Puntos
                    </dt>
                    <dd className="display-title mt-1 text-2xl">{rivalRow.points}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Forma
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">
                      {rivalRow.won}V · {rivalRow.drawn}E · {rivalRow.lost}D
                    </dd>
                  </div>
                </dl>
              ) : null}
              {h2h && h2h.played > 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Cara a cara en este torneo: {h2h.won}V · {h2h.drawn}E · {h2h.lost}D.
                </p>
              ) : null}
            </Panel>
          ) : (
            <p className="mt-4 text-muted-foreground">Sin partidos programados.</p>
          )}
        </section>

        <section className="grid gap-8 border-t border-border/60 pt-10 md:grid-cols-2">
          <div>
            <SectionLabel>Forma reciente</SectionLabel>
            <p className="mt-2 text-sm text-muted-foreground">
              Últimos resultados de {OUR_TEAM_SHORT}.
            </p>
            {form.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {form.map((result, index) => (
                  <span
                    key={`${result}-${index}`}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-md text-sm font-bold",
                      result === "V" && "bg-primary/15 text-primary",
                      result === "E" && "bg-secondary text-muted-foreground",
                      result === "D" && "bg-destructive/10 text-destructive",
                    )}
                    title={result === "V" ? "Victoria" : result === "E" ? "Empate" : "Derrota"}
                  >
                    {result}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-muted-foreground">
                Aún no hay partidos jugados.
              </p>
            )}
            {lastMatch ? (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Último · {resultLabel(lastMatch)}
                </p>
                <div className="mt-2">
                  <MatchRow match={lastMatch} />
                  <MatchMeta match={lastMatch} />
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <SectionLabel>Ride</SectionLabel>
            {nextDriver ? (
              <>
                <p className="display-title mt-3 text-5xl md:text-6xl">{nextDriver.driver}</p>
                <p className="mt-2 text-sm text-muted-foreground">{formatDay(nextDriver.day)}</p>
              </>
            ) : (
              <p className="mt-4 text-muted-foreground">Nadie tiene ride pendiente.</p>
            )}
            <Link
              to="/aventones"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              Ver el rol completo <ArrowRight className="size-4" />
            </Link>

            <div className="mt-8">
              <SectionLabel>En la tabla</SectionLabel>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
                {[
                  { label: "Posición", value: ourRow ? `${ourRow.position}°` : "—" },
                  { label: "Puntos", value: ourRow?.points ?? "—" },
                  { label: "Goles a favor", value: ourRow?.goalsFor ?? "—" },
                  {
                    label: race?.isLeader ? "Ventaja" : "Pts del líder",
                    value: race == null ? "—" : race.isLeader ? "Líder" : `-${race.gap}`,
                  },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="display-title mt-1 text-3xl">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {ourGroup ? (
          <section className="border-t border-border/60 pt-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <SectionLabel>Grupo</SectionLabel>
                <h2 className="mt-2 text-2xl">{ourGroup.groupName}</h2>
              </div>
              <Link to="/tabla" className="shrink-0 text-sm font-semibold text-primary hover:underline">
                Ambos grupos
              </Link>
            </div>
            <StandingsTable rows={ourGroup.rows} />
          </section>
        ) : null}
      </div>

      <DataNote fetchedAt={schedule.fetchedAt} stale={schedule.stale} />
    </PageShell>
  );
}
