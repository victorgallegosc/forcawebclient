import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { DataNote, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { MatchMeta, MatchRow, StandingsTable, isUs } from "@/components/league-bits";
import { rideStateQuery, scheduleQuery, standingsQuery } from "@/lib/queries";
import { computeRotation, formatDay, todayInMonterrey } from "@/lib/rides/rotation";
import {
  CATEGORY_NAME,
  OUR_GROUP_NAME,
  TOURNAMENT_NAME,
} from "@/lib/zione/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cancha · Fin de Semana 2026" },
      {
        name: "description",
        content:
          "Próximo partido, posición en el grupo y turno de aventón — F7 Sabatino Vespertino.",
      },
      { property: "og:title", content: "Cancha · Fin de Semana 2026" },
      {
        property: "og:description",
        content: "Lo esencial del sábado: partido, tabla y aventón.",
      },
    ],
  }),
  loader: async ({ context }) => {
    void context.queryClient.ensureQueryData(rideStateQuery).catch(() => null);
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(standingsQuery),
    ]);
  },
  component: Index,
  errorComponent: () => (
    <PageShell title="Cancha" description="No pudimos leer los datos de la liga ahora mismo.">
      <Panel>Intenta de nuevo en unos minutos.</Panel>
    </PageShell>
  ),
});

function Index() {
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const standings = useSuspenseQuery(standingsQuery).data;
  const rideState = useQuery(rideStateQuery);
  const adjustments = rideState.data?.adjustments ?? [];
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

  const heroLine = nextMatch
    ? `${nextMatch.date} · ${nextMatch.time} hrs`
    : "Sin partidos programados";

  return (
    <PageShell title="Cancha" hero>
      {/* Hero: one composition — brand, line, support, CTAs, field atmosphere */}
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
          <p className="display-title text-6xl md:text-8xl tracking-tight">Cancha</p>
          <h1 className="mt-5 max-w-lg text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
            {nextMatch ? "Tu próximo sábado, claro." : "Todo listo para el torneo."}
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {CATEGORY_NAME} · {OUR_GROUP_NAME}. {TOURNAMENT_NAME}.
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
              Quién maneja
            </Link>
          </div>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {heroLine}
            {nextMatch?.place ? ` · ${nextMatch.place}` : ""}
          </p>
        </div>
      </section>

      <div className="mt-10 space-y-12 animate-rise" style={{ animationDelay: "80ms" }}>
        <section>
          <SectionLabel>Próximo partido</SectionLabel>
          {nextMatch ? (
            <div className="mt-4">
              <MatchRow match={nextMatch} />
              <MatchMeta match={nextMatch} />
            </div>
          ) : (
            <p className="mt-4 text-muted-foreground">Sin partidos programados.</p>
          )}
        </section>

        <section className="grid gap-8 border-t border-border/60 pt-10 md:grid-cols-2">
          <div>
            <SectionLabel>Aventón</SectionLabel>
            {nextDriver ? (
              <>
                <p className="display-title mt-3 text-5xl md:text-6xl">{nextDriver.driver}</p>
                <p className="mt-2 text-sm text-muted-foreground">{formatDay(nextDriver.day)}</p>
              </>
            ) : (
              <p className="mt-4 text-muted-foreground">Sin turno pendiente.</p>
            )}
            <Link
              to="/aventones"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              Ver rol completo <ArrowRight className="size-4" />
            </Link>
          </div>

          <div>
            <SectionLabel>En la tabla</SectionLabel>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
              {[
                { label: "Posición", value: ourRow ? `${ourRow.position}°` : "—" },
                { label: "Puntos", value: ourRow?.points ?? "—" },
                { label: "Goles a favor", value: ourRow?.goalsFor ?? "—" },
                { label: "Diferencia", value: ourRow?.diff ?? "—" },
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
        </section>

        {lastMatch ? (
          <section className="border-t border-border/60 pt-10">
            <SectionLabel>Último resultado</SectionLabel>
            <div className="mt-4">
              <MatchRow match={lastMatch} />
              <MatchMeta match={lastMatch} />
            </div>
          </section>
        ) : null}

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
