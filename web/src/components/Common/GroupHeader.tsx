import React from 'react';

interface GroupHeaderProps {
    title?: string;
    index?: number;
}

export const GroupHeader: React.FC<GroupHeaderProps> = ({ title, index }) => {
    if (!title) return null;
    
    return (
        <div className="group-header" aria-hidden>
            <div className="group-index">{typeof index === 'number' ? index + 1 : ''}</div>
            <div className="group-title">{title}</div>
        </div>
    );
};
