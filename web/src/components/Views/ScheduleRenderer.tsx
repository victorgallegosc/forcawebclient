import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ZioneClientFlow, {
    ZioneSchedule,
    ZioneMatch,
    ZioneMatchday,
    ZioneScheduleTeam,
    ZioneTeam
} from '../../../../sdk/src';
import { TeamClickContext, MatchResult } from '../../types';
import { formatIsoToLabel, buildResultLookup, collectMatchKeys } from '../../utils/helpers';
import { GameCard } from '../Match/GameCard';

interface ScheduleRendererProps {
    schedule: ZioneSchedule;
    client: ZioneClientFlow;
    moduleLabel: string;
    moduleIcon?: string;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}

export const ScheduleRenderer: React.FC<ScheduleRendererProps> = ({ 
    schedule, 
    client, 
    moduleLabel, 
    moduleIcon, 
    onTeamClick 
}) => {
    const { meta, matchdays, rest } = schedule;

    const hasMatchdays = Array.isArray(matchdays) && matchdays.length > 0;
    const weekInfo = meta.week;
    const weekRange = weekInfo?.raw_range || null;
    const startLabel = weekInfo?.start_date ? formatIsoToLabel(weekInfo.start_date) : null;
    const endLabel = weekInfo?.end_date ? formatIsoToLabel(weekInfo.end_date) : null;
    const teamsByClub = schedule.teamsByClub;
    const [resultLookup, setResultLookup] = useState<Record<string, MatchResult>>({});
    const resultsRequestKey = useRef<string | null>(null);

    const currentJornada = useMemo(() => {
        if (!hasMatchdays) return null;
        
        for (const matchday of matchdays) {
            const hasPending = matchday.matches.some(m => !m.status?.toLowerCase().includes('jugado'));
            if (hasPending) {
                const jornadaNum = matchday.matches[0]?.jornada?.number;
                return jornadaNum ? `Jornada ${jornadaNum}` : matchday.label || 'Jornada';
            }
        }
        
        if (matchdays.length > 0) {
            const lastMatchday = matchdays[matchdays.length - 1];
            const jornadaNum = lastMatchday.matches[0]?.jornada?.number;
            return jornadaNum ? `Jornada ${jornadaNum}` : lastMatchday.label || 'Jornada';
        }
        
        return null;
    }, [hasMatchdays, matchdays]);

    const currentJornadaDateRange = useMemo(() => {
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

    const hasPlayedMatches = useMemo(() => {
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

    const resolveResult = useCallback((match: ZioneMatch, date?: string | null): MatchResult | null => {
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

    // Team view
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
                                    return status.includes('jugado') 
                                        || status.includes('finalizado') 
                                        || status.includes('terminado')
                                        || status.includes('perdido')
                                        || status.includes('ganado')
                                        || status.includes('empatado');
                                });
                                
                                if (pendingMatches.length > 0) {
                                    upcomingMatchdays.push({
                                        ...matchday,
                                        matches: pendingMatches
                                    });
                                }
                                
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

    // Full schedule view
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
                            
                            if (hasPending) {
                                upcomingMatchdays.push(matchday);
                            } else if (hasPlayed) {
                                pastMatchdays.push(matchday);
                            } else {
                                upcomingMatchdays.push(matchday);
                            }
                        });

                        const hasUpcoming = upcomingMatchdays.length > 0;
                        const hasPast = pastMatchdays.length > 0;
                        
                        return (
                            <>
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
