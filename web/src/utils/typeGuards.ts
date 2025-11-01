import { ZioneSchedule, ZioneResults, ZioneStandings, ModuleData } from '../../../sdk/src';

export const isScheduleData = (data: any): data is ZioneSchedule => 
    !!data && Array.isArray(data.matchdays) && Array.isArray(data.headers);

export const isResultsData = (data: any): data is ZioneResults => 
    !!data && data.type === 'results';

export const isStandingsData = (data: any): data is ZioneStandings => {
    if (!data || !Array.isArray(data.groups)) return false;
    if (!Array.isArray(data.headers)) return false;
    return data.groups.every((group: any) => Array.isArray(group.rows));
};

export const isModuleData = (data: any): data is ModuleData => 
    !!data && Array.isArray(data.tables);
