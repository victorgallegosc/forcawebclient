import React from 'react';
import { ZioneStandingsRow } from '../../../../sdk/src';
import { TeamInfoState } from '../../types';
import { DataTable } from '../Common/DataTable';
import { TeamMatchesList } from './TeamMatchesList';
import { RosterList } from './RosterList';

interface TeamInfoDrawerProps {
    state: TeamInfoState;
    onClose: () => void;
}

export const TeamInfoDrawer: React.FC<TeamInfoDrawerProps> = ({ state, onClose }) => {
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
