import React from 'react';
import ZioneClientFlow, { ZioneTeam, ZioneResultMatch } from '../../../../sdk/src';
import { TeamClickContext } from '../../types';
import { isScheduleData, isResultsData, isStandingsData, isModuleData } from '../../utils/typeGuards';
import { ScheduleRenderer } from '../Views/ScheduleRenderer';
import { ResultsRenderer } from '../Views/ResultsRenderer';
import { StandingsRenderer } from '../Views/StandingsRenderer';
import { ModuleDataRenderer } from '../Views/ModuleDataRenderer';

interface ModulePanelProps {
    title: string;
    data: any;
    onLoad: () => void;
    loading: boolean;
    moduleKey?: string;
    client: ZioneClientFlow;
    icon?: string;
    matchdayMatches?: ZioneResultMatch[] | null;
    onTeamClick?: (team: ZioneTeam, context: TeamClickContext) => void;
}

export const ModulePanel: React.FC<ModulePanelProps> = ({ 
    title, 
    data, 
    onLoad, 
    loading, 
    moduleKey, 
    client, 
    icon, 
    matchdayMatches, 
    onTeamClick 
}) => {
    React.useEffect(() => { 
        if (!data && !loading) onLoad(); 
    }, [data, loading, onLoad]);

    const scheduleData = moduleKey === 'rol' && isScheduleData(data) ? data : null;
    const resultsData = moduleKey === 'resultados' && isResultsData(data) ? data : null;
    const standingsData = moduleKey === 'posiciones' && isStandingsData(data) ? data : null;
    const tableData = !scheduleData && !resultsData && !standingsData && isModuleData(data) ? data : null;

    const showModuleHeader = !scheduleData && !resultsData && !standingsData;

    return (
        <section className={`module${showModuleHeader ? '' : ' module-no-header'}`}>
            {showModuleHeader && (
                <header className="module-header">
                    {icon && <img className="module-header-icon" src={icon} alt="" aria-hidden loading="lazy" />}
                    <span className="module-title">{title}</span>
                </header>
            )}
            <div className="module-content">
                {loading && <div className="loading">Cargando {title}...</div>}
                {!loading && !data && <div className="empty-state">No hay datos</div>}
                {!loading && scheduleData && (
                    <ScheduleRenderer
                        schedule={scheduleData}
                        client={client}
                        moduleLabel={title}
                        moduleIcon={icon}
                        onTeamClick={onTeamClick}
                    />
                )}
                {!loading && !scheduleData && resultsData && (
                    <ResultsRenderer
                        results={resultsData}
                        moduleLabel={title}
                        moduleIcon={icon}
                        onTeamClick={onTeamClick}
                    />
                )}
                {!loading && !scheduleData && !resultsData && standingsData && (
                    <StandingsRenderer
                        standings={standingsData}
                        moduleLabel={title}
                        moduleIcon={icon}
                        matchdayMatches={matchdayMatches}
                        onTeamClick={onTeamClick}
                    />
                )}
                {!loading && !scheduleData && !resultsData && tableData && (
                    <ModuleDataRenderer moduleKey={moduleKey || ''} data={tableData} />
                )}
                {!loading && data && !scheduleData && !resultsData && !tableData && moduleKey !== 'posiciones' && (
                    <div className="empty-state">Formato de datos desconocido.</div>
                )}
            </div>
        </section>
    );
};
