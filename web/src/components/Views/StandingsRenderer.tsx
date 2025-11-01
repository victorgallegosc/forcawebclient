import React from 'react';
import { ZioneStandings, ZioneTeam, ZioneResultMatch, ZioneScheduleMeta } from '../../../../sdk/src';
import { TeamClickContext, SummaryItem, STANDINGS_HEADER_KEY_MAP } from '../../types';
import { SummaryBar } from '../Common/SummaryBar';
import { GroupHeader } from '../Common/GroupHeader';
import { MatchdayWidget } from '../Match/MatchdayWidget';
import { getTeamIdFromHref } from '../../utils/helpers';

interface StandingsRendererProps {
    standings: ZioneStandings;
    moduleLabel: string;
    moduleIcon?: string;
    matchdayMatches?: ZioneResultMatch[] | null;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}

export const StandingsRenderer: React.FC<StandingsRendererProps> = ({ 
    standings, 
    moduleLabel, 
    moduleIcon, 
    matchdayMatches, 
    onTeamClick 
}) => {
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
                                                        const mappedKey = STANDINGS_HEADER_KEY_MAP[header] as keyof typeof row | undefined;
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
