import React, { useState, useMemo } from 'react';
import { ZioneResults, ZioneTeam, ZioneResultMatchday } from '../../../../sdk/src';
import { TeamClickContext } from '../../types';
import { formatIsoToLabel } from '../../utils/helpers';
import { ResultCard } from '../Match/ResultCard';

interface ResultsRendererProps {
    results: ZioneResults;
    moduleLabel: string;
    moduleIcon?: string;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}

export const ResultsRenderer: React.FC<ResultsRendererProps> = ({ 
    results, 
    moduleLabel, 
    moduleIcon, 
    onTeamClick 
}) => {
    const { meta, matchdays } = results;

    const hasMatchdays = Array.isArray(matchdays) && matchdays.length > 0;
    const weekInfo = meta.week;
    const weekRange = weekInfo?.raw_range || null;
    const startLabel = weekInfo?.start_date ? formatIsoToLabel(weekInfo.start_date) : null;
    const endLabel = weekInfo?.end_date ? formatIsoToLabel(weekInfo.end_date) : null;

    // State for jornada filter
    const [selectedJornadaIndex, setSelectedJornadaIndex] = useState<number | null>(null);

    // Determinar la última jornada con resultados
    const lastJornadaWithResults = useMemo(() => {
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
    const lastJornadaDateRange = useMemo(() => {
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
    const sortedMatchdays = useMemo(() => {
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
                                        {matchday.matches.map((match, matchIndex: number) => (
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
