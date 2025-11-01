import React from 'react';
import { SummaryItem } from '../../types';

interface SummaryBarProps {
    items: SummaryItem[];
}

export const SummaryBar: React.FC<SummaryBarProps> = ({ items }) => {
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
