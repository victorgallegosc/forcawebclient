import React, { useState, useEffect, useMemo } from 'react';
import ZioneClientFlow, {
    ModuleData,
    TablaParsed,
    ZioneSchedule,
    ZioneMatch,
    ZioneMatchday,
    ZioneScheduleTeams,
    ZioneScheduleTeam,
    ZioneResults,
    ZioneResultMatchday,
    ZioneResultMatch,
    ZioneTeam,
    ZioneScheduleMeta,
    TeamInfoResponse,
    ZioneTeamMatchSummary,
    ZioneStandingsRow,
    ZioneTeamRosterEntry,
    Torneo
} from '../../sdk/src';

const isScheduleData = (data: any): data is ZioneSchedule => !!data && Array.isArray(data.matchdays) && Array.isArray(data.headers);
const isResultsData = (data: any): data is ZioneResults => !!data && data.type === 'results';
const isModuleData = (data: any): data is ModuleData => !!data && Array.isArray(data.tables);

// Mapeo de módulo a endpoint real de Zione
// ...existing code...

type TeamClickContext = {
    scheduleMeta: ZioneScheduleMeta;
    match?: ZioneMatch;
    resultMatch?: ZioneResultMatch;
    matchdayDate?: string | null;
    source: 'schedule' | 'team-schedule' | 'results';
};

const getTeamIdFromHref = (href: string | null | undefined): string | null => {
    if (!href) return null;
    const match = href.match(/(?:[?&]e=)(\d+)/i);
    return match ? match[1] : null;
};

const getTeamId = (team: ZioneTeam | null | undefined): string | null => {
    if (!team) return null;
    if (team.id != null) return String(team.id);
    return getTeamIdFromHref(team.href);
};

const DEFAULT_DTS = 'DTS094';

type SummaryItem = {
    label: string;
    value: string;
    icon?: string;
};

type MatchResult = {
    score1: number | null;
    score2: number | null;
    separator?: string | null;
};

type TeamInfoState = {
    open: boolean;
    loading: boolean;
    team: ZioneTeam | null;
    context: TeamClickContext | null;
    data: TeamInfoResponse | null;
    error: string | null;
};

const SummaryBar: React.FC<{ items: SummaryItem[] }> = ({ items }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className="summary-bar" role="list">
            {items.map((item, index) => (
                <span key={`${item.label}-${index}`} className="summary-item" role="listitem">
                    {item.icon && <span className="summary-item-icon" aria-hidden>{item.icon}</span>}
                    <span className="summary-item-value">{item.value}</span>
                    <span className="summary-item-label">{item.label}</span>
                </span>
            ))}
        </div>
    );
};

const DataTable: React.FC<{ table: TablaParsed }> = ({ table }) => {
    if (!table || table.rows.length === 0) return <div className="empty-state">No data</div>;
    return (
        <div className="table-container">
            {/* El título de la tabla se muestra solo en GroupHeader, nunca aquí */}
            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>{table.headers.map((h, i) => (<th key={i}>{h}</th>))}</tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, ri) => (
                            <tr key={ri}>{table.headers.map((h, ci) => (<td key={ci}>{row[h] || ''}</td>))}</tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const TeamMatchesList: React.FC<{ title: string; items: ZioneTeamMatchSummary[] }> = ({ title, items }) => {
    if (!items || items.length === 0) return null;

    return (
        <section className="team-info-section">
            <h4 className="team-info-section-title">{title}</h4>
            <ul className="team-info-match-list">
                {items.map((item, index) => {
                    const key = `${item.opponentId ?? item.opponentName ?? 'match'}-${index}`;
                    return (
                        <li key={key} className="team-info-match-item">
                            <div className="team-info-match-primary">
                                <span className="team-info-match-opponent">{item.opponentName || 'Por definir'}</span>
                                {item.scoreText && <span className="team-info-match-score">{item.scoreText}</span>}
                            </div>
                            <div className="team-info-match-secondary">
                                {item.dateLabel && <span>{item.dateLabel}</span>}
                                {item.timeLabel && <span>{item.timeLabel}</span>}
                                {item.resultLabel && <span className="team-info-match-tag">{item.resultLabel}</span>}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

const ROSTER_FIELD_LABELS: Record<string, string> = {
    GOL: 'Goles',
    AGOL: 'Autogoles',
    PNAL: 'Penales',
    Amarilla: 'Amarillas',
    Roja: 'Rojas'
};

const RosterList: React.FC<{ table?: TablaParsed; roster?: ZioneTeamRosterEntry[] }> = ({ table, roster }) => {
    const rosterEntries: ZioneTeamRosterEntry[] | null = roster && roster.length > 0 ? roster : null;

    if (rosterEntries) {
        return (
            <section className="team-info-section">
                <h4 className="team-info-section-title">Roster</h4>
                <ul className="team-roster-list">
                    {rosterEntries.map((player, index) => (
                        <li key={`${player.name}-${index}`} className="team-roster-item">
                            <div className="team-roster-header">
                                <span className="team-roster-name">{player.name}</span>
                                <div className="team-roster-meta">
                                    {player.number && <span className="team-roster-number">#{player.number}</span>}
                                    {player.position && player.position !== '--' && (
                                        <span className="team-roster-position">{player.position}</span>
                                    )}
                                </div>
                            </div>
                            {!!player.stats.length && (
                                <div className="team-roster-stats">
                                    {player.stats.map(stat => (
                                        <div key={stat.label} className="team-roster-stat">
                                            <span className="team-roster-stat-label">{stat.label}</span>
                                            <span className="team-roster-stat-value">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        );
    }

    if (!table || !table.rows || table.rows.length === 0) return null;

    const rows: ZioneTeamRosterEntry[] = table.rows.map(row => {
        const rawName = row['Jugador'] || row['Jugador '] || row['Nombre'] || '';
        const cleanedName = rawName.replace(/[-―—]+/g, '').trim();
        const name = cleanedName || '';
        const number = (row['#'] || row['Número'] || '').toString().trim();
        const positionRaw = row['Posición'] || row['Posicion'] || '';
        const position = positionRaw && positionRaw !== '--' ? positionRaw : null;
        return {
            name,
            number: number && number !== '--' ? number : null,
            position,
            stats: Object.entries(ROSTER_FIELD_LABELS).map(([key, label]) => {
                const raw = (row[key] ?? '').toString().trim();
                const value = raw === '' || raw === '-' || raw === '—' ? '0' : raw;
                return { label, value };
            })
        };
    });

    const filtered = rows.filter(player => player.name && player.name !== '--');
    if (!filtered.length) return null;

    return (
        <section className="team-info-section">
            <h4 className="team-info-section-title">Roster</h4>
            <ul className="team-roster-list">
                {filtered.map((player, index) => (
                    <li key={`${player.name}-${index}`} className="team-roster-item">
                        <div className="team-roster-header">
                            <span className="team-roster-name">{player.name}</span>
                            <div className="team-roster-meta">
                                {player.number && <span className="team-roster-number">#{player.number}</span>}
                                {player.position && player.position !== '--' && (
                                    <span className="team-roster-position">{player.position}</span>
                                )}
                            </div>
                        </div>
                        <div className="team-roster-stats">
                            {player.stats.map(stat => (
                                <div key={stat.label} className="team-roster-stat">
                                    <span className="team-roster-stat-label">{stat.label}</span>
                                    <span className="team-roster-stat-value">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};

const TeamInfoDrawer: React.FC<{ state: TeamInfoState; onClose: () => void }> = ({ state, onClose }) => {
    const { open, loading, data, error, team } = state;
    const info = data?.team;
    const standings = data?.standings;
    const meta = info?.meta;

    if (!open && !loading) {
        return null;
    }

    const standingsLabels: Record<keyof ZioneStandingsRow, string> = {
        Lugar: 'Lugar',
        Equipo: 'Equipo',
        JJ: 'Juegos Jugados',
        JG: 'Juegos Ganados',
        JE: 'Empates',
        EG: 'Especiales Ganados',
        EP: 'Especiales Perdidos',
        JP: 'Juegos Perdidos',
        GF: 'Goles a Favor',
        GC: 'Goles en Contra',
        Dif: 'Diferencia de Goles',
        PA: 'Puntos Administrativos',
        Pts: 'Puntos Totales',
        idle: 'Sin jugar'
    };

    const standingsOrder: Array<keyof ZioneStandingsRow> = ['Lugar', 'JJ', 'JG', 'JE', 'JP', 'GF', 'GC', 'Dif', 'Pts'];

    const metrics = standings?.row
        ? standingsOrder
            .map(key => ({ label: standingsLabels[key], value: (standings.row as any)[key] }))
            .filter(item => item.value !== null && item.value !== undefined)
        : [];

    return (
        <div className={`team-info-overlay${open ? ' is-open' : ''}`}>
            <div className="team-info-backdrop" onClick={onClose} aria-hidden={!open} />
            <aside className="team-info-panel" role="dialog" aria-modal="true" aria-labelledby="team-info-title">
                <header className="team-info-header">
                    <div className="team-info-heading">
                        {meta?.shield && (
                            <img className="team-info-shield" src={meta.shield} alt="Escudo" />
                        )}
                        <div>
                            <h2 id="team-info-title" className="team-info-title">{meta?.name || team?.name || 'Equipo'}</h2>
                            <div className="team-info-subtitle" role="list">
                                {meta?.division && <span role="listitem">{meta.division}</span>}
                                {meta?.group && <span role="listitem">Grupo {meta.group}</span>}
                                {meta?.captain && <span role="listitem">Capitán: {meta.captain}</span>}
                            </div>
                        </div>
                    </div>
                    <button type="button" className="team-info-close" onClick={onClose} aria-label="Cerrar panel">
                        ×
                    </button>
                </header>
                <div className="team-info-content">
                    {loading && <div className="team-info-loading">Cargando información…</div>}
                    {!loading && error && <div className="team-info-error">{error}</div>}
                    {!loading && !error && info && (
                        <>
                            {metrics.length > 0 && (
                                <section className="team-info-section">
                                    <h4 className="team-info-section-title">Tabla General</h4>
                                    <dl className="team-info-metric-grid">
                                        {metrics.map(({ label, value }) => (
                                            <div key={label} className="team-info-metric">
                                                <dt className="team-info-metric-label">{label}</dt>
                                                <dd className="team-info-metric-value">{String(value)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </section>
                            )}

                            <TeamMatchesList title="Últimos encuentros" items={info.summary.lastMatches} />
                            <TeamMatchesList title="Próximos partidos" items={info.summary.nextMatches} />

                            {info.statsTable && info.statsTable.rows.length > 0 && (
                                <section className="team-info-section">
                                    <h4 className="team-info-section-title">Resumen</h4>
                                    <DataTable table={info.statsTable} />
                                </section>
                            )}

                            {((info.roster && info.roster.length > 0) || (info.rosterTable && info.rosterTable.rows.length > 0)) ? (
                                <RosterList table={info.rosterTable || undefined} roster={info.roster} />
                            ) : null}
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
};

const ModulePanel: React.FC<{
    title: string;
    data: any;
    onLoad: () => void;
    loading: boolean;
    moduleKey?: string;
    client: ZioneClientFlow;
    icon?: string;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}> = ({ title, data, onLoad, loading, moduleKey, client, icon, onTeamClick }) => {
    React.useEffect(() => { if (!data && !loading) onLoad(); }, [data, loading, onLoad]);

    const scheduleData = moduleKey === 'rol' && isScheduleData(data) ? data : null;
    const resultsData = moduleKey === 'resultados' && isResultsData(data) ? data : null;
    const tableData = !scheduleData && !resultsData && isModuleData(data) ? data : null;

    const showModuleHeader = !scheduleData && !resultsData;

    return (
        <section className={`module${showModuleHeader ? '' : ' module-no-header'}`}>
            {showModuleHeader && (
                <header className="module-header">
                    {icon && <img className="module-header-icon" src={icon} alt="" aria-hidden loading="lazy" />}
                    <span className="module-title">{title}</span>
                </header>
            )}
            <div className="module-content">
                {loading && <div className="loading">Cargando {title}...</div>}
                {!loading && !data && <div className="empty-state">No hay datos</div>}
                {!loading && scheduleData && (
                    <ScheduleRenderer
                        schedule={scheduleData}
                        client={client}
                        moduleLabel={title}
                        moduleIcon={icon}
                        onTeamClick={onTeamClick}
                    />
                )}
                {!loading && !scheduleData && resultsData && (
                    <ResultsRenderer
                        results={resultsData}
                        moduleLabel={title}
                        moduleIcon={icon}
                        onTeamClick={onTeamClick}
                    />
                )}
                {!loading && !scheduleData && !resultsData && tableData && (
                    <ModuleDataRenderer moduleKey={moduleKey || ''} data={tableData} />
                )}
                {!loading && data && !scheduleData && !resultsData && !tableData && (
                    <div className="empty-state">Formato de datos desconocido.</div>
                )}
            </div>
        </section>
    );
};

// Component that organizes and renders module data (groups + tables)
const GroupHeader: React.FC<{ title?: string; index?: number }> = ({ title, index }) => {
    if (!title) return null;
    return (
        <div className="group-header" aria-hidden>
            <div className="group-index">{typeof index === 'number' ? index + 1 : ''}</div>
            <div className="group-title">{title}</div>
        </div>
    );
};

// Tarjeta compacta para cada partido
const GameCard: React.FC<{
    match: ZioneMatch;
    dateLabel?: string | null;
    result?: MatchResult | null;
    onTeamClick?: (team: ZioneTeam, match: ZioneMatch) => void;
}> = ({ match, dateLabel, result, onTeamClick }) => {
    const statusText = match.status?.trim() || 'Sin estado';
    const statusKey = statusText.toLowerCase().includes('jugado')
        ? 'played'
        : statusText.toLowerCase().includes('pendiente')
            ? 'pending'
            : statusText.toLowerCase().includes('suspendido')
                ? 'suspended'
                : 'default';

    const formatTime = (time: string | null) => {
        if (!time) return '--:--';
        return time.replace('hs', '').trim();
    };

    const formatScore = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '—';
        return String(value);
    };

    const jornadaLabel = match.jornada?.label || (match.jornada?.number != null ? `Jornada ${match.jornada.number}` : 'Jornada por definir');
    const metaPills = [match.place, match.group, match.stage, jornadaLabel].filter(Boolean) as string[];
    const hasResult = statusKey === 'played' && !!result && (result.score1 != null || result.score2 != null);
    const resultSeparator = (result?.separator?.trim() || '-').replace(/\s+/g, ' ');
    const resultAnnounce = hasResult
        ? `Marcador: ${match.team1?.name || 'Equipo 1'} ${formatScore(result?.score1)} ${resultSeparator} ${match.team2?.name || 'Equipo 2'} ${formatScore(result?.score2)}`
        : null;

    const renderTeamRow = (team: ZioneTeam, scoreValue: number | null | undefined, extraClass?: string) => {
        const label = team?.name || 'Equipo';
        const handleClick = () => {
            if (onTeamClick) {
                onTeamClick(team, match);
            }
        };

        const content = onTeamClick ? (
            <button type="button" className="team-link team-name" onClick={handleClick}>
                {label}
            </button>
        ) : (
            <span className="team-name">{label}</span>
        );

        return (
            <div className={`match-team-row${extraClass ? ` ${extraClass}` : ''}`}>
                {content}
                {hasResult && <span className="team-score">{formatScore(scoreValue)}</span>}
            </div>
        );
    };

    return (
        <article className={`match-card match-${statusKey}`}>
            <div className="match-card-header">
                <div className="match-time">
                    <span className="match-hour">{formatTime(match.time)}</span>
                    {dateLabel && <span className="match-date">{dateLabel}</span>}
                </div>
                <span className={`match-status match-status-${statusKey}`}>{statusText}</span>
            </div>
            <div className="match-body">
                <div
                    className={`match-teams${hasResult ? ' match-teams--with-score' : ''}`}
                    role={hasResult ? 'group' : undefined}
                    aria-label={resultAnnounce || undefined}
                >
                    {renderTeamRow(match.team1, result?.score1)}
                    {renderTeamRow(match.team2, result?.score2, 'match-team-row-away')}
                </div>
                <div className="match-meta">
                    {metaPills.map((value, index) => (
                        <span key={`${value}-${index}`} className="meta-pill">{value}</span>
                    ))}
                </div>
            </div>
        </article>
    );
};

const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatIsoToLabel = (iso: string | null | undefined) => {
    if (!iso) return null;
    const [year, month, day] = iso.split('-');
    const monthIndex = Number(month) - 1;
    const monthLabel = MONTH_ABBR[monthIndex] || month;
    return `${day}-${monthLabel}-${year}`;
};

const normalizeTextKey = (value?: string | null) => {
    if (!value) return '';
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
};

const normalizeTeamKey = (team?: ZioneMatch['team1']) => {
    if (!team) return 'team:none';
    if (team.id != null) return `team:${team.id}`;
    const nameKey = normalizeTextKey(team.name);
    return nameKey ? `name:${nameKey}` : 'team:none';
};

const normalizeJornadaKey = (jornada?: ZioneMatch['jornada']) => {
    if (!jornada) return 'j:none';
    if (jornada.number != null) return `jn:${jornada.number}`;
    const labelKey = normalizeTextKey(jornada.label);
    return labelKey ? `jl:${labelKey}` : 'j:none';
};

const createMatchKey = (
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

const collectMatchKeys = (
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

const buildResultLookup = (results: ZioneResults | null | undefined): Record<string, MatchResult> => {
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

const TeamsByClub: React.FC<{
    data: ZioneScheduleTeams;
    onSelect: (team: ZioneScheduleTeam) => void;
    activeTeamId: number | null;
    loadingTeamId: number | null;
}> = ({ data, onSelect, activeTeamId, loadingTeamId }) => {
    const teams = data?.teams || [];
    if (!teams.length) return null;

    const selectedIndex = activeTeamId != null
        ? teams.findIndex(team => team.id === activeTeamId)
        : -1;

    const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = event.target;
        if (value === '') {
            return;
        }

        const index = Number(value);
        const team = teams[index];
        if (!team) return;

        const disabled = (team.id == null && !team.href);
        if (!disabled) {
            onSelect(team);
        }
    };

    return (
        <section className="schedule-team-section">
            <header className="team-section-header">
                <h3 className="team-section-title">Rol por Equipo</h3>
            </header>
            <div className="team-picker-mobile" data-label="Picker">
                <label htmlFor="team-picker" className="team-picker-label">Elegir equipo</label>
                <div className="team-picker-control">
                    <select
                        id="team-picker"
                        className="team-picker-select"
                        value={selectedIndex >= 0 ? String(selectedIndex) : ''}
                        onChange={handleSelectChange}
                        disabled={teams.length === 0}
                    >
                        <option value="" disabled>Selecciona un equipo</option>
                        {teams.map((team, index) => {
                            const disabled = team.id == null && !team.href;
                            return (
                                <option key={`${team.id ?? team.name}-${index}`} value={String(index)} disabled={disabled}>
                                    {team.name}
                                </option>
                            );
                        })}
                    </select>
                    {loadingTeamId != null && selectedIndex >= 0 && teams[selectedIndex]?.id === loadingTeamId && (
                        <span className="team-picker-status">Cargando…</span>
                    )}
                </div>
            </div>
            <div className="team-card-grid">
                {teams.map(team => {
                    const metaParts = [team.group, team.division].filter(Boolean);
                    const teamId = team.id ?? null;
                    const isActive = teamId !== null && teamId === activeTeamId;
                    const isLoading = teamId !== null && teamId === loadingTeamId;
                    const disabled = teamId === null && !team.href;

                    return (
                        <button
                            key={`${team.id ?? team.name}`}
                            type="button"
                            className={`team-card${isActive ? ' is-active' : ''}${disabled ? ' team-card-disabled' : ''}`}
                            onClick={() => !disabled && onSelect(team)}
                            disabled={disabled || isLoading}
                        >
                            <span className="team-card-name">{team.name}</span>
                            {metaParts.length > 0 && (
                                <span className="team-card-meta">{metaParts.join(' · ')}</span>
                            )}
                            <span className="team-card-link">{isLoading ? 'Cargando…' : 'Ver partidos'}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

const ResultCard: React.FC<{
    match: ZioneResultMatch;
    dateLabel?: string | null;
    onTeamClick?: (team: ZioneTeam, match: ZioneResultMatch) => void;
}> = ({ match, dateLabel, onTeamClick }) => {
    const formatTime = (time: string | null) => {
        if (!time) return '--:--';
        return time.replace('hs', '').trim();
    };

    const parseScore = (value: string | number | null | undefined): number | null => {
        if (value === null || value === undefined) return null;
        const numericMatch = String(value).match(/-?\d+(?:\.\d+)?/);
        if (!numericMatch) return null;
        const parsed = Number(numericMatch[0]);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const statusKey = match.status ? match.status.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'default';
    const score1 = parseScore(match.score1);
    const score2 = parseScore(match.score2);
    const hasWinner = score1 != null && score2 != null && score1 !== score2;
    const team1Won = hasWinner ? (score1 as number) > (score2 as number) : false;
    const team2Won = hasWinner ? (score2 as number) > (score1 as number) : false;

    const team1ClassName = ['result-team', team1Won ? 'result-team--winner' : '', team2Won ? 'result-team--muted' : '']
        .filter(Boolean)
        .join(' ');
    const team2ClassName = ['result-team', 'result-team-away', team2Won ? 'result-team--winner' : '', team1Won ? 'result-team--muted' : '']
        .filter(Boolean)
        .join(' ');
    const scoreLeftClassName = ['score-value', team1Won ? 'score-value--winner' : '', team2Won ? 'score-value--muted' : '']
        .filter(Boolean)
        .join(' ');
    const scoreRightClassName = ['score-value', team2Won ? 'score-value--winner' : '', team1Won ? 'score-value--muted' : '']
        .filter(Boolean)
        .join(' ');
    const scoreDivider = match.separator?.trim() || 'vs';
    const scoreboardLabel = `Marcador: ${match.team1?.name || 'Equipo 1'} ${match.score1 ?? '—'} ${scoreDivider} ${match.team2?.name || 'Equipo 2'} ${match.score2 ?? '—'}`;

    const renderTeamName = (team: ZioneTeam, className: string) => {
        const label = team?.name || 'Equipo';
        if (!onTeamClick) {
            return <span className="team-name">{label}</span>;
        }
        const handleClick = () => onTeamClick(team, match);
        return (
            <button type="button" className={`team-link team-name ${className}`} onClick={handleClick}>
                {label}
            </button>
        );
    };

    return (
        <article className={`result-card result-${statusKey}`}>
            <div className="result-card-header">
                <div className="result-card-time">
                    <span className="result-time">{formatTime(match.time)}</span>
                    {dateLabel && <span className="result-date">{dateLabel}</span>}
                </div>
                {match.status && <span className="result-status">{match.status}</span>}
            </div>
            <div className="result-card-body">
                <div className={team1ClassName}>{renderTeamName(match.team1, '')}</div>
                <div
                    className="result-scoreboard"
                    role="group"
                    aria-label={scoreboardLabel}
                >
                    <span className={scoreLeftClassName}>{match.score1 ?? '—'}</span>
                    <span className="score-divider" aria-hidden>{scoreDivider}</span>
                    <span className={scoreRightClassName}>{match.score2 ?? '—'}</span>
                </div>
                <div className={team2ClassName}>{renderTeamName(match.team2, 'result-team-link')}</div>
            </div>
            <div className="result-meta">
                <span>{(match.group || 'Sin grupo') + ' - '}</span>
                <span>{('Etapa ' + (match.stage || 'desconocida') + ' - ')}</span>
                <span>{match.jornada?.label || 'Jornada'}</span>
            </div>
        </article>
    );
};

const ResultsRenderer: React.FC<{
    results: ZioneResults;
    moduleLabel: string;
    moduleIcon?: string;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}> = ({ results, moduleLabel, moduleIcon, onTeamClick }) => {
    const { meta, matchdays, summary } = results;

    const hasMatchdays = Array.isArray(matchdays) && matchdays.length > 0;
    const totalResults = summary?.total_results ?? (hasMatchdays ? matchdays.reduce((acc, md) => acc + md.matches.length, 0) : 0);
    const weekInfo = meta.week;
    const weekRange = weekInfo?.raw_range || null;
    const startLabel = weekInfo?.start_date ? formatIsoToLabel(weekInfo.start_date) : null;
    const endLabel = weekInfo?.end_date ? formatIsoToLabel(weekInfo.end_date) : null;
    const summaryItems: SummaryItem[] = [];

    if (totalResults > 0) summaryItems.push({ label: 'Resultados', value: String(totalResults), icon: '⚽' });
    if (hasMatchdays) summaryItems.push({ label: 'Jornadas', value: String(matchdays.length), icon: '📆' });

    const rangeDisplay = (startLabel || endLabel)
        ? `${startLabel || 'Por definir'}${endLabel ? ` – ${endLabel}` : ''}`
        : weekRange || null;
    const contextTitle = weekInfo?.label || meta.title || moduleLabel;
    const contextSubtitle = rangeDisplay || meta.subtitle || null;
    const secondarySubtitle = meta.subtitle && meta.subtitle !== contextSubtitle ? meta.subtitle : null;

    return (
        <div className="schedule-container">
            <section className="schedule-meta">
                <div className="schedule-header">
                    {moduleIcon && (
                        <img className="schedule-header-icon" src={moduleIcon} alt="" aria-hidden loading="lazy" />
                    )}
                    <div className="schedule-header-titles">
                        <span className="schedule-header-label">{moduleLabel}</span>
                        <h2 className="schedule-title">{contextTitle}</h2>
                        {contextSubtitle && <p className="schedule-subtitle">{contextSubtitle}</p>}
                        {secondarySubtitle && <p className="schedule-subtitle schedule-subtitle-alt">{secondarySubtitle}</p>}
                    </div>
                </div>
            </section>

            <SummaryBar items={summaryItems} />

            {hasMatchdays ? (
                matchdays.map((matchday: ZioneResultMatchday, index: number) => {
                    const headerLabel = matchday.label || formatIsoToLabel(matchday.date) || 'Sin fecha';
                    const cardDate = matchday.date ? formatIsoToLabel(matchday.date) : matchday.label;
                    return (
                        <section key={`${headerLabel}-${index}`} className="schedule-matchday">
                            <header className="matchday-header">
                                <span className="matchday-date">{headerLabel}</span>
                            </header>
                            <div className="matchday-grid">
                                {matchday.matches.map((match: ZioneResultMatch, matchIndex: number) => (
                                    <ResultCard
                                        key={matchIndex}
                                        match={match}
                                        dateLabel={cardDate}
                                        onTeamClick={teamItem => {
                                            if (!onTeamClick) return;
                                            onTeamClick(teamItem, {
                                                scheduleMeta: meta,
                                                resultMatch: match,
                                                matchdayDate: matchday.date || null,
                                                source: 'results'
                                            });
                                        }}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            ) : (
                <div className="empty-state">No hay resultados disponibles.</div>
            )}
        </div>
    );
};

// Componente específico para renderizar el Rol de Juegos con el JSON estructurado
const ScheduleRenderer: React.FC<{
    schedule: ZioneSchedule;
    client: ZioneClientFlow;
    moduleLabel: string;
    moduleIcon?: string;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}> = ({ schedule, client, moduleLabel, moduleIcon, onTeamClick }) => {
    const { meta, matchdays, rest, summary } = schedule;

    const hasMatchdays = Array.isArray(matchdays) && matchdays.length > 0;
    const totalMatches = summary?.total_matches ?? (hasMatchdays ? matchdays.reduce((acc, md) => acc + md.matches.length, 0) : 0);
    const weekInfo = meta.week;
    const weekRange = weekInfo?.raw_range || null;
    const startLabel = weekInfo?.start_date ? formatIsoToLabel(weekInfo.start_date) : null;
    const endLabel = weekInfo?.end_date ? formatIsoToLabel(weekInfo.end_date) : null;
    const teamsByClub = schedule.teamsByClub;
    const [resultLookup, setResultLookup] = useState<Record<string, MatchResult>>({});
    const resultsRequestKey = React.useRef<string | null>(null);
    const summaryItems: SummaryItem[] = [];

    if (totalMatches > 0) summaryItems.push({ label: 'Partidos', value: String(totalMatches), icon: '⚽' });
    if (hasMatchdays) summaryItems.push({ label: 'Jornadas', value: String(matchdays.length), icon: '📆' });
    if (teamsByClub?.total) summaryItems.push({ label: 'Equipos', value: String(teamsByClub.total), icon: '👥' });

    const rangeDisplay = (startLabel || endLabel)
        ? `${startLabel || 'Sin definir'}${endLabel ? ` – ${endLabel}` : ''}`
        : weekRange || null;
    const contextTitle = weekInfo?.label || meta.title || moduleLabel;
    const contextSubtitle = rangeDisplay || meta.subtitle || null;
    const secondarySubtitle = meta.subtitle && meta.subtitle !== contextSubtitle ? meta.subtitle : null;

    const hasPlayedMatches = React.useMemo(() => {
        if (!hasMatchdays) return false;
        return matchdays.some(md => md.matches.some(m => m.status?.toLowerCase().includes('jugado')));
    }, [hasMatchdays, matchdays]);

    const ids = meta?.ids || { dts: null, torID: null, divID: null, gpoID: null };
    const dtsId = ids.dts;
    const torId = ids.torID;
    const divId = ids.divID;
    const groupId = ids.gpoID;

    useEffect(() => {
        if (!hasPlayedMatches) {
            setResultLookup({});
            resultsRequestKey.current = null;
            return;
        }

        if (!dtsId || !torId || !divId) {
            return;
        }

        const requestKey = [dtsId, torId, divId, groupId || ''].join('|');
        if (resultsRequestKey.current === requestKey) {
            return;
        }

        let cancelled = false;
        resultsRequestKey.current = requestKey;

        (async () => {
            try {
                const fetched = await client.getResultados(dtsId, torId, divId, groupId || undefined, { m: '2', smodo: '0' });
                if (cancelled) return;
                setResultLookup(buildResultLookup(fetched));
            } catch (err) {
                if (cancelled) return;
                console.error('[Rol] No se pudieron obtener resultados para enriquecer el rol:', err);
                setResultLookup({});
                resultsRequestKey.current = null;
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [client, dtsId, torId, divId, groupId, hasPlayedMatches]);

    const resolveResult = React.useCallback((match: ZioneMatch, date?: string | null): MatchResult | null => {
        const keys = collectMatchKeys(match.team1, match.team2, match.jornada, match.stage, date || null, match.group);
        for (const key of keys) {
            const found = resultLookup[key];
            if (found) return found;
        }
        return null;
    }, [resultLookup]);

    useEffect(() => {
        setResultLookup({});
        resultsRequestKey.current = null;
    }, [schedule.meta.source_url]);

    const [teamState, setTeamState] = useState<{
        team: ZioneScheduleTeam | null;
        data: ZioneSchedule | null;
        loading: boolean;
        error: string | null;
    }>({ team: null, data: null, loading: false, error: null });

    useEffect(() => {
        setTeamState({ team: null, data: null, loading: false, error: null });
    }, [schedule.meta.source_url]);

    const extractTeamId = (team: ZioneScheduleTeam): string | null => {
        if (team.id != null) return String(team.id);
        if (team.href) {
            const match = team.href.match(/[?&]e=(\d+)/);
            if (match) return match[1];
        }
        return null;
    };

    const handleTeamSelect = async (team: ZioneScheduleTeam) => {
        const ids = meta.ids;
        const dts = ids?.dts;
        const torID = ids?.torID;
        const divID = ids?.divID;
        const gpoID = ids?.gpoID;
        const teamId = extractTeamId(team);

        if (!dts || !torID || !divID || !teamId) {
            setTeamState({ team, data: null, loading: false, error: 'No se pudo identificar al equipo.' });
            return;
        }

        if (teamState.team?.id === team.id && !teamState.loading) {
            // Toggle selection
            setTeamState({ team: null, data: null, loading: false, error: null });
            return;
        }

        setTeamState({ team, data: null, loading: true, error: null });

        try {
            const teamSchedule = await client.getRolPorEquipo(dts, teamId, torID, divID, gpoID || undefined, { v: '2' });
            setTeamState({ team, data: teamSchedule, loading: false, error: null });
        } catch (err) {
            setTeamState({ team, data: null, loading: false, error: err instanceof Error ? err.message : 'No se pudo cargar el rol del equipo' });
        }
    };

    return (
        <div className="schedule-container">
            <section className="schedule-meta">
                <div className="schedule-header">
                    {moduleIcon && (
                        <img className="schedule-header-icon" src={moduleIcon} alt="" aria-hidden loading="lazy" />
                    )}
                    <div className="schedule-header-titles">
                        <span className="schedule-header-label">{moduleLabel}</span>
                        <h2 className="schedule-title">{contextTitle}</h2>
                        {contextSubtitle && <p className="schedule-subtitle">{contextSubtitle}</p>}
                        {secondarySubtitle && <p className="schedule-subtitle schedule-subtitle-alt">{secondarySubtitle}</p>}
                    </div>
                </div>
            </section>

            {teamsByClub && teamsByClub.teams?.length > 0 && (
                <>
                    <TeamsByClub
                        data={teamsByClub}
                        onSelect={handleTeamSelect}
                        activeTeamId={teamState.team?.id ?? null}
                        loadingTeamId={teamState.loading ? teamState.team?.id ?? null : null}
                    />
                    {teamState.team && (
                        <section className="team-schedule-view">
                            <header className="team-schedule-header">
                                <div>
                                    <h4 className="team-schedule-title">{teamState.team.name}</h4>
                                    {teamState.team.group && (
                                        <p className="team-schedule-meta">{teamState.team.group}{teamState.team.division ? ` · ${teamState.team.division}` : ''}</p>
                                    )}
                                </div>
                                {teamState.loading && <span className="team-schedule-status">Cargando…</span>}
                            </header>
                            {teamState.error && <div className="team-schedule-error">{teamState.error}</div>}
                            {!teamState.loading && !teamState.error && teamState.data && teamState.data.matchdays.length === 0 && (
                                <div className="team-schedule-empty">No hay partidos programados para este equipo.</div>
                            )}
                            {!teamState.loading && !teamState.error && teamState.data && teamState.data.matchdays.length > 0 && (
                                <div className="team-schedule-matchdays">
                                    {teamState.data.matchdays.map((md, idx) => {
                                        const headerLabel = md.label || formatIsoToLabel(md.date) || 'Sin fecha';
                                        const cardDate = md.date ? formatIsoToLabel(md.date) : md.label;
                                        return (
                                            <div key={`${headerLabel}-${idx}`} className="team-schedule-matchday">
                                                <div className="team-schedule-matchday-header">
                                                    <span className="team-schedule-matchday-title">{headerLabel}</span>
                                                    <span className="team-schedule-matchday-count">{md.matches.length} partidos</span>
                                                </div>
                                                <div className="team-schedule-matchday-grid">
                                                    {md.matches.map((match, matchIdx) => (
                                                        <GameCard
                                                            key={matchIdx}
                                                            match={match}
                                                            dateLabel={cardDate}
                                                            result={resolveResult(match, md.date)}
                                                            onTeamClick={teamItem => {
                                                                if (!onTeamClick) return;
                                                                const scheduleMeta = teamState.data?.meta || meta;
                                                                onTeamClick(teamItem, {
                                                                    scheduleMeta,
                                                                    match,
                                                                    matchdayDate: md.date || null,
                                                                    source: 'team-schedule'
                                                                });
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}

            {hasMatchdays ? (
                matchdays.map((matchday: ZioneMatchday, index: number) => {
                    const headerLabel = matchday.label || formatIsoToLabel(matchday.date) || 'Sin fecha';
                    const cardDate = matchday.date ? formatIsoToLabel(matchday.date) : matchday.label;
                    return (
                        <section key={`${headerLabel}-${index}`} className="schedule-matchday">
                            <header className="matchday-header">
                                <span className="matchday-date">{headerLabel}</span>
                            </header>
                            <div className="matchday-grid">
                                {matchday.matches.map((match: ZioneMatch, matchIndex: number) => (
                                    <GameCard
                                        key={matchIndex}
                                        match={match}
                                        dateLabel={cardDate}
                                        result={resolveResult(match, matchday.date)}
                                        onTeamClick={teamItem => {
                                            if (!onTeamClick) return;
                                            onTeamClick(teamItem, {
                                                scheduleMeta: meta,
                                                match,
                                                matchdayDate: matchday.date || null,
                                                source: 'schedule'
                                            });
                                        }}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            ) : (
                <div className="empty-state">No hay partidos programados.</div>
            )}

            {rest && rest.length > 0 && (
                <div className="schedule-rest">
                    <span className="rest-label">Descansan</span>
                    <span className="rest-teams">{rest.map(team => team.name).join(', ')}</span>
                </div>
            )}
        </div>
    );
};

const ModuleDataRenderer: React.FC<{ moduleKey: string; data: ModuleData }> = ({ moduleKey, data }) => {
    const groups = organizeModuleData(moduleKey, data);
    return (
        <div>
            {groups.map((g, gi) => {
                // Mostrar siempre el meta.title de la tabla como título de grupo
                // Always use meta.title if present, fallback to group title otherwise
                let displayTitle = (g.tables.length > 0 && g.tables[0].meta && g.tables[0].meta.title)
                    ? g.tables[0].meta.title
                    : (g.title || '');
                return (
                    <div key={gi} className="module-group">
                        <GroupHeader title={displayTitle} index={gi} />
                        <div className="group-tables">
                            {g.tables.map((t, ti) => <DataTable key={ti} table={t} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Organize module data into groups by jornada/fecha/grupo when possible
function organizeModuleData(moduleKey: string, moduleData: ModuleData) {
    // Default: each table as its own group with no title
    if (!moduleData || !moduleData.tables || moduleData.tables.length === 0) return [] as { title?: string; tables: ModuleData['tables'] }[];

    // Try to detect common grouping fields in rows: 'jornada', 'fecha', 'grupo'
    if (moduleKey === 'resultados') {
        // group by jornada if present
        const map = new Map<string, TablaParsed[]>();
        moduleData.tables.forEach(tbl => {
            tbl.rows.forEach((r) => {
                const key = (r['jornada'] || r['Jornada'] || r['fecha'] || r['Fecha'] || 'General').toString();
                const copy: TablaParsed = { ...tbl, rows: [r] } as TablaParsed;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(copy);
            });
        });
        const out: { title?: string; tables: TablaParsed[] }[] = [];
        for (const [k, v] of map.entries()) out.push({ title: k, tables: v });
        return out;
    }

    if (moduleKey === 'posiciones' || moduleKey === 'goleo') {
        // The parser may emit special rows like { Grupo: 'Grupo 4 A' } as separators.
        // We'll iterate tables and split rows into groups when we detect these separator rows.
        const out: { title?: string; tables: TablaParsed[] }[] = [];
        moduleData.tables.forEach(tbl => {
            // initialize current group from table meta title when available
            let currentTitle = (tbl.meta && tbl.meta.title) ? tbl.meta.title : 'General';
            let currentTable: TablaParsed = { ...tbl, rows: [] } as TablaParsed;

            const pushCurrent = () => {
                // skip empty group (no rows)
                if (currentTable.rows.length > 0) {
                    out.push({ title: currentTitle, tables: [currentTable] });
                }
            };

            tbl.rows.forEach(r => {
                // detect group separator produced by parser
                const keys = Object.keys(r || {});
                if (keys.length === 1 && (keys[0].toLowerCase() === 'grupo' || keys[0] === 'Grupo')) {
                    // push previous group and start new one
                    pushCurrent();
                    currentTitle = (r[keys[0]] || 'General').toString();
                    // filter out footer-like groups
                    const low = currentTitle.toLowerCase();
                    if (low.includes('tabla posiciones') || (low.includes('tabla') && low.includes('etapa'))) {
                        // ignore as group title (likely footer) - revert to meta title if present
                        currentTitle = (tbl.meta && tbl.meta.title) ? tbl.meta.title : 'General';
                    }
                    currentTable = { ...tbl, rows: [] } as TablaParsed;
                } else {
                    // normal data row: append to current table
                    currentTable.rows.push(r);
                }
            });

            // push last group
            pushCurrent();
        });
        return out;
    }

    if (moduleKey === 'rol') {
        // group by fecha or jornada
        const map = new Map<string, TablaParsed[]>();
        moduleData.tables.forEach(tbl => {
            tbl.rows.forEach(r => {
                const key = (r['fecha'] || r['Fecha'] || r['jornada'] || r['Jornada'] || 'General').toString();
                const copy: TablaParsed = { ...tbl, rows: [r] } as TablaParsed;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(copy);
            });
        });
        const out: { title?: string; tables: TablaParsed[] }[] = [];
        for (const [k, v] of map.entries()) out.push({ title: k, tables: v });
        return out;
    }

    // fallback: return each table as a group
    return moduleData.tables.map(t => ({ title: t.meta.title || undefined, tables: [t] }));
}

export default function App() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const apiBaseFromEnv = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
    const [, setTorneos] = useState<Torneo[]>([]);
    const [selectedTorneo, setSelectedTorneo] = useState<string>('');
    const [, setTorneosLoading] = useState<boolean>(false);
    const [datos, setDatos] = useState<Record<string, any>>({});
    const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({});
    const [error, setError] = useState('');
    const [selectedModule, setSelectedModule] = useState<string>('posiciones');
    const client = useMemo(() => new ZioneClientFlow(apiBaseFromEnv || undefined), [apiBaseFromEnv]);
    const [teamInfoState, setTeamInfoState] = useState<TeamInfoState>({
        open: false,
        loading: false,
        team: null,
        context: null,
        data: null,
        error: null
    });

    const closeTeamInfo = React.useCallback(() => {
        setTeamInfoState(prev => ({ ...prev, open: false }));
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (matches: boolean) => setTheme(matches ? 'dark' as const : 'light' as const);

        apply(media.matches);
        const listener = (event: MediaQueryListEvent) => apply(event.matches);
        media.addEventListener('change', listener);

        return () => media.removeEventListener('change', listener);
    }, []);

    useEffect(() => {
        const loadTorneos = async () => {
            setTorneosLoading(true);
            try {
                const response = await client.getTorneos('DTS094');
                setTorneos(response.torneos);
                const preselected = response.torneos.find(t => t.selected) || response.torneos[0];
                if (preselected) {
                    setSelectedTorneo(preselected.torID);
                }
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setError(message);
            } finally {
                setTorneosLoading(false);
            }
        };

        loadTorneos();
    }, [client]);

    useEffect(() => {
        if (!selectedTorneo) return;
        setDatos({});
        setLoadingModules({});
        setError('');
    }, [selectedTorneo]);

    const moduleNames: Record<string, string> = {
        posiciones: 'Tabla',
        rol: 'Rol',
        resultados: 'Resultados',
        goleo: 'Goleo'
    };

    // Small icons (emoji for simplicity) -- can be swapped for SVGs later
    const moduleIcons: Record<string, string> = {
        posiciones: 'https://img.icons8.com/?size=100&id=6yiQUAER3NXc&format=png&color=000000',
        rol: 'https://img.icons8.com/?size=100&id=m9vqEcBYERYl&format=png&color=000000',
        resultados: 'https://img.icons8.com/?size=100&id=74722&format=png&color=000000',
        goleo: 'https://img.icons8.com/?size=100&id=107644&format=png&color=000000'
    };

    const handleTeamInfoRequest = React.useCallback(async (team: ZioneTeam, context: TeamClickContext) => {
        const teamId = getTeamId(team);
        if (!teamId) {
            setTeamInfoState({
                open: true,
                loading: false,
                team,
                context,
                data: null,
                error: 'No se pudo identificar al equipo.'
            });
            return;
        }

        const scheduleMeta = context.scheduleMeta;
        const dtsValue = scheduleMeta?.ids?.dts || DEFAULT_DTS;

        setTeamInfoState({
            open: true,
            loading: true,
            team,
            context,
            data: null,
            error: null
        });

        try {
            const response = await client.getTeamInfo(dtsValue, teamId, {
                torID: scheduleMeta?.ids?.torID || undefined,
                divID: scheduleMeta?.ids?.divID || undefined,
                gpoID: scheduleMeta?.ids?.gpoID || undefined
            });

            console.log('Team info response:', response);

            setTeamInfoState(prev => ({
                ...prev,
                loading: false,
                data: response,
                error: null
            }));
        } catch (teamError) {
            const message = teamError instanceof Error
                ? teamError.message
                : 'No se pudo cargar la información del equipo.';
            setTeamInfoState(prev => ({
                ...prev,
                loading: false,
                error: message
            }));
        }
    }, [client]);

    const handleLoadModule = async (module: string) => {
        setLoadingModules(prev => ({ ...prev, [module]: true }));
        setError('');
        const torneo = '32361';
        const division = '8555';
        const grupo = '16960';

        try {
            if (module === 'rol') {
                const schedule = await client.getRolJuegos('DTS094', torneo, division, grupo, { v: '1' });
                setDatos(prev => ({ ...prev, [module]: schedule }));
            } else if (module === 'resultados') {
                const resultados = await client.getResultados('DTS094', torneo, division, grupo, { m: '2', smodo: '0' });
                setDatos(prev => ({ ...prev, [module]: resultados }));
            } else {
                let params: Record<string, string> = { module };
                if (module === 'goleo') {
                    params = { module, gpoID: grupo };
                }
                const resp = await client.getDatos('DTS094', torneo, division, grupo, params);
                if (resp?.data) {
                    setDatos(prev => ({ ...prev, [module]: resp.data }));
                }
            }
        } catch (e) {
            setError(String(e));
        }

        setLoadingModules(prev => ({ ...prev, [module]: false }));
    };

    const renderTabs = (placement: 'top' | 'bottom') => (
        <nav className={`app-tabs app-tabs-${placement}`} role="tablist" aria-label="Módulos">
            {Object.entries(moduleNames).map(([key, title]) => (
                <button
                    key={`${placement}-${key}`}
                    role="tab"
                    aria-selected={selectedModule === key}
                    tabIndex={selectedModule === key ? 0 : -1}
                    className={`tab-button${selectedModule === key ? ' is-active' : ''}`}
                    aria-label={title}
                    title={title}
                    onClick={async () => {
                        setSelectedModule(key);
                        if (!datos[key]) await handleLoadModule(key);
                    }}
                >
                    <img
                        className="tab-icon-img"
                        src={moduleIcons[key]}
                        alt=""
                        aria-hidden
                        loading="lazy"
                    />
                    <span className="tab-label">{title}</span>
                </button>
            ))}
        </nav>
    );

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-header__info">
                    <span className="brand-mark" aria-hidden>🏆</span>
                    <div>
                        <h1 className="app-title">Estadísticas Forca</h1>
                        <p className="app-subtitle">Vista rápida del torneo</p>
                    </div>
                </div>
                <button
                    className="header-action"
                    onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                    aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
            </header>

            {renderTabs('top')}

            <main className="app-main">
                {error && <div className="app-alert" role="alert">{error}</div>}
                <ModulePanel
                    title={moduleNames[selectedModule]}
                    data={datos[selectedModule] ?? null}
                    onLoad={() => handleLoadModule(selectedModule)}
                    loading={!!loadingModules[selectedModule]}
                    moduleKey={selectedModule}
                    client={client}
                    icon={moduleIcons[selectedModule]}
                    onTeamClick={handleTeamInfoRequest}
                />
            </main>

            <TeamInfoDrawer state={teamInfoState} onClose={closeTeamInfo} />

            {renderTabs('bottom')}
        </div>
    );
}
