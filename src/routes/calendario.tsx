import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DataNote, PageShell, Panel } from "@/components/app-shell";
import { MatchMeta, MatchRow, isUs } from "@/components/league-bits";
import { scheduleQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { GROUPS } from "@/lib/zione/constants";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario y resultados · Sunderland A3860" },
      {
        name: "description",
        content:
          "Rol de juegos y resultados semana por semana de los Grupos 4 A y 4 B, F7 Sabatino Vespertino.",
      },
      { property: "og:title", content: "Calendario y resultados · Sunderland A3860" },
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
      description="Semana por semana, con marcador final cuando ya se jugó."
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {GROUPS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setGroupId(entry.id)}
            aria-pressed={entry.id === groupId}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              entry.id === groupId
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.name}
          </button>
        ))}
        <button
          onClick={() => setOnlyUs((value) => !value)}
          aria-pressed={onlyUs}
          className={cn(
            "ml-auto rounded-full px-4 py-2 text-sm font-medium transition-colors",
            onlyUs
              ? "bg-accent text-accent-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          Solo Sunderland
        </button>
      </div>

      <div className="space-y-5">
        {weeks.length === 0 ? (
          <Panel>No hay juegos para este filtro.</Panel>
        ) : (
          weeks.map((week) => (
            <Panel key={`${group?.groupId}-${week.label}`}>
              <div className="mb-4">
                <h2 className="text-2xl">{week.label}</h2>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {week.range}
                </p>
              </div>
              <div className="space-y-4">
                {week.matches.map((match, index) => (
                  <div key={`${match.home}-${match.away}-${index}`}>
                    <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-primary">
                      {match.date}
                    </p>
                    <MatchRow match={match} />
                    <MatchMeta match={match} />
                  </div>
                ))}
              </div>
            </Panel>
          ))
        )}
      </div>
      <DataNote fetchedAt={data.fetchedAt} stale={data.stale} />
    </PageShell>
  );
}
