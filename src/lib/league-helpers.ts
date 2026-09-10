import type { Match, StandingRow } from "@/lib/zione/types";
import { isUs } from "@/components/league-bits";

export type FormResult = "V" | "E" | "D";

/** Last played matches for our team, newest first. */
export function ourPlayedMatches(matches: Match[]) {
  return matches
    .filter((match) => isUs(match.home) || isUs(match.away))
    .filter((match) => match.homeGoals !== null && match.awayGoals !== null)
    .sort((a, b) => (b.iso ?? "").localeCompare(a.iso ?? ""));
}

export function formFromMatches(matches: Match[], limit = 5): FormResult[] {
  return ourPlayedMatches(matches)
    .slice(0, limit)
    .map((match) => {
      const usHome = isUs(match.home);
      const usGoals = usHome ? match.homeGoals! : match.awayGoals!;
      const themGoals = usHome ? match.awayGoals! : match.homeGoals!;
      if (usGoals > themGoals) return "V";
      if (usGoals < themGoals) return "D";
      return "E";
    });
}

export function opponentName(match: Match) {
  return isUs(match.home) ? match.away : match.home;
}

export function shortTeamName(team: string) {
  const [, ...rest] = team.split(" ");
  return rest.join(" ") || team;
}

export function sameTeam(a: string, b: string) {
  return a.trim() === b.trim();
}

/** All matches for a team across groups, oldest → newest. */
export function teamMatches(matches: Match[], team: string) {
  return matches
    .filter((match) => sameTeam(match.home, team) || sameTeam(match.away, team))
    .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""));
}

export function teamPlayedMatches(matches: Match[], team: string) {
  return teamMatches(matches, team)
    .filter((match) => match.homeGoals !== null && match.awayGoals !== null)
    .sort((a, b) => (b.iso ?? "").localeCompare(a.iso ?? ""));
}

export function teamFormFromMatches(
  matches: Match[],
  team: string,
  limit = 5,
): FormResult[] {
  return teamPlayedMatches(matches, team)
    .slice(0, limit)
    .map((match) => teamResultCode(match, team)!);
}

export function teamResultCode(match: Match, team: string): FormResult | null {
  if (match.homeGoals === null || match.awayGoals === null) return null;
  const home = sameTeam(match.home, team);
  const goalsFor = home ? match.homeGoals : match.awayGoals;
  const goalsAgainst = home ? match.awayGoals : match.homeGoals;
  if (goalsFor > goalsAgainst) return "V";
  if (goalsFor < goalsAgainst) return "D";
  return "E";
}

export function teamResultLabel(match: Match, team: string) {
  const code = teamResultCode(match, team);
  if (code === "V") return "Victoria";
  if (code === "D") return "Derrota";
  if (code === "E") return "Empate";
  return null;
}

export function teamOpponent(match: Match, team: string) {
  return sameTeam(match.home, team) ? match.away : match.home;
}

export function findStanding(rows: StandingRow[], team: string) {
  return rows.find((row) => sameTeam(row.team, team)) ?? null;
}

/** Resolve a route/team param against known full team names. */
export function resolveTeamName(param: string, knownTeams: string[]) {
  const decoded = decodeURIComponent(param).trim();
  const exact = knownTeams.find((team) => sameTeam(team, decoded));
  if (exact) return exact;
  const byShort = knownTeams.find(
    (team) => shortTeamName(team).toLowerCase() === decoded.toLowerCase(),
  );
  if (byShort) return byShort;
  return decoded;
}

/** Human countdown to a Saturday evening kickoff in Monterrey. */
export function countdownLabel(iso: string | null, nowIso: string) {
  if (!iso) return null;
  const start = new Date(`${iso}T17:00:00-06:00`).getTime();
  const now = new Date(`${nowIso}T12:00:00-06:00`).getTime();
  const diffMs = start - now;
  if (diffMs <= 0) return "Hoy";
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

export function isMatchday(iso: string | null, today: string) {
  return Boolean(iso && iso === today);
}

export function resultLabel(match: Match) {
  if (match.homeGoals === null || match.awayGoals === null) return null;
  const usHome = isUs(match.home);
  const usGoals = usHome ? match.homeGoals : match.awayGoals;
  const themGoals = usHome ? match.awayGoals : match.homeGoals;
  if (usGoals > themGoals) return "Victoria";
  if (usGoals < themGoals) return "Derrota";
  return "Empate";
}

/** Points behind (or ahead of) the group leader. */
export function gapToLeader(rows: StandingRow[], team: string) {
  if (rows.length === 0) return null;
  const leader = [...rows].sort((a, b) => a.position - b.position)[0];
  const us = findStanding(rows, team);
  if (!leader || !us) return null;
  return {
    leader: leader.team,
    leaderPoints: leader.points,
    gap: leader.points - us.points,
    isLeader: leader.team.trim() === team.trim(),
  };
}

/** Head-to-head results vs a rival (played matches only). */
export function headToHead(matches: Match[], rival: string) {
  const played = matches.filter((match) => {
    const vs =
      (isUs(match.home) && match.away.trim() === rival.trim()) ||
      (isUs(match.away) && match.home.trim() === rival.trim());
    return vs && match.homeGoals !== null && match.awayGoals !== null;
  });
  let won = 0;
  let drawn = 0;
  let lost = 0;
  for (const match of played) {
    const result = resultLabel(match);
    if (result === "Victoria") won += 1;
    else if (result === "Empate") drawn += 1;
    else if (result === "Derrota") lost += 1;
  }
  return { played: played.length, won, drawn, lost, matches: played };
}
