import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DataNote, Panel, PageShell, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { StandingsTable } from "@/components/league-bits";
import { standingsQuery } from "@/lib/queries";
import { CATEGORY_NAME, TOURNAMENT_NAME } from "@/lib/zione/constants";

export const Route = createFileRoute("/tabla")({
  head: () => ({
    meta: [
      { title: "Tabla · Cancha" },
      {
        name: "description",
        content:
          "Posiciones de los Grupos 4 A y 4 B de la F7 Sabatino Vespertino en el 3er Torneo Fin de Semana 2026.",
      },
      { property: "og:title", content: "Tabla · Cancha" },
      {
        property: "og:description",
        content: "Posiciones actualizadas de los Grupos 4 A y 4 B.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(standingsQuery),
  component: TablaPage,
  errorComponent: () => (
    <LeagueRetryError
      title="Tabla"
      description="No pudimos leer la tabla de la liga en este momento."
    />
  ),
});

function TablaPage() {
  const { data } = useSuspenseQuery(standingsQuery);

  return (
    <PageShell
      eyebrow={CATEGORY_NAME}
      title="Tabla"
      description={`${TOURNAMENT_NAME} · Grupos 4 A y 4 B`}
    >
      <div className="space-y-12 animate-rise">
        {data.data.map((group) => (
          <section key={group.groupId}>
            <SectionLabel>Grupo</SectionLabel>
            <h2 className="mt-2 mb-5 text-2xl">{group.groupName}</h2>
            <StandingsTable rows={group.rows} />
          </section>
        ))}
      </div>
      <DataNote fetchedAt={data.fetchedAt} stale={data.stale} />
    </PageShell>
  );
}
