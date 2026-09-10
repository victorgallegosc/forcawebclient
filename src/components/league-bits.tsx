import { OUR_TEAM } from "@/lib/zione/constants";
import type { Match, StandingRow } from "@/lib/zione/types";
import { cn } from "@/lib/utils";

export const isUs = (team: string) => team.trim() === OUR_TEAM;

export function TeamName({ team, className }: { team: string; className?: string }) {
  const [code, ...rest] = team.split(" ");
  const name = rest.join(" ") || team;
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("font-semibold", isUs(team) ? "text-primary" : "text-foreground")}>
        {name}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{code}</span>
    </span>
  );
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-y-1 text-sm">
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
              <td className="px-3 py-3">
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

export function MatchRow({ match }: { match: Match }) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg bg-secondary/45 px-4 py-3.5",
        (isUs(match.home) || isUs(match.away)) &&
          "bg-primary/8 outline outline-1 outline-primary/20",
      )}
    >
      <div className="min-w-0 flex-1 text-right">
        <TeamName team={match.home} />
      </div>
      <div className="shrink-0 rounded-md bg-background px-3 py-1.5 text-center font-semibold tabular-nums shadow-[inset_0_0_0_1px_var(--color-border)]">
        {played ? `${match.homeGoals} – ${match.awayGoals}` : match.time || "vs"}
      </div>
      <div className="min-w-0 flex-1">
        <TeamName team={match.away} />
      </div>
    </div>
  );
}

export function MatchMeta({ match }: { match: Match }) {
  return (
    <p className="mt-1.5 px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {[match.round, match.place, match.group, match.status].filter(Boolean).join(" · ")}
    </p>
  );
}
