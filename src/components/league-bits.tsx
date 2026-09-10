import { Link } from "@tanstack/react-router";

import { OUR_TEAM } from "@/lib/zione/constants";
import type { Match, StandingRow } from "@/lib/zione/types";
import { shortTeamName } from "@/lib/league-helpers";
import { cn } from "@/lib/utils";

export const isUs = (team: string) => team.trim() === OUR_TEAM;

export function teamPath(team: string) {
  return {
    to: "/equipo/$name" as const,
    params: { name: team },
  };
}

export function TeamName({
  team,
  className,
  truncate = false,
  link = true,
}: {
  team: string;
  className?: string;
  /** Prefer wrapping so full names stay readable on match rows. */
  truncate?: boolean;
  /** When false, render plain text (e.g. inside another interactive control). */
  link?: boolean;
}) {
  const name = shortTeamName(team);
  const classes = cn(
    "block font-semibold leading-snug",
    truncate ? "truncate" : "whitespace-normal break-words",
    isUs(team) ? "text-primary" : "text-foreground",
    link && "transition-opacity hover:opacity-75",
    className,
  );

  if (!link) {
    return (
      <span className={classes} title={name}>
        {name}
      </span>
    );
  }

  return (
    <Link {...teamPath(team)} className={classes} title={name} onClick={(event) => event.stopPropagation()}>
      {name}
    </Link>
  );
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Equipo</th>
            <th className="px-2 py-2 text-center font-medium">JJ</th>
            <th className="px-2 py-2 text-center font-medium">G</th>
            <th className="px-2 py-2 text-center font-medium">E</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">GF</th>
            <th className="px-2 py-2 text-center font-medium">GC</th>
            <th className="px-2 py-2 text-center font-medium">Dif</th>
            <th className="px-3 py-2 text-center font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.group}-${row.team}`}
              className={cn(
                "bg-secondary/50",
                isUs(row.team) && "bg-primary/10 outline outline-1 outline-primary/25",
              )}
            >
              <td className="rounded-l-lg px-3 py-3 text-muted-foreground">{row.position}</td>
              <td className="max-w-[12rem] px-3 py-3 sm:max-w-[16rem]">
                <TeamName team={row.team} />
              </td>
              <td className="px-2 py-3 text-center text-muted-foreground">{row.played}</td>
              <td className="px-2 py-3 text-center">{row.won}</td>
              <td className="px-2 py-3 text-center">{row.drawn}</td>
              <td className="px-2 py-3 text-center">{row.lost}</td>
              <td className="px-2 py-3 text-center text-muted-foreground">{row.goalsFor}</td>
              <td className="px-2 py-3 text-center text-muted-foreground">{row.goalsAgainst}</td>
              <td className="px-2 py-3 text-center text-muted-foreground">{row.diff}</td>
              <td className="rounded-r-lg px-3 py-3 text-center font-bold tabular-nums">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function matchPath(match: Match) {
  if (!match.iso) return null;
  return {
    to: "/partido/$iso" as const,
    params: { iso: match.iso },
    search: { home: match.home, away: match.away },
  };
}

export function MatchRow({ match }: { match: Match }) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const path = matchPath(match);
  const ours = isUs(match.home) || isUs(match.away);

  const score = (
    <div className="shrink-0 rounded-md bg-background px-2.5 py-1.5 text-center text-sm font-semibold tabular-nums shadow-[inset_0_0_0_1px_var(--color-border)] sm:px-3">
      {played ? `${match.homeGoals} – ${match.awayGoals}` : match.time || "vs"}
    </div>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg bg-secondary/45 px-3 py-3.5 sm:gap-3 sm:px-4",
        ours && "bg-primary/8 outline outline-1 outline-primary/20",
      )}
    >
      <div className="min-w-0 flex-1 text-right">
        <TeamName team={match.home} />
      </div>
      {path ? (
        <Link
          {...path}
          className="shrink-0 transition-opacity hover:opacity-80"
          aria-label="Ver partido"
        >
          {score}
        </Link>
      ) : (
        score
      )}
      <div className="min-w-0 flex-1">
        <TeamName team={match.away} />
      </div>
    </div>
  );
}

export function MatchMeta({ match }: { match: Match }) {
  return (
    <p className="mt-1.5 truncate px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {[match.round, match.place, match.group, match.status].filter(Boolean).join(" · ")}
    </p>
  );
}
