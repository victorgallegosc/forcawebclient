import React from 'react';
import { ModuleData } from '../../../../sdk/src';
import { DataTable } from '../Common/DataTable';
import { GroupHeader } from '../Common/GroupHeader';
import { organizeModuleData } from '../../utils/dataOrganizer';

interface ModuleDataRendererProps {
    moduleKey: string;
    data: ModuleData;
}

export const ModuleDataRenderer: React.FC<ModuleDataRendererProps> = ({ moduleKey, data }) => {
    const groups = organizeModuleData(moduleKey, data);
    
    return (
        <div>
            {groups.map((g, gi) => {
                // Always use meta.title if present, fallback to group title otherwise
                let displayTitle = (g.tables.length > 0 && g.tables[0].meta && g.tables[0].meta.title)
                    ? g.tables[0].meta.title
                    : (g.title || '');
                return (
                    <div key={gi} className="module-group">
                        <GroupHeader title={displayTitle} index={gi} />
                        <div className="group-tables">
                            {g.tables.map((t, ti) => <DataTable key={ti} table={t} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
