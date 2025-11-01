import React from 'react';
import { ZioneTeamMatchSummary } from '../../../../sdk/src';

interface TeamMatchesListProps {
    title: string;
    items: ZioneTeamMatchSummary[];
}

export const TeamMatchesList: React.FC<TeamMatchesListProps> = ({ title, items }) => {
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
