import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DataNote, FilterChip, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { MatchMeta, MatchRow, isUs } from "@/components/league-bits";
import { scheduleQuery } from "@/lib/queries";
import { GROUPS } from "@/lib/zione/constants";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario · Cancha" },
      {
        name: "description",
        content:
          "Rol de juegos y resultados semana por semana de los Grupos 4 A y 4 B, F7 Sabatino Vespertino.",
      },
      { property: "og:title", content: "Calendario · Cancha" },
      {
        property: "og:description",
        content: "Rol de juegos y resultados de los Grupos 4 A y 4 B.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(scheduleQuery),
  component: CalendarioPage,
  errorComponent: () => (
    <PageShell title="Calendario" description="No pudimos leer el rol de juegos ahora mismo.">
      <Panel>Intenta de nuevo en unos minutos.</Panel>
    </PageShell>
  ),
});

function CalendarioPage() {
  const { data } = useSuspenseQuery(scheduleQuery);
  const [groupId, setGroupId] = useState<string>(GROUPS[1].id);
  const [onlyUs, setOnlyUs] = useState(true);

  const group = data.data.find((entry) => entry.groupId === groupId) ?? data.data[0];

  const weeks = (group?.weeks ?? [])
    .map((week) => ({
      ...week,
      matches: onlyUs
        ? week.matches.filter((match) => isUs(match.home) || isUs(match.away))
        : week.matches,
    }))
    .filter((week) => week.matches.length > 0);

  return (
    <PageShell
      eyebrow="Rol de juegos"
      title="Calendario"
      description="Semana por semana, con marcador cuando ya se jugó."
    >
      <div className="mb-8 flex flex-wrap items-center gap-2 animate-fade-in">
        {GROUPS.map((entry) => (
          <FilterChip
            key={entry.id}
            active={entry.id === groupId}
            onClick={() => setGroupId(entry.id)}
          >
            {entry.name}
          </FilterChip>
        ))}
        <div className="ml-auto">
          <FilterChip active={onlyUs} onClick={() => setOnlyUs((value) => !value)} tone="accent">
            Solo nuestro equipo
          </FilterChip>
        </div>
      </div>

      <div className="space-y-10 animate-rise">
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay juegos para este filtro.</p>
        ) : (
          weeks.map((week) => (
            <section key={`${group?.groupId}-${week.label}`} className="border-t border-border/60 pt-8 first:border-0 first:pt-0">
              <SectionLabel>{week.range}</SectionLabel>
              <h2 className="mt-2 mb-5 text-2xl">{week.label}</h2>
              <div className="space-y-5">
                {week.matches.map((match, index) => (
                  <div key={`${match.home}-${match.away}-${index}`}>
                    <p className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">
                      {match.date}
                    </p>
                    <MatchRow match={match} />
                    <MatchMeta match={match} />
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <DataNote fetchedAt={data.fetchedAt} stale={data.stale} />
    </PageShell>
  );
}
