import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Car, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { OpenMapsButton } from "@/components/open-maps-button";
import { DataNote, PageShell, Panel, SectionLabel } from "@/components/app-shell";
import { LeagueRetryError } from "@/components/league-error";
import { MatchRow, isUs } from "@/components/league-bits";
import { shortTeamName } from "@/lib/league-helpers";
import { rideStateQuery, scheduleQuery } from "@/lib/queries";
import { setActualDriver, setCancelled } from "@/lib/rides/rides-data";
import {
  DRIVERS,
  computeRotation,
  formatDay,
  type Driver,
} from "@/lib/rides/rotation";
import type { GroupSchedule, Match } from "@/lib/zione/types";

export const Route = createFileRoute("/ride/$day")({
  head: ({ params }) => ({
    meta: [
      { title: `Ride ${params.day} · Cancha` },
      {
        name: "description",
        content: "Detalle del ride y ruta en Google Maps.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQuery),
      context.queryClient.ensureQueryData(rideStateQuery),
    ]);
  },
  component: RideDetailPage,
  errorComponent: () => (
    <LeagueRetryError
      title="Ride"
      description="No pudimos cargar el detalle del ride."
    />
  ),
});

function ourFixtureDays(groups: GroupSchedule[]) {
  const days = new Set<string>();
  for (const group of groups) {
    for (const week of group.weeks) {
      for (const match of week.matches) {
        if (match.iso && (isUs(match.home) || isUs(match.away))) days.add(match.iso);
      }
    }
  }
  return [...days].sort();
}

function findOurMatch(groups: GroupSchedule[], day: string): Match | null {
  for (const group of groups) {
    for (const week of group.weeks) {
      for (const match of week.matches) {
        if (match.iso === day && (isUs(match.home) || isUs(match.away))) return match;
      }
    }
  }
  return null;
}

function RideDetailPage() {
  const { day } = Route.useParams();
  const queryClient = useQueryClient();
  const schedule = useSuspenseQuery(scheduleQuery).data;
  const rideState = useSuspenseQuery(rideStateQuery).data;
  const [message, setMessage] = useState<string | null>(null);

  const fixtureDays = useMemo(() => ourFixtureDays(schedule.data), [schedule.data]);
  const rotation = useMemo(
    () => computeRotation(fixtureDays, rideState.adjustments),
    [fixtureDays, rideState.adjustments],
  );
  const rideDay = rotation.days.find((entry) => entry.day === day) ?? null;
  const match = useMemo(() => findOurMatch(schedule.data, day), [schedule.data, day]);
  const driver = (rideDay?.actualDriver ?? rideDay?.driver) as Driver | null;
  const dueDriver = rideDay?.dueDriver ?? null;

  const run = useMutation({
    mutationFn: async (task: () => Promise<string | null | void>) => task(),
    onSuccess: async (result) => {
      setMessage(typeof result === "string" ? result : "Listo.");
      await queryClient.invalidateQueries({ queryKey: ["ride-state"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  if (!rideDay) {
    return (
      <PageShell eyebrow="Ride" title="No encontrado" description="Ese sábado no está en el rol.">
        <Link to="/aventones" className="text-sm font-semibold text-primary">
          Volver a Ride
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Ride"
      title={formatDay(day)}
      description={
        rideDay.cancelled
          ? "Sin ride este sábado."
          : driver
            ? `${driver} da el ride.`
            : "Ride por definir."
      }
    >
      <Link
        to="/aventones"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Ride
      </Link>

      <div className="grid animate-rise gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <SectionLabel>Próximo ride</SectionLabel>
          {rideDay.cancelled ? (
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              Sin ride este sábado.
            </p>
          ) : (
            <>
              <p className="display-title mt-4 text-5xl md:text-6xl">
                {driver ?? "Por definir"}
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {rideDay.actualDriver
                  ? "Dio el ride"
                  : dueDriver && driver && dueDriver !== driver
                    ? `Le toca a ${driver}`
                    : "Le toca el ride"}
                {rideDay.swapped ? " · cambio acordado" : ""}
              </p>

              {driver && DRIVERS.includes(driver) ? (
                <div className="mt-7">
                  <OpenMapsButton driver={driver} />
                </div>
              ) : null}

              {!rideDay.actualDriver ? (
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {driver ? (
                    <button
                      type="button"
                      onClick={() =>
                        run.mutate(() => setActualDriver(day, driver))
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/80"
                    >
                      <Car className="size-4" /> Confirmar que dio el ride
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => run.mutate(() => setCancelled(day, true))}
                    className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/80"
                  >
                    <XCircle className="size-4" /> Sin ride
                  </button>
                </div>
              ) : null}
            </>
          )}

          {message ? (
            <p
              role="status"
              className="mt-5 rounded-xl bg-accent/20 px-4 py-3 text-sm font-medium text-accent-foreground"
            >
              {message}
            </p>
          ) : null}
        </Panel>

        {match ? (
          <Panel>
            <SectionLabel>Partido</SectionLabel>
            <p className="mt-3 text-sm text-muted-foreground">
              {[match.date || formatDay(day), match.time ? `${match.time} hrs` : null, match.place]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-4">
              <MatchRow match={match} />
            </div>
            <p className="mt-3 text-sm font-medium">
              {shortTeamName(match.home)} vs {shortTeamName(match.away)}
            </p>
            {match.iso ? (
              <Link
                to="/partido/$iso"
                params={{ iso: match.iso }}
                search={{ home: match.home, away: match.away }}
                className="mt-5 inline-flex text-sm font-semibold text-primary"
              >
                Ver partido
              </Link>
            ) : null}
          </Panel>
        ) : null}
      </div>

      <DataNote fetchedAt={schedule.fetchedAt} stale={schedule.stale} />
    </PageShell>
  );
}
