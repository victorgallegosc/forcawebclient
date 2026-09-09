export type StandingRow = {
  position: number;
  team: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  points: number;
};

export type StandingsGroup = {
  groupId: string;
  groupName: string;
  rows: StandingRow[];
};

export type Match = {
  date: string; // raw label, e.g. "Sáb, 4 Jul, 2026"
  iso: string | null; // YYYY-MM-DD when parseable
  home: string;
  away: string;
  group: string;
  round: string; // "Jornada 1"
  stage: string; // "Regular"
  time: string; // "17:00"
  place: string; // "Cancha 1"
  status: string; // "Jugado" | "Pendiente" | ...
  homeGoals: number | null;
  awayGoals: number | null;
};

export type MatchWeek = {
  label: string; // "Semana 6"
  range: string; // "Del 29 de Junio al 5 de Julio, 2026"
  matches: Match[];
};

export type GroupSchedule = {
  groupId: string;
  groupName: string;
  weeks: MatchWeek[];
};

export type PlayerStat = {
  position: number;
  player: string;
  team: string;
  group: string;
  played: number;
  value: number;
  average: string | null;
};

export type GroupPlayerStats = {
  groupId: string;
  groupName: string;
  rows: PlayerStat[];
};

export type Fetched<T> = {
  data: T;
  fetchedAt: string;
  stale: boolean;
};
