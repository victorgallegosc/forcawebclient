import { CheerioAPI } from 'cheerio';
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
export interface ZioneMeta {
    title: string | null;
    subtitle: string | null;
    etapa: string | null;
    source_url: string | null;
    dts: string | null;
    m: string | null;
    torID: string | null;
    divID: string | null;
    gpoID: string | null;
}
export interface ZioneEquipo {
    name: string;
    href: string | null;
    img: string | null;
}
export interface ZioneRow {
    Lugar: number | null;
    Equipo: ZioneEquipo;
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
export interface ZioneGroup {
    group: string;
    rows: ZioneRow[];
}
export interface ZioneStandings {
    meta: ZioneMeta;
    headers: string[];
    groups: ZioneGroup[];
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
    roster?: Array<{
        name: string;
        number: string | null;
        position: string | null;
        stats: Array<{
            label: string;
            value: string;
        }>;
    }>;
}
export interface CookieJar {
    cookies: string[];
}
export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}
export interface FetchResult {
    status: number;
    headers: Record<string, string | string[]>;
    text: string;
    jar: CookieJar;
}
/**
 * Main parser function for Zione schedule tables (Rol de Juegos)
 */
export declare function parseZioneSchedule($: CheerioAPI, baseUrl?: string): ZioneSchedule;
export declare function parseZioneTeamSchedule($: CheerioAPI, options: {
    teamName?: string | null;
    teamId?: string | number | null;
    dts?: string | null;
}, baseUrl?: string): ZioneSchedule;
export declare function parseZioneResults($: CheerioAPI, baseUrl?: string): ZioneResults;
export declare function parseZioneScheduleTeams($: CheerioAPI, baseUrl?: string): ZioneScheduleTeams | null;
/**
 * Main parser function for Zione standings tables
 */
export declare function parseZioneStandings($: CheerioAPI, baseUrl?: string): ZioneStandings;
/**
 * Build URL with query parameters
 */
export declare function buildUrl(basePath: string, params: Record<string, string | number | undefined>): string;
/**
 * Fetch with cookie jar management
 */
export declare function fetchWithCookies(url: string, options?: FetchOptions, jar?: CookieJar): Promise<FetchResult>;
/**
 * Legacy function - convert HTML table to JSON structure (keeping for compatibility)
 */
export declare function tableToJson($: CheerioAPI, tableElement: any, index: number): TablaParsed;
export declare function parseTeamInfo($: CheerioAPI, teamId: string | number | null, baseUrl?: string): ZioneTeamInfo;
/**
 * Parse all select elements in HTML
 */
export declare function parseSelects($: CheerioAPI): {
    name: string | null;
    id: string | null;
    options: Array<{
        value: string;
        text: string;
        selected: boolean;
    }>;
}[];
/**
 * Extract horarios/divisions from HTML (robust approach)
 */
export declare function extractHorarios($: CheerioAPI): Array<{
    divID: string;
    label: string;
}>;
/**
 * Parse candidate IDs from links (gpoID and others)
 */
export declare function parseCandidateIDsFromLinks($: CheerioAPI): {
    gpoCandidates: string[];
    grupoSelectName: string | null;
};
//# sourceMappingURL=utils.d.ts.map