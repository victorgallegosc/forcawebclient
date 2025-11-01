import React from 'react';
import { ZioneResultMatch, ZioneTeam } from '../../../../sdk/src';
import { formatTime, parseScore } from '../../utils/helpers';

interface ResultCardProps {
    match: ZioneResultMatch;
    dateLabel?: string | null;
    onTeamClick?: (team: ZioneTeam, match: ZioneResultMatch) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ match, dateLabel, onTeamClick }) => {
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
