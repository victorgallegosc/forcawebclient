import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DataNote, PageShell, Panel } from "@/components/app-shell";
import { cardsQuery, scorersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { OUR_TEAM } from "@/lib/zione/constants";
import type { GroupPlayerStats } from "@/lib/zione/types";

export const Route = createFileRoute("/goleo")({
  head: () => ({
    meta: [
      { title: "Goleo y tarjetas · Sunderland A3860" },
      {
        name: "description",
        content:
          "Tabla de goleo individual y tarjetas de los Grupos 4 A y 4 B en la F7 Sabatino Vespertino.",
      },
      { property: "og:title", content: "Goleo y tarjetas · Sunderland A3860" },
      { property: "og:description", content: "Goleo individual y tarjetas por grupo." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scorersQuery),
      context.queryClient.ensureQueryData(cardsQuery),
    ]);
  },
  component: GoleoPage,
  errorComponent: () => (
    <PageShell title="Goleo" description="No pudimos leer las estadísticas ahora mismo.">
      <Panel>Intenta de nuevo en unos minutos.</Panel>
    </PageShell>
  ),
});

function StatTable({ group, valueLabel }: { group: GroupPlayerStats; valueLabel: string }) {
  return (
    <Panel>
      <h2 className="mb-4 text-2xl">{group.groupName}</h2>
      <div className="space-y-1">
        {group.rows.slice(0, 15).map((row) => (
          <div
            key={`${row.player}-${row.position}`}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3",
              row.team === OUR_TEAM && "bg-primary/15 ring-1 ring-primary/40",
            )}
          >
            <span className="w-6 text-sm text-muted-foreground">{row.position}</span>
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
          <p className="text-sm text-muted-foreground">Sin registros todavía.</p>
        ) : null}
      </div>
    </Panel>
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
      description="Los individuales de los Grupos 4 A y 4 B."
    >
      <div className="mb-6 flex gap-2">
        {(["goleo", "tarjetas"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTab(option)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors",
              option === tab
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <StatTable key={`${tab}-${group.groupId}`} group={group} valueLabel={label} />
        ))}
      </div>
      <DataNote
        fetchedAt={tab === "goleo" ? scorers.fetchedAt : cards.fetchedAt}
        stale={tab === "goleo" ? scorers.stale : cards.stale}
      />
    </PageShell>
  );
}
