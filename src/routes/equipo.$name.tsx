import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import { DataNote, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { MatchMeta, MatchRow, isUs } from "@/components/league-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  findStanding,
  gapToLeader,
  resolveTeamName,
  shortTeamName,
  teamFormFromMatches,
  teamMatches,
  teamOpponent,
  teamPlayedMatches,
  teamResultLabel,
  type FormResult,
} from "@/lib/league-helpers";
import { scheduleQuery, standingsQuery } from "@/lib/queries";
import type { Match } from "@/lib/zione/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/equipo/$name")({
  head: ({ params }) => {
    const label = shortTeamName(decodeURIComponent(params.name));
    return {
      meta: [
        { title: `${label} · Cancha` },
        {
          name: "description",
          content: `Estadísticas e historial de ${label}.`,
        },
      ],
    };
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(standingsQuery),
    ]);
  },
  component: EquipoPage,
  errorComponent: () => (
    <LeagueRetryError
      title="Equipo"
      description="No pudimos cargar el detalle del equipo."
    />
  ),
});

function formTone(result: FormResult) {
  if (result === "V") return "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300";
  if (result === "D") return "bg-rose-600/15 text-rose-800 dark:text-rose-300";
  return "bg-secondary text-muted-foreground";
}

function EquipoPage() {
  const { name: rawName } = Route.useParams();
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const standings = useSuspenseQuery(standingsQuery).data;

  const allMatches = useMemo(
    () => schedule.data.flatMap((group) => group.weeks.flatMap((week) => week.matches)),
    [schedule],
  );

  const knownTeams = useMemo(() => {
    const names = new Set<string>();
    for (const group of standings.data) {
      for (const row of group.rows) names.add(row.team);
    }
    for (const match of allMatches) {
      names.add(match.home);
      names.add(match.away);
    }
    return [...names];
  }, [standings, allMatches]);

  const team = resolveTeamName(rawName, knownTeams);
  const label = shortTeamName(team);

  const standingGroup = standings.data.find((group) =>
    group.rows.some((row) => row.team.trim() === team.trim()),
  );
  const row = standingGroup ? findStanding(standingGroup.rows, team) : null;
  const race = standingGroup ? gapToLeader(standingGroup.rows, team) : null;

  const history = useMemo(() => teamPlayedMatches(allMatches, team), [allMatches, team]);
  const form = useMemo(() => teamFormFromMatches(allMatches, team, 5), [allMatches, team]);
  const upcoming = useMemo(() => {
    return teamMatches(allMatches, team)
      .filter((match: Match) => match.homeGoals === null || match.awayGoals === null)
      .slice(0, 3);
  }, [allMatches, team]);

  if (!row && history.length === 0 && upcoming.length === 0) {
    return (
      <PageShell eyebrow="Equipo" title={label} description="No encontramos datos de este equipo.">
        <Link
          to="/tabla"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Tabla
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={standingGroup?.groupName ?? "Equipo"}
      title={label}
      description={isUs(team) ? "Nuestro equipo" : "Detalle del equipo"}
    >
      <Link
        to="/tabla"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Tabla
      </Link>

      <Tabs defaultValue="stats" className="animate-rise">
        <TabsList className="h-11 w-full justify-start gap-1 rounded-xl bg-secondary/50 p-1 sm:w-auto">
          <TabsTrigger
            value="stats"
            className="flex-1 rounded-lg px-4 py-2 data-[state=active]:shadow-sm sm:flex-none"
          >
            Estadísticas
          </TabsTrigger>
          <TabsTrigger
            value="historial"
            className="flex-1 rounded-lg px-4 py-2 data-[state=active]:shadow-sm sm:flex-none"
          >
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6 space-y-6">
          <Panel>
            <SectionLabel>Resumen</SectionLabel>
            {row ? (
              <>
                <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {[
                    ["Pos", `#${row.position}`],
                    ["Pts", String(row.points)],
                    ["JJ", String(row.played)],
                    ["G", String(row.won)],
                    ["E", String(row.drawn)],
                    ["P", String(row.lost)],
                  ].map(([labelStat, value]) => (
                    <div
                      key={labelStat}
                      className="rounded-xl bg-secondary/45 px-3 py-3 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {labelStat}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    ["GF", String(row.goalsFor)],
                    ["GC", String(row.goalsAgainst)],
                    ["Dif", row.diff > 0 ? `+${row.diff}` : String(row.diff)],
                  ].map(([labelStat, value]) => (
                    <div
                      key={labelStat}
                      className="rounded-xl bg-secondary/45 px-3 py-3 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {labelStat}
                      </p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                {race ? (
                  <p className="mt-5 text-sm text-muted-foreground">
                    {race.isLeader
                      ? "Líder del grupo."
                      : `${race.gap} pts detrás de ${shortTeamName(race.leader)}.`}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                Este equipo aún no aparece en la tabla.
              </p>
            )}
          </Panel>

          <Panel>
            <SectionLabel>Forma reciente</SectionLabel>
            {form.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {form.map((result, index) => (
                  <span
                    key={`${result}-${index}`}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg text-sm font-semibold",
                      formTone(result),
                    )}
                  >
                    {result}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Todavía no hay partidos jugados.</p>
            )}
          </Panel>

          {upcoming.length > 0 ? (
            <section>
              <SectionLabel>Próximos</SectionLabel>
              <div className="mt-4 space-y-2.5">
                {upcoming.map((match) => (
                  <div key={`${match.iso}-${match.home}-${match.away}`}>
                    <MatchRow match={match} />
                    <MatchMeta match={match} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="historial" className="mt-6">
          <SectionLabel>Resultados</SectionLabel>
          <div className="mt-4 space-y-2.5">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin resultados todavía.</p>
            ) : (
              history.map((match) => {
                const outcome = teamResultLabel(match, team);
                const rival = shortTeamName(teamOpponent(match, team));
                return (
                  <div key={`${match.iso}-${match.home}-${match.away}`}>
                    <MatchRow match={match} />
                    <p className="mt-1.5 truncate px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {[
                        outcome ? `${outcome} vs ${rival}` : null,
                        match.round,
                        match.place,
                        match.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <DataNote
        fetchedAt={schedule.fetchedAt}
        stale={schedule.stale || standings.stale}
      />
    </PageShell>
  );
}
