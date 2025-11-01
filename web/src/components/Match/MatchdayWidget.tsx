import React from 'react';
import { ZioneResultMatch, ZioneTeam, ZioneScheduleMeta } from '../../../../sdk/src';
import { TeamClickContext } from '../../types';
import { formatTime } from '../../utils/helpers';

interface MatchdayWidgetProps {
    matches: ZioneResultMatch[];
    scheduleMeta: ZioneScheduleMeta;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}

export const MatchdayWidget: React.FC<MatchdayWidgetProps> = ({ matches, scheduleMeta, onTeamClick }) => {
    if (!matches || matches.length === 0) return null;

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
