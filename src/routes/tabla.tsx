import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DataNote, Panel, PageShell } from "@/components/app-shell";
import { StandingsTable } from "@/components/league-bits";
import { standingsQuery } from "@/lib/queries";
import { CATEGORY_NAME, TOURNAMENT_NAME } from "@/lib/zione/constants";

export const Route = createFileRoute("/tabla")({
  head: () => ({
    meta: [
      { title: "Tabla de posiciones · Sunderland A3860" },
      {
        name: "description",
        content:
          "Posiciones de los Grupos 4 A y 4 B de la F7 Sabatino Vespertino en el 3er Torneo Fin de Semana 2026.",
      },
      { property: "og:title", content: "Tabla de posiciones · Sunderland A3860" },
      {
        property: "og:description",
        content: "Posiciones actualizadas de los Grupos 4 A y 4 B.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(standingsQuery),
  component: TablaPage,
  errorComponent: () => (
    <PageShell title="Tabla" description="No pudimos leer la tabla de la liga en este momento.">
      <Panel>Intenta de nuevo en unos minutos.</Panel>
    </PageShell>
  ),
});

function TablaPage() {
  const { data } = useSuspenseQuery(standingsQuery);

  return (
    <PageShell
      eyebrow={CATEGORY_NAME}
      title="Tabla de posiciones"
      description={`${TOURNAMENT_NAME} · Grupos 4 A y 4 B`}
    >
      <div className="space-y-6">
        {data.data.map((group) => (
          <Panel key={group.groupId}>
            <h2 className="mb-4 text-2xl">{group.groupName}</h2>
            <StandingsTable rows={group.rows} />
          </Panel>
        ))}
      </div>
      <DataNote fetchedAt={data.fetchedAt} stale={data.stale} />
    </PageShell>
  );
}
