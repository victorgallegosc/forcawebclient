import React from 'react';
import { TablaParsed, ZioneTeamRosterEntry } from '../../../../sdk/src';
import { ROSTER_FIELD_LABELS } from '../../types';

interface RosterListProps {
    table?: TablaParsed;
    roster?: ZioneTeamRosterEntry[];
}

export const RosterList: React.FC<RosterListProps> = ({ table, roster }) => {
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
