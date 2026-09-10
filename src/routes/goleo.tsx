import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DataNote, FilterChip, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { cardsQuery, scorersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { OUR_TEAM } from "@/lib/zione/constants";
import type { GroupPlayerStats } from "@/lib/zione/types";

export const Route = createFileRoute("/goleo")({
  head: () => ({
    meta: [
      { title: "Goleo · Cancha" },
      {
        name: "description",
        content:
          "Tabla de goleo individual y tarjetas de los Grupos 4 A y 4 B en la F7 Sabatino Vespertino.",
      },
      { property: "og:title", content: "Goleo · Cancha" },
      { property: "og:description", content: "Goleo individual y tarjetas por grupo." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.allSettled([
      context.queryClient.ensureQueryData(scorersQuery),
      context.queryClient.ensureQueryData(cardsQuery),
    ]);
  },
  component: GoleoPage,
  errorComponent: () => (
    <LeagueRetryError
      title="Goleo"
      description="No pudimos cargar las estadísticas por ahora."
    />
  ),
});

function StatList({ group, valueLabel }: { group: GroupPlayerStats; valueLabel: string }) {
  return (
    <section>
      <SectionLabel>Grupo</SectionLabel>
      <h2 className="mt-2 mb-5 text-2xl">{group.groupName}</h2>
      <div className="space-y-1">
        {group.rows.slice(0, 15).map((row) => (
          <div
            key={`${row.player}-${row.position}`}
            className={cn(
              "flex items-center gap-3 rounded-lg bg-secondary/45 px-4 py-3",
              row.team === OUR_TEAM && "bg-primary/10 outline outline-1 outline-primary/25",
            )}
          >
            <span className="w-6 text-sm tabular-nums text-muted-foreground">{row.position}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{row.player}</p>
              <p className="truncate text-xs text-muted-foreground">{row.team}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums">{row.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {valueLabel}
              </p>
            </div>
          </div>
        ))}
        {group.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay registros.</p>
        ) : null}
      </div>
    </section>
  );
}

function GoleoPage() {
  const scorers = useSuspenseQuery(scorersQuery).data;
  const cards = useSuspenseQuery(cardsQuery).data;
  const [tab, setTab] = useState<"goleo" | "tarjetas">("goleo");

  const groups = tab === "goleo" ? scorers.data : cards.data;
  const label = tab === "goleo" ? "goles" : "tarjetas";

  return (
    <PageShell
      eyebrow="Estadísticas"
      title="Goleo y tarjetas"
      description="Goleadores y tarjetas de los Grupos 4 A y 4 B."
    >
      <div className="mb-8 flex gap-2 animate-fade-in">
        {(["goleo", "tarjetas"] as const).map((option) => (
          <FilterChip key={option} active={option === tab} onClick={() => setTab(option)}>
            {option === "goleo" ? "Goleo" : "Tarjetas"}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-12 animate-rise">
        {groups.map((group) => (
          <StatList key={`${tab}-${group.groupId}`} group={group} valueLabel={label} />
        ))}
      </div>
      <DataNote
        fetchedAt={tab === "goleo" ? scorers.fetchedAt : cards.fetchedAt}
        stale={tab === "goleo" ? scorers.stale : cards.stale}
      />
    </PageShell>
  );
}
