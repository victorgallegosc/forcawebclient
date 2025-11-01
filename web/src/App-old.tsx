import React, { useState, useEffect, useMemo } from 'react';
import ZioneClientFlow, {
    ModuleData,
    TablaParsed,
    ZioneSchedule,
    ZioneMatch,
    ZioneMatchday,
    ZioneScheduleTeam,
    ZioneResults,
    ZioneResultMatchday,
    ZioneResultMatch,
    ZioneTeam,
    ZioneScheduleMeta,
    TeamInfoResponse,
    ZioneTeamMatchSummary,
    ZioneStandings,
    ZioneStandingsRow,
    ZioneTeamRosterEntry,
    Torneo
} from '../../sdk/src';

const isScheduleData = (data: any): data is ZioneSchedule => !!data && Array.isArray(data.matchdays) && Array.isArray(data.headers);
const isResultsData = (data: any): data is ZioneResults => !!data && data.type === 'results';
const isStandingsData = (data: any): data is ZioneStandings => {
    if (!data || !Array.isArray(data.groups)) return false;
    if (!Array.isArray(data.headers)) return false;
    return data.groups.every((group: any) => Array.isArray(group.rows));
};
const isModuleData = (data: any): data is ModuleData => !!data && Array.isArray(data.tables);

// Mapeo de módulo a endpoint real de Zione
// ...existing code...

type TeamClickContext = {
    scheduleMeta: ZioneScheduleMeta;
    match?: ZioneMatch;
    resultMatch?: ZioneResultMatch;
    matchdayDate?: string | null;
    standingsGroup?: string | null;
    standingsRow?: ZioneStandingsRow;
    source: 'schedule' | 'team-schedule' | 'results' | 'standings';
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
};

const STANDINGS_HEADER_KEY_MAP: Partial<Record<string, keyof ZioneStandingsRow>> = {
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

const StandingsRenderer: React.FC<{
    standings: ZioneStandings;
    moduleLabel: string;
    moduleIcon?: string;
    matchdayMatches?: ZioneResultMatch[] | null;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}> = ({ standings, moduleLabel, moduleIcon, matchdayMatches, onTeamClick }) => {
    const { meta, headers, groups } = standings;
    const totalTeams = groups.reduce((acc, group) => acc + (group.rows?.length || 0), 0);
    const summaryItems: SummaryItem[] = [];
    if (totalTeams > 0) summaryItems.push({ label: 'Equipos', value: String(totalTeams), icon: '👥' });
    if (groups.length > 1) summaryItems.push({ label: 'Grupos', value: String(groups.length), icon: '📊' });
    if (meta.etapa) summaryItems.push({ label: 'Etapa', value: meta.etapa, icon: '🏁' });

    const scheduleMetaEquivalent: ZioneScheduleMeta = {
        title: meta.title,
        subtitle: meta.subtitle,
        source_url: meta.source_url,
        ids: {
            dts: meta.dts,
            m: meta.m,
            torID: meta.torID,
            divID: meta.divID,
            gpoID: meta.gpoID
        },
        week: {
            label: meta.etapa || null,
            start_date: null,
            end_date: null,
            raw_range: meta.etapa || null
        },
        view: 'Tabla de Posiciones'
    };

    const effectiveHeaders = headers && headers.length > 0
        ? headers
        : Object.keys(STANDINGS_HEADER_KEY_MAP);

    return (
        <div className="schedule-container">
            <section className="schedule-meta">
                <div className="schedule-header">
                    {moduleIcon && (
                        <img className="schedule-header-icon" src={moduleIcon} alt="" aria-hidden loading="lazy" />
                    )}
                    <div className="schedule-header-titles">
                        <span className="schedule-header-label">{moduleLabel}</span>
                        <h2 className="schedule-title">{meta.title || moduleLabel}</h2>
                        {(meta.subtitle || meta.etapa) && (
                            <p className="schedule-subtitle">{meta.subtitle || meta.etapa}</p>
                        )}
                        {meta.subtitle && meta.etapa && meta.subtitle !== meta.etapa && (
                            <p className="schedule-subtitle schedule-subtitle-alt">{meta.etapa}</p>
                        )}
                    </div>
                </div>
            </section>

            <SummaryBar items={summaryItems} />

            {matchdayMatches && matchdayMatches.length > 0 && (
                <MatchdayWidget
                    matches={matchdayMatches}
                    scheduleMeta={scheduleMetaEquivalent}
                    onTeamClick={onTeamClick}
                />
            )}

            {groups.length === 0 ? (
                <div className="empty-state">No hay información disponible.</div>
            ) : (
                groups.map((group, index) => (
                    <section key={`${group.group || 'Grupo'}-${index}`} className="module-group">
                        <GroupHeader title={group.group} index={groups.length > 1 ? index : undefined} />
                        <div className="table-container">
                            <div className="table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            {effectiveHeaders.map(header => (
                                                <th key={header}>{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.rows.map((row, ri) => {
                                            const rowKey = `${group.group || 'Grupo'}-${row.Equipo?.name || 'Equipo'}-${ri}`;
                                            const rowClassName = row.idle ? 'standings-row-idle' : undefined;
                                            return (
                                                <tr key={rowKey} className={rowClassName}>
                                                    {effectiveHeaders.map(header => {
                                                        const mappedKey = STANDINGS_HEADER_KEY_MAP[header] as keyof ZioneStandingsRow | undefined;
                                                        if (mappedKey === 'Equipo') {
                                                            const equipo = row.Equipo;
                                                            const teamIdStr = getTeamIdFromHref(equipo?.href);
                                                            const parsedId = teamIdStr ? Number.parseInt(teamIdStr, 10) : null;
                                                            const team: ZioneTeam = {
                                                                name: equipo?.name || 'Equipo',
                                                                href: equipo?.href || null,
                                                                id: parsedId != null && !Number.isNaN(parsedId) ? parsedId : null
                                                            };
                                                            const handleClick = () => {
                                                                if (!onTeamClick) return;
                                                                onTeamClick(team, {
                                                                    scheduleMeta: scheduleMetaEquivalent,
                                                                    standingsGroup: group.group,
                                                                    standingsRow: row,
                                                                    source: 'standings'
                                                                });
                                                            };
                                                            const content = onTeamClick ? (
                                                                <button type="button" className="team-link team-name" onClick={handleClick}>
                                                                    {equipo?.name || 'Equipo'}
                                                                </button>
                                                            ) : (
                                                                <span className="team-name">{equipo?.name || 'Equipo'}</span>
                                                            );
                                                            return (
                                                                <td key={header}>
                                                                    <div className="standings-team-cell">
                                                                        {equipo?.img && (
                                                                            <img
                                                                                className="standings-team-shield"
                                                                                src={equipo.img}
                                                                                alt=""
                                                                                aria-hidden
                                                                                width={24}
                                                                                height={24}
                                                                            />
                                                                        )}
                                                                        {content}
                                                                    </div>
                                                                </td>
                                                            );
                                                        }
                                                        if (mappedKey) {
                                                            const value = row[mappedKey];
                                                            return (
                                                                <td key={header}>{value ?? '—'}</td>
                                                            );
                                                        }
                                                        const fallbackValue = (row as Record<string, any>)[header];
                                                        return (
                                                            <td key={header}>{fallbackValue ?? ''}</td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                ))
            )}
        </div>
    );
};
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
    matchdayMatches?: ZioneResultMatch[] | null;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}> = ({ title, data, onLoad, loading, moduleKey, client, icon, matchdayMatches, onTeamClick }) => {
    React.useEffect(() => { if (!data && !loading) onLoad(); }, [data, loading, onLoad]);

    const scheduleData = moduleKey === 'rol' && isScheduleData(data) ? data : null;
    const resultsData = moduleKey === 'resultados' && isResultsData(data) ? data : null;
    const standingsData = moduleKey === 'posiciones' && isStandingsData(data) ? data : null;
    const tableData = !scheduleData && !resultsData && !standingsData && isModuleData(data) ? data : null;

    const showModuleHeader = !scheduleData && !resultsData && !standingsData;

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
                {!loading && !scheduleData && !resultsData && standingsData && (
                    <StandingsRenderer
                        standings={standingsData}
                        moduleLabel={title}
                        moduleIcon={icon}
                        matchdayMatches={matchdayMatches}
                        onTeamClick={onTeamClick}
                    />
                )}
                {!loading && !scheduleData && !resultsData && tableData && (
                    <ModuleDataRenderer moduleKey={moduleKey || ''} data={tableData} />
                )}
                {/* Eliminar mensaje de formato desconocido SOLO para posiciones */}
                {!loading && data && !scheduleData && !resultsData && !tableData && moduleKey !== 'posiciones' && (
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

// Widget para mostrar los partidos de la jornada
const MatchdayWidget: React.FC<{
    matches: ZioneResultMatch[];
    scheduleMeta: ZioneScheduleMeta;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}> = ({ matches, scheduleMeta, onTeamClick }) => {
    if (!matches || matches.length === 0) return null;

    const formatTime = (time: string | null) => {
        if (!time) return '--:--';
        return time.replace('hs', '').trim();
    };

    // Determinar si hay partidos jugados y por jugar
    const playedMatches = matches.filter(m => {
        const statusLower = (m.status || '').toLowerCase();
        const hasScore = m.score1 != null && m.score2 != null;
        return statusLower.includes('jugado') || hasScore;
    });
    const upcomingMatches = matches.filter(m => {
        const statusLower = (m.status || '').toLowerCase();
        const hasScore = m.score1 != null && m.score2 != null;
        return !statusLower.includes('jugado') && !hasScore;
    });

    // Crear título dinámico
    let widgetTitle = '⚽ Partidos';
    if (upcomingMatches.length > 0 && playedMatches.length > 0) {
        widgetTitle = '⚽ Partidos de la Jornada';
    } else if (upcomingMatches.length > 0 && playedMatches.length === 0) {
        widgetTitle = '⚽ Partidos de Hoy';
    } else if (playedMatches.length > 0) {
        widgetTitle = '⚽ Resultados de la Jornada';
    }

    return (
        <section className="matchday-widget">
            <h3 className="matchday-widget-title">{widgetTitle}</h3>
            <div className="matchday-widget-matches">
                {matches.map((match, index) => {
                    const statusText = match.status?.trim() || 'Por jugar';
                    const statusLower = statusText.toLowerCase();
                    const hasScore = match.score1 != null && match.score2 != null;
                    const isPlayed = statusLower.includes('jugado') || hasScore;

                    const handleTeam1Click = () => {
                        if (!onTeamClick) return;
                        const context: TeamClickContext = {
                            scheduleMeta: scheduleMeta,
                            matchdayDate: null,
                            resultMatch: match,
                            source: 'results'
                        };
                        onTeamClick(match.team1, context);
                    };

                    const handleTeam2Click = () => {
                        if (!onTeamClick) return;
                        const context: TeamClickContext = {
                            scheduleMeta: scheduleMeta,
                            matchdayDate: null,
                            resultMatch: match,
                            source: 'results'
                        };
                        onTeamClick(match.team2, context);
                    };

                    return (
                        <article key={index} className={`matchday-widget-match ${isPlayed ? 'match-played' : 'match-pending'}`}>
                            <div className="matchday-widget-match-time">
                                {formatTime(match.time)}
                            </div>
                            <div className="matchday-widget-match-teams">
                                <div className="matchday-widget-team">
                                    {onTeamClick ? (
                                        <button type="button" className="team-link" onClick={handleTeam1Click}>
                                            {match.team1?.name}
                                        </button>
                                    ) : (
                                        <span>{match.team1?.name}</span>
                                    )}
                                </div>
                                <div className="matchday-widget-score">
                                    {hasScore ? (
                                        <span className="score-display">{match.score1} - {match.score2}</span>
                                    ) : (
                                        <span className="vs-text">vs</span>
                                    )}
                                </div>
                                <div className="matchday-widget-team">
                                    {onTeamClick ? (
                                        <button type="button" className="team-link" onClick={handleTeam2Click}>
                                            {match.team2?.name}
                                        </button>
                                    ) : (
                                        <span>{match.team2?.name}</span>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
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
    const statusLower = statusText.toLowerCase();
    const statusKey = statusLower.includes('jugado')
        ? 'played'
        : statusLower.includes('perdido') || statusLower.includes('ganado') || statusLower.includes('empatado')
            ? 'played'
            : statusLower.includes('pendiente')
                ? 'pending'
                : statusLower.includes('suspendido')
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

const SCORE_INVALID_TOKENS = new Set(['', '-', '—', 'vs']);

const isScoreValue = (value: ZioneResultMatch['score1']) => {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim();
    if (normalized.length === 0) return false;
    const normalizedLower = normalized.toLowerCase();
    if (SCORE_INVALID_TOKENS.has(normalizedLower)) return false;
    return /\d/.test(normalizedLower);
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
    const { meta, matchdays } = results;

    const hasMatchdays = Array.isArray(matchdays) && matchdays.length > 0;
    const weekInfo = meta.week;
    const weekRange = weekInfo?.raw_range || null;
    const startLabel = weekInfo?.start_date ? formatIsoToLabel(weekInfo.start_date) : null;
    const endLabel = weekInfo?.end_date ? formatIsoToLabel(weekInfo.end_date) : null;

    // State for jornada filter
    const [selectedJornadaIndex, setSelectedJornadaIndex] = useState<number | null>(null);

    // Determinar la última jornada con resultados
    const lastJornadaWithResults = React.useMemo(() => {
        if (!hasMatchdays || matchdays.length === 0) return null;
        
        // Buscar desde el final hacia atrás la primera jornada con resultados
        for (let i = matchdays.length - 1; i >= 0; i--) {
            const matchday = matchdays[i];
            // Verificar si tiene al menos un resultado válido (scores no null)
            const hasResults = matchday.matches.some(m => 
                m.score1 != null || m.score2 != null
            );
            if (hasResults) {
                // Extraer número de jornada o usar label
                const jornadaNum = matchday.matches[0]?.jornada?.number;
                return jornadaNum ? `Jornada ${jornadaNum}` : matchday.label || 'Jornada';
            }
        }
        
        // Si ninguna tiene resultados, usar la última jornada disponible
        const lastMatchday = matchdays[matchdays.length - 1];
        const jornadaNum = lastMatchday.matches[0]?.jornada?.number;
        return jornadaNum ? `Jornada ${jornadaNum}` : lastMatchday.label || 'Jornada';
    }, [hasMatchdays, matchdays]);

    // Obtener el rango de fechas de la última jornada con resultados
    const lastJornadaDateRange = React.useMemo(() => {
        if (!hasMatchdays || matchdays.length === 0) return null;
        
        for (let i = matchdays.length - 1; i >= 0; i--) {
            const matchday = matchdays[i];
            const hasResults = matchday.matches.some(m => 
                m.score1 != null || m.score2 != null
            );
            if (hasResults && matchday.date) {
                return formatIsoToLabel(matchday.date);
            }
        }
        
        return null;
    }, [hasMatchdays, matchdays]);

    const rangeDisplay = (startLabel || endLabel)
        ? `${startLabel || 'Por definir'}${endLabel ? ` – ${endLabel}` : ''}`
        : weekRange || null;
    const contextTitle = lastJornadaWithResults || weekInfo?.label || meta.title || moduleLabel;
    const contextSubtitle = lastJornadaDateRange || rangeDisplay || meta.subtitle || null;
    const secondarySubtitle = meta.subtitle && meta.subtitle !== contextSubtitle ? meta.subtitle : null;

    // Filter matchdays based on selection
    const filteredMatchdays = selectedJornadaIndex !== null && hasMatchdays
        ? [matchdays[selectedJornadaIndex]]
        : matchdays;

    // Ordenar matchdays de más reciente a más antiguo
    const sortedMatchdays = React.useMemo(() => {
        if (!filteredMatchdays) return [];
        return [...filteredMatchdays].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA; // Descendente (más reciente primero)
        });
    }, [filteredMatchdays]);

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

            {hasMatchdays && matchdays.length > 0 && (
                <div className="team-selector-section">
                    <label htmlFor="jornada-selector" className="team-selector-label">
                        Filtrar por jornada
                    </label>
                    <select
                        id="jornada-selector"
                        className="team-selector-dropdown"
                        value={selectedJornadaIndex !== null ? String(selectedJornadaIndex) : ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            setSelectedJornadaIndex(value === '' ? null : Number(value));
                        }}
                    >
                        <option value="">Todas las jornadas</option>
                        {[...matchdays].reverse().map((matchday: ZioneResultMatchday, reverseIndex: number) => {
                            const actualIndex = matchdays.length - 1 - reverseIndex;
                            const jornadaNum = matchday.matches[0]?.jornada?.number;
                            const label = jornadaNum ? `Jornada ${jornadaNum}` : matchday.label || `Jornada ${actualIndex + 1}`;
                            return (
                                <option key={actualIndex} value={String(actualIndex)}>
                                    {label}
                                </option>
                            );
                        })}
                    </select>
                </div>
            )}

            {hasMatchdays && sortedMatchdays.length > 0 ? (
                <>
                    <div className="schedule-section">
                        <div className="schedule-section-header">
                            <h3 className="schedule-section-title">
                                {selectedJornadaIndex !== null ? 'Resultados de la Jornada' : 'Resultados Recientes'}
                            </h3>
                        </div>
                        {sortedMatchdays.map((matchday: ZioneResultMatchday, index: number) => {
                            // Obtener el número de jornada de cualquier partido que lo tenga
                            const jornadaNum = matchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                            const jornadaLabel = jornadaNum ? `Jornada ${jornadaNum}` : (matchday.label && !matchday.label.includes('/') ? matchday.label : null);
                            const headerLabel = jornadaLabel || `Jornada ${index + 1}`;
                            const dateLabel = matchday.date ? formatIsoToLabel(matchday.date) : null;
                            
                            return (
                                <section key={`${headerLabel}-${index}`} className="schedule-matchday">
                                    <header className="matchday-header">
                                        <div className="matchday-header-content">
                                            <span className="matchday-date">{headerLabel}</span>
                                            {dateLabel && <span className="matchday-subtitle">{dateLabel}</span>}
                                        </div>
                                    </header>
                                    <div className="matchday-grid">
                                        {matchday.matches.map((match: ZioneResultMatch, matchIndex: number) => (
                                            <ResultCard
                                                key={matchIndex}
                                                match={match}
                                                dateLabel={null}
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
                        })}
                    </div>
                </>
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
    const { meta, matchdays, rest } = schedule;

    const hasMatchdays = Array.isArray(matchdays) && matchdays.length > 0;
    const weekInfo = meta.week;
    const weekRange = weekInfo?.raw_range || null;
    const startLabel = weekInfo?.start_date ? formatIsoToLabel(weekInfo.start_date) : null;
    const endLabel = weekInfo?.end_date ? formatIsoToLabel(weekInfo.end_date) : null;
    const teamsByClub = schedule.teamsByClub;
    const [resultLookup, setResultLookup] = useState<Record<string, MatchResult>>({});
    const resultsRequestKey = React.useRef<string | null>(null);

    // Determinar la jornada actual (primera jornada con partidos pendientes)
    const currentJornada = React.useMemo(() => {
        if (!hasMatchdays) return null;
        
        // Buscar la primera jornada que tenga al menos un partido sin jugar
        for (const matchday of matchdays) {
            const hasPending = matchday.matches.some(m => !m.status?.toLowerCase().includes('jugado'));
            if (hasPending) {
                const jornadaNum = matchday.matches[0]?.jornada?.number;
                return jornadaNum ? `Jornada ${jornadaNum}` : matchday.label || 'Jornada';
            }
        }
        
        // Si todos están jugados, retornar la última jornada
        if (matchdays.length > 0) {
            const lastMatchday = matchdays[matchdays.length - 1];
            const jornadaNum = lastMatchday.matches[0]?.jornada?.number;
            return jornadaNum ? `Jornada ${jornadaNum}` : lastMatchday.label || 'Jornada';
        }
        
        return null;
    }, [hasMatchdays, matchdays]);

    // Obtener el rango de fechas de la jornada actual
    const currentJornadaDateRange = React.useMemo(() => {
        if (!hasMatchdays) return null;
        
        for (const matchday of matchdays) {
            const hasPending = matchday.matches.some(m => !m.status?.toLowerCase().includes('jugado'));
            if (hasPending && matchday.date) {
                return formatIsoToLabel(matchday.date);
            }
        }
        
        if (matchdays.length > 0) {
            const lastMatchday = matchdays[matchdays.length - 1];
            if (lastMatchday.date) {
                return formatIsoToLabel(lastMatchday.date);
            }
        }
        
        return null;
    }, [hasMatchdays, matchdays]);

    const rangeDisplay = (startLabel || endLabel)
        ? `${startLabel || 'Sin definir'}${endLabel ? ` – ${endLabel}` : ''}`
        : weekRange || null;
    const contextTitle = currentJornada || weekInfo?.label || meta.title || moduleLabel;
    const contextSubtitle = currentJornadaDateRange || rangeDisplay || meta.subtitle || null;
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

    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

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

    // If a team is selected, show only team view
    if (teamState.team && teamState.data) {
        return (
            <div className="schedule-container">
                <section className="schedule-meta">
                    <div className="schedule-header">
                        {moduleIcon && (
                            <img className="schedule-header-icon" src={moduleIcon} alt="" aria-hidden loading="lazy" />
                        )}
                        <div className="schedule-header-titles">
                            <span className="schedule-header-label">{moduleLabel} · {teamState.team.name}</span>
                            <h2 className="schedule-title">{teamState.team.name}</h2>
                            {teamState.team.group && (
                                <p className="schedule-subtitle">
                                    {teamState.team.group}{teamState.team.division ? ` · ${teamState.team.division}` : ''}
                                </p>
                            )}
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="back-to-full-button"
                        onClick={() => setTeamState({ team: null, data: null, loading: false, error: null })}
                        aria-label="Volver a vista completa"
                    >
                        ← Volver al rol completo
                    </button>
                </section>

                {teamState.loading && <div className="loading">Cargando rol del equipo…</div>}
                {teamState.error && <div className="app-alert">{teamState.error}</div>}
                {!teamState.loading && !teamState.error && teamState.data.matchdays.length === 0 && (
                    <div className="empty-state">No hay partidos programados para este equipo.</div>
                )}
                {!teamState.loading && !teamState.error && teamState.data.matchdays.length > 0 && (
                    <>
                        {(() => {
                            const upcomingMatchdays: ZioneMatchday[] = [];
                            const pastMatchdays: ZioneMatchday[] = [];
                            
                            teamState.data.matchdays.forEach((matchday: ZioneMatchday) => {
                                const pendingMatches = matchday.matches.filter(m => {
                                    const status = m.status?.toLowerCase() || '';
                                    // Un partido está pendiente si tiene status "programado" o similar, NO si está jugado
                                    const isPending = !status.includes('jugado') 
                                        && !status.includes('finalizado') 
                                        && !status.includes('terminado')
                                        && !status.includes('perdido')
                                        && !status.includes('ganado')
                                        && !status.includes('empatado');
                                    return isPending;
                                });
                                
                                const playedMatches = matchday.matches.filter(m => {
                                    const status = m.status?.toLowerCase() || '';
                                    // Un partido está jugado si tiene cualquiera de estos status
                                    return status.includes('jugado') 
                                        || status.includes('finalizado') 
                                        || status.includes('terminado')
                                        || status.includes('perdido')
                                        || status.includes('ganado')
                                        || status.includes('empatado');
                                });
                                
                                // Si hay partidos pendientes, crear un matchday para próximos
                                if (pendingMatches.length > 0) {
                                    upcomingMatchdays.push({
                                        ...matchday,
                                        matches: pendingMatches
                                    });
                                }
                                
                                // Si hay partidos jugados, crear un matchday para pasados
                                if (playedMatches.length > 0) {
                                    pastMatchdays.push({
                                        ...matchday,
                                        matches: playedMatches
                                    });
                                }
                            });
                            
                            return (
                                <>
                                    {upcomingMatchdays.length > 0 && (
                                        <div className="schedule-section">
                                            <div className="schedule-section-header">
                                                <h3 className="schedule-section-title">Próximos Partidos</h3>
                                            </div>
                                            {upcomingMatchdays.map((matchday: ZioneMatchday, index: number) => {
                                                const jornadaNum = matchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                                                const jornadaLabel = jornadaNum ? `Jornada ${jornadaNum}` : (matchday.label && !matchday.label.includes('/') ? matchday.label : null);
                                                const headerLabel = jornadaLabel || `Jornada ${index + 1}`;
                                                const dateLabel = matchday.date ? formatIsoToLabel(matchday.date) : null;
                                                const cardDate = matchday.date ? formatIsoToLabel(matchday.date) : matchday.label;
                                                return (
                                                    <section key={`upcoming-${headerLabel}-${index}`} className="schedule-matchday">
                                                        <header className="matchday-header">
                                                            <div className="matchday-header-content">
                                                                <span className="matchday-date">{headerLabel}</span>
                                                                {dateLabel && <span className="matchday-subtitle">{dateLabel}</span>}
                                                            </div>
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
                                                                        const scheduleMeta = teamState.data?.meta || meta;
                                                                        onTeamClick(teamItem, {
                                                                            scheduleMeta,
                                                                            match,
                                                                            matchdayDate: matchday.date || null,
                                                                            source: 'team-schedule'
                                                                        });
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    )}
                                    
                                    {pastMatchdays.length > 0 && (
                                        <div className="schedule-section">
                                            <div className="schedule-section-header">
                                                <h3 className="schedule-section-title">Partidos Anteriores</h3>
                                            </div>
                                            {pastMatchdays.map((matchday: ZioneMatchday, index: number) => {
                                                const jornadaNum = matchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                                                const jornadaLabel = jornadaNum ? `Jornada ${jornadaNum}` : (matchday.label && !matchday.label.includes('/') ? matchday.label : null);
                                                const headerLabel = jornadaLabel || `Jornada ${index + 1}`;
                                                const dateLabel = matchday.date ? formatIsoToLabel(matchday.date) : null;
                                                const cardDate = matchday.date ? formatIsoToLabel(matchday.date) : matchday.label;
                                                return (
                                                    <section key={`past-${headerLabel}-${index}`} className="schedule-matchday">
                                                        <header className="matchday-header">
                                                            <div className="matchday-header-content">
                                                                <span className="matchday-date">{headerLabel}</span>
                                                                {dateLabel && <span className="matchday-subtitle">{dateLabel}</span>}
                                                            </div>
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
                                                                        const scheduleMeta = teamState.data?.meta || meta;
                                                                        onTeamClick(teamItem, {
                                                                            scheduleMeta,
                                                                            match,
                                                                            matchdayDate: matchday.date || null,
                                                                            source: 'team-schedule'
                                                                        });
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </>
                )}

                {rest && rest.length > 0 && (
                    <div className="schedule-rest">
                        <span className="rest-label">Descansan</span>
                        <span className="rest-teams">{rest.map(team => team.name).join(', ')}</span>
                    </div>
                )}
            </div>
        );
    }

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
                <div className="team-selector-section">
                    <label htmlFor="team-selector" className="team-selector-label">
                        Ver rol por equipo
                    </label>
                    <select
                        id="team-selector"
                        className="team-selector-dropdown"
                        value={teamState.team?.id ?? ''}
                        onChange={(e) => {
                            const teamId = e.target.value;
                            if (!teamId) return;
                            const team = teamsByClub.teams.find(t => String(t.id) === teamId);
                            if (team) handleTeamSelect(team);
                        }}
                        disabled={teamState.loading}
                    >
                        <option value="">Selecciona un equipo</option>
                        {teamsByClub.teams.map((team, index) => {
                            const disabled = team.id == null && !team.href;
                            return (
                                <option 
                                    key={`${team.id ?? team.name}-${index}`} 
                                    value={team.id ?? ''} 
                                    disabled={disabled}
                                >
                                    {team.name}
                                </option>
                            );
                        })}
                    </select>
                    {teamState.loading && <span className="team-selector-loading">Cargando…</span>}
                </div>
            )}

            {hasMatchdays ? (
                <>
                    {(() => {
                        const upcomingMatchdays: ZioneMatchday[] = [];
                        const pastMatchdays: ZioneMatchday[] = [];
                        
                        matchdays.forEach((matchday: ZioneMatchday) => {
                            const hasPlayed = matchday.matches.some(m => m.status?.toLowerCase().includes('jugado'));
                            const hasPending = matchday.matches.some(m => !m.status?.toLowerCase().includes('jugado'));
                            
                            // If matchday has any pending games, consider it upcoming
                            if (hasPending) {
                                upcomingMatchdays.push(matchday);
                            } else if (hasPlayed) {
                                pastMatchdays.push(matchday);
                            } else {
                                // Default to upcoming if status is unclear
                                upcomingMatchdays.push(matchday);
                            }
                        });

                        const hasUpcoming = upcomingMatchdays.length > 0;
                        const hasPast = pastMatchdays.length > 0;
                        
                        return (
                            <>
                                {/* Tab Navigation */}
                                {hasUpcoming && hasPast && (
                                    <div className="schedule-tabs">
                                        <button
                                            type="button"
                                            className={`schedule-tab ${activeTab === 'upcoming' ? 'schedule-tab--active' : ''}`}
                                            onClick={() => setActiveTab('upcoming')}
                                        >
                                            Próximos Partidos
                                        </button>
                                        <button
                                            type="button"
                                            className={`schedule-tab ${activeTab === 'past' ? 'schedule-tab--active' : ''}`}
                                            onClick={() => setActiveTab('past')}
                                        >
                                            Partidos Anteriores
                                        </button>
                                    </div>
                                )}

                                {/* Tab Content */}
                                {activeTab === 'upcoming' && upcomingMatchdays.length > 0 && (
                                    <div className="schedule-section">
                                        {upcomingMatchdays.map((matchday: ZioneMatchday, index: number) => {
                                            const jornadaNum = matchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                                            const jornadaLabel = jornadaNum ? `Jornada ${jornadaNum}` : (matchday.label && !matchday.label.includes('/') ? matchday.label : null);
                                            const headerLabel = jornadaLabel || `Jornada ${index + 1}`;
                                            const dateLabel = matchday.date ? formatIsoToLabel(matchday.date) : null;
                                            const cardDate = matchday.date ? formatIsoToLabel(matchday.date) : matchday.label;
                                            return (
                                                <section key={`upcoming-${headerLabel}-${index}`} className="schedule-matchday">
                                                    <header className="matchday-header">
                                                        <div className="matchday-header-content">
                                                            <span className="matchday-date">{headerLabel}</span>
                                                            {dateLabel && <span className="matchday-subtitle">{dateLabel}</span>}
                                                        </div>
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
                                        })}
                                    </div>
                                )}
                                
                                {activeTab === 'past' && pastMatchdays.length > 0 && (
                                    <div className="schedule-section">
                                        {pastMatchdays.map((matchday: ZioneMatchday, index: number) => {
                                            const jornadaNum = matchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                                            const jornadaLabel = jornadaNum ? `Jornada ${jornadaNum}` : (matchday.label && !matchday.label.includes('/') ? matchday.label : null);
                                            const headerLabel = jornadaLabel || `Jornada ${index + 1}`;
                                            const dateLabel = matchday.date ? formatIsoToLabel(matchday.date) : null;
                                            const cardDate = matchday.date ? formatIsoToLabel(matchday.date) : matchday.label;
                                            return (
                                                <section key={`past-${headerLabel}-${index}`} className="schedule-matchday">
                                                    <header className="matchday-header">
                                                        <div className="matchday-header-content">
                                                            <span className="matchday-date">{headerLabel}</span>
                                                            {dateLabel && <span className="matchday-subtitle">{dateLabel}</span>}
                                                        </div>
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
                                        })}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </>
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
    const [matchdayMatches, setMatchdayMatches] = useState<ZioneResultMatch[] | null>(null);
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
            // For team-schedule context (rol por equipo), use the reliable general schedule approach
            // instead of the buggy team-specific endpoint that has incorrect IDs
            if (context.source === 'team-schedule') {
                // Get the general schedule data which has correct team IDs
                const generalSchedule = await client.getRolJuegos(dtsValue, 
                    scheduleMeta?.ids?.torID || '', 
                    scheduleMeta?.ids?.divID || '', 
                    scheduleMeta?.ids?.gpoID || '', 
                    { v: '1' }
                );
                
                // Find the specific team in the general schedule data
                let foundTeam: ZioneTeam | null = null;
                let foundTeamId: string | null = null;
                
                // Search through all matches to find a team with matching name (NOT ID, since IDs are wrong)
                for (const matchday of generalSchedule.matchdays) {
                    for (const match of matchday.matches) {
                        // Check both team1 and team2
                        for (const matchTeam of [match.team1, match.team2]) {
                            if (matchTeam && matchTeam.name && team.name) {
                                // Only match by name, ignore IDs since they're corrupted in team-schedule context
                                const teamNameMatch = 
                                    matchTeam.name.toLowerCase() === team.name.toLowerCase() ||
                                    matchTeam.name.toLowerCase().includes(team.name.toLowerCase()) ||
                                    team.name.toLowerCase().includes(matchTeam.name.toLowerCase());
                                
                                if (teamNameMatch) {
                                    foundTeam = matchTeam;
                                    foundTeamId = getTeamId(matchTeam);
                                    break;
                                }
                            }
                        }
                        if (foundTeam) break;
                    }
                    if (foundTeam) break;
                }
                
                if (foundTeam && foundTeamId) {
                    // Use the correct team ID from general schedule
                    const response = await client.getTeamInfo(dtsValue, foundTeamId, {
                        torID: scheduleMeta?.ids?.torID || undefined,
                        divID: scheduleMeta?.ids?.divID || undefined,
                        gpoID: scheduleMeta?.ids?.gpoID || undefined,
                        teamName: foundTeam.name || team.name || undefined
                    });
                    
                    setTeamInfoState(prev => ({
                        ...prev,
                        loading: false,
                        data: response,
                        error: null
                    }));
                } else {
                    // Fall back to original method if team not found
                    const response = await client.getTeamInfo(dtsValue, teamId, {
                        torID: scheduleMeta?.ids?.torID || undefined,
                        divID: scheduleMeta?.ids?.divID || undefined,
                        gpoID: scheduleMeta?.ids?.gpoID || undefined,
                        teamName: team.name || undefined
                    });
                    
                    setTeamInfoState(prev => ({
                        ...prev,
                        loading: false,
                        data: response,
                        error: null
                    }));
                }
            } else {
                // For other contexts (schedule, results), use the normal method
                const response = await client.getTeamInfo(dtsValue, teamId, {
                    torID: scheduleMeta?.ids?.torID || undefined,
                    divID: scheduleMeta?.ids?.divID || undefined,
                    gpoID: scheduleMeta?.ids?.gpoID || undefined,
                    teamName: team.name || undefined
                });

                setTeamInfoState(prev => ({
                    ...prev,
                    loading: false,
                    data: response,
                    error: null
                }));
            }
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
            if (module === 'posiciones') {
                const standings = await client.getStandings('DTS094', torneo, division, grupo, { m: '2' });
                setDatos(prev => ({ ...prev, [module]: standings }));
                
                setMatchdayMatches(null);

                try {
                    const [schedule, resultados] = await Promise.all([
                        client.getRolJuegos('DTS094', torneo, division, grupo, { v: '1' }),
                        client.getResultados('DTS094', torneo, division, grupo, { m: '2', smodo: '0' })
                    ]);

                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];

                    // Función auxiliar para convertir ZioneMatch a ZioneResultMatch
                    const toResultMatch = (match: ZioneMatch): ZioneResultMatch => ({
                        time: match.time,
                        kickoff: match.kickoff,
                        group: match.group,
                        stage: match.stage,
                        jornada: match.jornada,
                        team1: match.team1,
                        team2: match.team2,
                        score1: null,
                        score2: null,
                        separator: 'vs',
                        status: match.status
                    });

                    // Paso 1: Determinar la jornada actual/próxima
                    let currentJornadaNumber: number | null = null;
                    
                    // Primero, buscar en el schedule la jornada de hoy o próxima
                    if (Array.isArray(schedule.matchdays)) {
                        // Buscar jornada de hoy
                        const todayMatchday = schedule.matchdays.find(md => md.date === todayStr);
                        if (todayMatchday && todayMatchday.matches && todayMatchday.matches.length > 0) {
                            const jornadaNum = todayMatchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                            if (jornadaNum != null) {
                                currentJornadaNumber = jornadaNum;
                            }
                        }
                        
                        // Si no hay jornada hoy, buscar la próxima jornada futura
                        if (currentJornadaNumber == null) {
                            const futureMatchdays = schedule.matchdays
                                .filter(md => md.date && md.date >= todayStr && md.matches && md.matches.length > 0)
                                .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                            
                            if (futureMatchdays.length > 0) {
                                const nextMatchday = futureMatchdays[0];
                                const jornadaNum = nextMatchday.matches?.find(m => m.jornada?.number != null)?.jornada?.number;
                                if (jornadaNum != null) {
                                    currentJornadaNumber = jornadaNum;
                                }
                            }
                        }
                    }
                    
                    // Si aún no tenemos jornada, usar la más reciente con resultados
                    if (currentJornadaNumber == null && Array.isArray(resultados.matchdays)) {
                        const matchdaysWithResults = resultados.matchdays
                            .filter(md => {
                                const matches = md.matches ?? [];
                                return matches.some(m => isScoreValue(m.score1) || isScoreValue(m.score2));
                            })
                            .map(md => {
                                const matches = md.matches ?? [];
                                const jornadaNumbers = matches
                                    .map(m => m.jornada?.number)
                                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
                                const maxJornada = jornadaNumbers.length > 0 ? Math.max(...jornadaNumbers) : null;
                                return { matchday: md, jornadaNumber: maxJornada };
                            })
                            .filter(item => item.jornadaNumber != null)
                            .sort((a, b) => (b.jornadaNumber ?? 0) - (a.jornadaNumber ?? 0));
                        
                        if (matchdaysWithResults.length > 0) {
                            currentJornadaNumber = matchdaysWithResults[0].jornadaNumber;
                        }
                    }
                    
                    // Paso 2: Recolectar partidos solo de la jornada actual
                    const matchCandidates: ZioneResultMatch[] = [];
                    const processedKeys = new Set<string>();
                    
                    if (currentJornadaNumber != null) {
                        // Primero, buscar en resultados (tienen marcadores)
                        if (Array.isArray(resultados.matchdays)) {
                            resultados.matchdays.forEach(matchday => {
                                const matches = matchday.matches ?? [];
                                matches.forEach(match => {
                                    if (match.jornada?.number === currentJornadaNumber) {
                                        const key = `${match.team1?.name}-${match.team2?.name}-${match.jornada?.number}`;
                                        if (!processedKeys.has(key)) {
                                            processedKeys.add(key);
                                            matchCandidates.push(match);
                                        }
                                    }
                                });
                            });
                        }
                        
                        // Luego, complementar con schedule si no están en resultados
                        if (Array.isArray(schedule.matchdays)) {
                            schedule.matchdays.forEach(matchday => {
                                const matches = matchday.matches ?? [];
                                matches.forEach(match => {
                                    if (match.jornada?.number === currentJornadaNumber) {
                                        const key = `${match.team1?.name}-${match.team2?.name}-${match.jornada?.number}`;
                                        if (!processedKeys.has(key)) {
                                            processedKeys.add(key);
                                            matchCandidates.push(toResultMatch(match));
                                        }
                                    }
                                });
                            });
                        }
                    }

                    if (matchCandidates.length > 0) {
                        setMatchdayMatches(matchCandidates.slice(0, 8));
                    }
                } catch (scheduleError) {
                    console.error('Error loading matchday matches:', scheduleError);
                }

            } else if (module === 'rol') {
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
                    matchdayMatches={matchdayMatches}
                    onTeamClick={handleTeamInfoRequest}
                />
            </main>

            <TeamInfoDrawer state={teamInfoState} onClose={closeTeamInfo} />

            {renderTabs('bottom')}
        </div>
    );
}
