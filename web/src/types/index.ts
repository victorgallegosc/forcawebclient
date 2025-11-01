import {
    ZioneScheduleMeta,
    ZioneMatch,
    ZioneResultMatch,
    ZioneTeam,
    ZioneStandingsRow
} from '../../../sdk/src';

export type TeamClickContext = {
    scheduleMeta: ZioneScheduleMeta;
    match?: ZioneMatch;
    resultMatch?: ZioneResultMatch;
    matchdayDate?: string | null;
    standingsGroup?: string | null;
    standingsRow?: ZioneStandingsRow;
    source: 'schedule' | 'team-schedule' | 'results' | 'standings';
};

export type SummaryItem = {
    label: string;
    value: string;
    icon?: string;
};

export type MatchResult = {
    score1: number | null;
    score2: number | null;
    separator?: string | null;
};

export type TeamInfoState = {
    open: boolean;
    loading: boolean;
    team: ZioneTeam | null;
    context: TeamClickContext | null;
    data: any;
    error: string | null;
};

export const DEFAULT_DTS = 'DTS094';

export const STANDINGS_HEADER_KEY_MAP: Partial<Record<string, keyof ZioneStandingsRow>> = {
    Lugar: 'Lugar',
    Equipo: 'Equipo',
    JJ: 'JJ',
    JG: 'JG',
    JE: 'JE',
    EG: 'EG',
    EP: 'EP',
    JP: 'JP',
    GF: 'GF',
    GC: 'GC',
    Dif: 'Dif',
    PA: 'PA',
    Pts: 'Pts'
};

export const ROSTER_FIELD_LABELS: Record<string, string> = {
    GOL: 'Goles',
    AGOL: 'Autogoles',
    PNAL: 'Penales',
    Amarilla: 'Amarillas',
    Roja: 'Rojas'
};

export const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const SCORE_INVALID_TOKENS = new Set(['', '-', '—', 'vs']);
