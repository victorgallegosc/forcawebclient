import React from 'react';
import { ZioneMatch, ZioneTeam } from '../../../../sdk/src';
import { MatchResult } from '../../types';
import { formatTime, formatScore } from '../../utils/helpers';

interface GameCardProps {
    match: ZioneMatch;
    dateLabel?: string | null;
    result?: MatchResult | null;
    onTeamClick?: (team: ZioneTeam, match: ZioneMatch) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ match, dateLabel, result, onTeamClick }) => {
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
