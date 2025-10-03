export interface TablaMeta {
  index: number;
  id: string | null;
  className: string | null;
  title: string | null;
}

export interface TablaParsed {
  meta: TablaMeta;
  headers: string[];
  rows: Record<string, string>[];
}

export interface Torneo {
  torID: string;
  nombre: string;
  selected?: boolean;
}

export interface Horario {
  divID: string;
  label: string;
  selected?: boolean;
}

export interface ModuleData {
  url: string;
  tablesCount: number;
  tables: TablaParsed[];
}

export interface DatosModules {
  posiciones: ModuleData;
  rol: ModuleData;
  resultados: ModuleData;
  goleo: ModuleData;
  defofe: ModuleData;
  tarjetas: ModuleData;
  castigados: ModuleData;
  concentrado: ModuleData;
}

export interface ZioneScheduleMeta {
  title: string | null;
  subtitle: string | null;
  source_url: string | null;
  ids: {
    dts: string | null;
    m: string | null;
    torID: string | null;
    divID: string | null;
    gpoID: string | null;
  };
  week: {
    label: string | null;
    start_date: string | null;
    end_date: string | null;
    raw_range: string | null;
  };
  view: string | null;
}

export interface ZioneTeam {
  name: string;
  href: string | null;
  id: number | null;
}

export interface ZioneJornada {
  label: string;
  number: number | null;
}

export interface ZioneMatch {
  time: string | null;
  kickoff: string | null;
  place: string | null;
  team1: ZioneTeam;
  team2: ZioneTeam;
  group: string | null;
  stage: string | null;
  jornada: ZioneJornada;
  status: string | null;
}

export interface ZioneMatchday {
  label: string;
  date: string | null;
  matches: ZioneMatch[];
}

export interface ZioneScheduleTeam {
  name: string;
  division: string | null;
  group: string | null;
  href: string | null;
  id: number | null;
}

export interface ZioneScheduleTeams {
  title: string | null;
  total: number | null;
  teams: ZioneScheduleTeam[];
}

export interface ZioneResultReference {
  className: string;
  label: string;
}

export interface ZioneResultMatch {
  time: string | null;
  kickoff: string | null;
  group: string | null;
  stage: string | null;
  jornada: ZioneJornada;
  team1: ZioneTeam;
  team2: ZioneTeam;
  score1: number | null;
  score2: number | null;
  separator: string | null;
  status: string | null;
}

export interface ZioneResultMatchday {
  label: string;
  date: string | null;
  matches: ZioneResultMatch[];
}

export interface ZioneResults {
  type: 'results';
  meta: ZioneScheduleMeta;
  matchdays: ZioneResultMatchday[];
  summary: {
    total_results: number | null;
  };
  references: ZioneResultReference[];
}

export interface ZioneSchedule {
  meta: ZioneScheduleMeta;
  headers: string[];
  matchdays: ZioneMatchday[];
  rest: ZioneTeam[];
  summary: {
    total_matches: number | null;
  };
  teamsByClub?: ZioneScheduleTeams | null;
}

export interface ZioneTeamMatchSummary {
  opponentName: string | null;
  opponentId: number | null;
  opponentHref: string | null;
  resultLabel: string | null;
  dateLabel: string | null;
  timeLabel: string | null;
  scoreText: string | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
}

export interface ZioneTeamStatItem {
  label: string;
  value: string;
}

export interface ZioneTeamInfo {
  meta: {
    teamId: number | null;
    name: string | null;
    division: string | null;
    group: string | null;
    captain: string | null;
    shield: string | null;
    source_url: string | null;
  };
  summary: {
    lastMatches: ZioneTeamMatchSummary[];
    nextMatches: ZioneTeamMatchSummary[];
  };
  stats: ZioneTeamStatItem[];
  statsTable?: TablaParsed | null;
  rosterTable?: TablaParsed | null;
  roster?: ZioneTeamRosterEntry[];
}

export interface ZioneTeamRosterEntry {
  name: string;
  number: string | null;
  position: string | null;
  stats: Array<{ label: string; value: string }>;
}

export interface ZioneStandingsEquipo {
  name: string;
  href: string | null;
  img: string | null;
}

export interface ZioneStandingsRow {
  Lugar: number | null;
  Equipo: ZioneStandingsEquipo;
  JJ: number | null;
  JG: number | null;
  JE: number | null;
  EG: number | null;
  EP: number | null;
  JP: number | null;
  GF: number | null;
  GC: number | null;
  Dif: number | null;
  PA: number | null;
  Pts: number | null;
  idle: boolean;
}

export interface TeamInfoResponse {
  team: ZioneTeamInfo;
  standings: {
    group: string;
    row: ZioneStandingsRow;
  } | null;
}

export interface TorneosResponse {
  source: string;
  selectName: string | null;
  torneos: Torneo[];
}

export interface HorariosResponse {
  source: string;
  horarios: Horario[];
  gpoCandidates: string[];
  grupoSelectName: string | null;
}

export interface DatosResponse {
  params: {
    dts: string;
    torID: string;
    divID: string;
    gpoID?: string;
  };
  modules: DatosModules;
}

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

const resolveBaseUrl = (input?: string): string => {
  const candidate = input?.trim();

  if (candidate) {
    if (ABSOLUTE_URL_REGEX.test(candidate)) {
      return candidate.replace(/\/+$/, '');
    }

    if (candidate.startsWith('/')) {
      const location = typeof globalThis !== 'undefined' ? (globalThis as any).location : undefined;
      if (location?.origin) {
        return new URL(candidate, location.origin).toString().replace(/\/+$/, '');
      }
      throw new Error('Relative API base URLs require a browser environment.');
    }

    throw new Error('API base URL must be absolute (begin with http/https) or start with "/".');
  }

  const location = typeof globalThis !== 'undefined' ? (globalThis as any).location : undefined;
  if (location?.origin) {
    return location.origin.replace(/\/+$/, '');
  }

  const globalProcess = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  const envBase =
    (globalProcess?.env?.ZIONE_API_BASE_URL ||
      globalProcess?.env?.API_BASE_URL ||
      globalProcess?.env?.VITE_API_BASE_URL ||
      '') as string;

  if (envBase) {
    if (ABSOLUTE_URL_REGEX.test(envBase)) {
      return envBase.replace(/\/+$/, '');
    }
    throw new Error('Environment API base URL must include http/https.');
  }

  throw new Error('No API base URL provided for ZioneClientFlow.');
};

export class ZioneClientFlow {
  private readonly base: string;

  constructor(base?: string) {
    this.base = resolveBaseUrl(base);
  }

  /**
   * Get available tournaments for the given DTS
   */
  async getTorneos(dts: string): Promise<TorneosResponse> {
    const url = new URL('/api/torneos', this.base);
    url.searchParams.set('dts', dts);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch torneos: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get available horarios/divisions for the given tournament
   */
  async getHorarios(dts: string, torID: string): Promise<HorariosResponse> {
    const url = new URL('/api/horarios', this.base);
    url.searchParams.set('dts', dts);
    url.searchParams.set('torID', torID);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch horarios: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get tournament data for a specific module/subdivision/equipo, or all modules if none specified
   */
  async getDatos(
    dts: string,
    torID: string,
    divID: string,
    gpoID?: string,
    options?: { module?: string; v?: string; e?: string }
  ): Promise<any> {
    const url = new URL('/api/datos', this.base);
    url.searchParams.set('dts', dts);
    url.searchParams.set('torID', torID);
    url.searchParams.set('divID', divID);
    if (gpoID) {
      url.searchParams.set('gpoID', gpoID);
    }
    if (options?.module) {
      url.searchParams.set('module', options.module);
    }
    if (options?.v) {
      url.searchParams.set('v', options.v);
    }
    if (options?.e) {
      url.searchParams.set('e', options.e);
    }
    // Build the final Zione endpoint URL for logging
    let zioneUrl = 'https://console.zione.com.mx/torneos/consulta/datos.php?';
    const params = [
      `dts=${encodeURIComponent(dts)}`,
      `torID=${encodeURIComponent(torID)}`,
      `divID=${encodeURIComponent(divID)}`
    ];
    if (gpoID) params.push(`gpoID=${encodeURIComponent(gpoID)}`);
    if (options?.module) params.push(`module=${encodeURIComponent(options.module)}`);
    if (options?.v) params.push(`v=${encodeURIComponent(options.v)}`);
    if (options?.e) params.push(`e=${encodeURIComponent(options.e)}`);
    zioneUrl += params.join('&');
    console.log(`[Zione SDK] Endpoint final Zione: ${zioneUrl}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch datos: ${response.status} - ${errorData.error || response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get parsed Rol de Juegos using the structured endpoint
   */
  async getRolJuegos(
    dts: string,
    torID: string,
    divID: string,
    gpoID?: string,
    options?: { m?: string; v?: string }
  ): Promise<ZioneSchedule> {
    const url = new URL(`/api/rol-juegos-parsed/${dts}`, this.base);
    const mValue = options?.m ?? '2';
    url.searchParams.set('m', mValue);
    if (torID) url.searchParams.set('torID', torID);
    if (divID) url.searchParams.set('divID', divID);
    if (gpoID) url.searchParams.set('gpoID', gpoID);
    if (options?.v) url.searchParams.set('v', options.v);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch rol de juegos: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get parsed resultados (scoreboard) using the structured endpoint
   */
  async getResultados(
    dts: string,
    torID: string,
    divID: string,
    gpoID?: string,
    options?: { m?: string; v?: string; smodo?: string }
  ): Promise<ZioneResults> {
    const url = new URL(`/api/resultados-parsed/${dts}`, this.base);
    url.searchParams.set('torID', torID);
    url.searchParams.set('divID', divID);
    if (gpoID) url.searchParams.set('gpoID', gpoID);
    if (options?.m) url.searchParams.set('m', options.m);
    if (options?.v) url.searchParams.set('v', options.v);
    if (options?.smodo) url.searchParams.set('smodo', options.smodo);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch resultados: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the schedule for a specific team (Rol por Equipo)
   */
  async getRolPorEquipo(
    dts: string,
    teamId: string,
    torID: string,
    divID: string,
    gpoID?: string,
    options?: { v?: string }
  ): Promise<ZioneSchedule> {
    const url = new URL(`/api/rol-juegos-equipo/${dts}/${teamId}`, this.base);
    if (torID) url.searchParams.set('torID', torID);
    if (divID) url.searchParams.set('divID', divID);
    if (gpoID) url.searchParams.set('gpoID', gpoID);
    if (options?.v) url.searchParams.set('v', options.v);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch rol por equipo: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  async getTeamInfo(
    dts: string,
    teamId: string | number,
    options?: { torID?: string; divID?: string; gpoID?: string; m?: string }
  ): Promise<TeamInfoResponse> {
    const url = new URL('/api/team-info', this.base);
    url.searchParams.set('dts', dts);
    url.searchParams.set('teamId', String(teamId));
    if (options?.torID) url.searchParams.set('torID', options.torID);
    if (options?.divID) url.searchParams.set('divID', options.divID);
    if (options?.gpoID) url.searchParams.set('gpoID', options.gpoID);
    if (options?.m) url.searchParams.set('m', options.m);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch team info: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }
}

// Default export
export default ZioneClientFlow;
