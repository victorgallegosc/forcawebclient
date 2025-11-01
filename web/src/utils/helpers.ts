import { ZioneTeam, ZioneMatch, ZioneResults, ZioneResultMatch } from '../../../sdk/src';
import { MONTH_ABBR, SCORE_INVALID_TOKENS, MatchResult } from '../types';

export const getTeamIdFromHref = (href: string | null | undefined): string | null => {
    if (!href) return null;
    const match = href.match(/(?:[?&]e=)(\d+)/i);
    return match ? match[1] : null;
};

export const getTeamId = (team: ZioneTeam | null | undefined): string | null => {
    if (!team) return null;
    if (team.id != null) return String(team.id);
    return getTeamIdFromHref(team.href);
};

export const formatIsoToLabel = (iso: string | null | undefined) => {
    if (!iso) return null;
    const [year, month, day] = iso.split('-');
    const monthIndex = Number(month) - 1;
    const monthLabel = MONTH_ABBR[monthIndex] || month;
    return `${day}-${monthLabel}-${year}`;
};

export const normalizeTextKey = (value?: string | null) => {
    if (!value) return '';
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
};

export const normalizeTeamKey = (team?: ZioneMatch['team1']) => {
    if (!team) return 'team:none';
    if (team.id != null) return `team:${team.id}`;
    const nameKey = normalizeTextKey(team.name);
    return nameKey ? `name:${nameKey}` : 'team:none';
};

export const normalizeJornadaKey = (jornada?: ZioneMatch['jornada']) => {
    if (!jornada) return 'j:none';
    if (jornada.number != null) return `jn:${jornada.number}`;
    const labelKey = normalizeTextKey(jornada.label);
    return labelKey ? `jl:${labelKey}` : 'j:none';
};

export const createMatchKey = (
    team1: ZioneMatch['team1'],
    team2: ZioneMatch['team2'],
    jornada: ZioneMatch['jornada'],
    stage?: string | null,
    date?: string | null,
    group?: string | null
) => {
    const parts = [
        normalizeTeamKey(team1),
        normalizeTeamKey(team2),
        normalizeJornadaKey(jornada)
    ];

    const stageKey = normalizeTextKey(stage);
    if (stageKey) parts.push(`st:${stageKey}`);

    if (date) parts.push(`dt:${date}`);

    const groupKey = normalizeTextKey(group);
    if (groupKey) parts.push(`grp:${groupKey}`);

    return parts.join('|');
};

export const collectMatchKeys = (
    team1: ZioneMatch['team1'],
    team2: ZioneMatch['team2'],
    jornada: ZioneMatch['jornada'],
    stage?: string | null,
    date?: string | null,
    group?: string | null
) => {
    const keys = new Set<string>();
    const combos: Array<[string | null | undefined, string | null | undefined]> = [
        [stage, date],
        [stage, null],
        [null, date],
        [null, null]
    ];

    combos.forEach(([stageVariant, dateVariant]) => {
        const key = createMatchKey(team1, team2, jornada, stageVariant, dateVariant, group);
        if (key) keys.add(key);
    });

    return Array.from(keys);
};

export const buildResultLookup = (results: ZioneResults | null | undefined): Record<string, MatchResult> => {
    const lookup: Record<string, MatchResult> = {};
    if (!results?.matchdays) return lookup;

    results.matchdays.forEach((matchday) => {
        const date = matchday.date;
        matchday.matches.forEach(match => {
            const keys = collectMatchKeys(match.team1, match.team2, match.jornada, match.stage, date, match.group);
            keys.forEach(k => {
                if (!lookup[k]) {
                    lookup[k] = {
                        score1: match.score1,
                        score2: match.score2,
                        separator: match.separator
                    };
                }
            });
        });
    });

    return lookup;
};

export const isScoreValue = (value: ZioneResultMatch['score1']) => {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim();
    if (normalized.length === 0) return false;
    const normalizedLower = normalized.toLowerCase();
    if (SCORE_INVALID_TOKENS.has(normalizedLower)) return false;
    return /\d/.test(normalizedLower);
};

export const parseScore = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    const numericMatch = String(value).match(/-?\d+(?:\.\d+)?/);
    if (!numericMatch) return null;
    const parsed = Number(numericMatch[0]);
    return Number.isFinite(parsed) ? parsed : null;
};

export const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    return time.replace('hs', '').trim();
};

export const formatScore = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return String(value);
};
