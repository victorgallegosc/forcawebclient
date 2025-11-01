import React, { useState, useEffect, useMemo } from 'react';
import ZioneClientFlow, {
    ZioneTeam,
    ZioneResultMatch,
    Torneo
} from '../../sdk/src';
import { TeamInfoState, TeamClickContext, DEFAULT_DTS } from './types';
import { getTeamId, isScoreValue } from './utils/helpers';
import { ModulePanel } from './components/Dashboard/ModulePanel';
import { TeamInfoDrawer } from './components/Team/TeamInfoDrawer';

export default function App() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const apiBaseFromEnv = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
    const [, setTorneos] = useState<Torneo[]>([]);
    const [selectedTorneo, setSelectedTorneo] = useState<string>('');
    const [, setTorneosLoading] = useState<boolean>(false);
    const [datos, setDatos] = useState<Record<string, any>>({});
    const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({});
    const [error, setError] = useState('');
    const [selectedModule, setSelectedModule] = useState<string>('posiciones');
    const [matchdayMatches, setMatchdayMatches] = useState<ZioneResultMatch[] | null>(null);
    const client = useMemo(() => new ZioneClientFlow(apiBaseFromEnv || undefined), [apiBaseFromEnv]);
    const [teamInfoState, setTeamInfoState] = useState<TeamInfoState>({
        open: false,
        loading: false,
        team: null,
        context: null,
        data: null,
        error: null
    });

    const closeTeamInfo = React.useCallback(() => {
        setTeamInfoState(prev => ({ ...prev, open: false }));
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (matches: boolean) => setTheme(matches ? 'dark' as const : 'light' as const);

        apply(media.matches);
        const listener = (event: MediaQueryListEvent) => apply(event.matches);
        media.addEventListener('change', listener);

        return () => media.removeEventListener('change', listener);
    }, []);

    useEffect(() => {
        const loadTorneos = async () => {
            setTorneosLoading(true);
            try {
                const response = await client.getTorneos('DTS094');
                setTorneos(response.torneos);
                const preselected = response.torneos.find(t => t.selected) || response.torneos[0];
                if (preselected) {
                    setSelectedTorneo(preselected.torID);
                }
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setError(message);
            } finally {
                setTorneosLoading(false);
            }
        };

        loadTorneos();
    }, [client]);

    useEffect(() => {
        if (!selectedTorneo) return;
        setDatos({});
        setLoadingModules({});
        setError('');
    }, [selectedTorneo]);

    const moduleNames: Record<string, string> = {
        posiciones: 'Tabla',
        rol: 'Rol',
        resultados: 'Resultados',
        goleo: 'Goleo'
    };

    const moduleIcons: Record<string, string> = {
        posiciones: 'https://img.icons8.com/?size=100&id=6yiQUAER3NXc&format=png&color=000000',
        rol: 'https://img.icons8.com/?size=100&id=m9vqEcBYERYl&format=png&color=000000',
        resultados: 'https://img.icons8.com/?size=100&id=74722&format=png&color=000000',
        goleo: 'https://img.icons8.com/?size=100&id=107644&format=png&color=000000'
    };

    const handleTeamInfoRequest = React.useCallback(async (team: ZioneTeam, context: TeamClickContext) => {
        const teamId = getTeamId(team);
        
        if (!teamId) {
            setTeamInfoState({
                open: true,
                loading: false,
                team,
                context,
                data: null,
                error: 'No se pudo identificar al equipo.'
            });
            return;
        }

        const scheduleMeta = context.scheduleMeta;
        const dtsValue = scheduleMeta?.ids?.dts || DEFAULT_DTS;

        setTeamInfoState({
            open: true,
            loading: true,
            team,
            context,
            data: null,
            error: null
        });

        try {
            if (context.source === 'team-schedule') {
                const generalSchedule = await client.getRolJuegos(dtsValue, 
                    scheduleMeta?.ids?.torID || '', 
                    scheduleMeta?.ids?.divID || '', 
                    scheduleMeta?.ids?.gpoID || '', 
                    { v: '1' }
                );
                
                let foundTeam: ZioneTeam | null = null;
                let foundTeamId: string | null = null;
                
                for (const matchday of generalSchedule.matchdays) {
                    for (const match of matchday.matches) {
                        for (const matchTeam of [match.team1, match.team2]) {
                            if (matchTeam && matchTeam.name && team.name) {
                                const teamNameMatch = 
                                    matchTeam.name.toLowerCase() === team.name.toLowerCase() ||
                                    matchTeam.name.toLowerCase().includes(team.name.toLowerCase()) ||
                                    team.name.toLowerCase().includes(matchTeam.name.toLowerCase());
                                
                                if (teamNameMatch) {
                                    foundTeam = matchTeam;
                                    foundTeamId = getTeamId(matchTeam);
                                    break;
                                }
                            }
                        }
                        if (foundTeam) break;
                    }
                    if (foundTeam) break;
                }
                
                if (foundTeam && foundTeamId) {
                    const response = await client.getTeamInfo(dtsValue, foundTeamId, {
                        torID: scheduleMeta?.ids?.torID || undefined,
                        divID: scheduleMeta?.ids?.divID || undefined,
                        gpoID: scheduleMeta?.ids?.gpoID || undefined,
                        teamName: foundTeam.name || team.name || undefined
                    });
                    
                    setTeamInfoState(prev => ({
                        ...prev,
                        loading: false,
                        data: response,
                        error: null
                    }));
                } else {
                    const response = await client.getTeamInfo(dtsValue, teamId, {
                        torID: scheduleMeta?.ids?.torID || undefined,
                        divID: scheduleMeta?.ids?.divID || undefined,
                        gpoID: scheduleMeta?.ids?.gpoID || undefined,
                        teamName: team.name || undefined
                    });
                    
                    setTeamInfoState(prev => ({
                        ...prev,
                        loading: false,
                        data: response,
                        error: null
                    }));
                }
            } else {
                const response = await client.getTeamInfo(dtsValue, teamId, {
                    torID: scheduleMeta?.ids?.torID || undefined,
                    divID: scheduleMeta?.ids?.divID || undefined,
                    gpoID: scheduleMeta?.ids?.gpoID || undefined,
                    teamName: team.name || undefined
                });

                setTeamInfoState(prev => ({
                    ...prev,
                    loading: false,
                    data: response,
                    error: null
                }));
            }
        } catch (teamError) {
            const message = teamError instanceof Error
                ? teamError.message
                : 'No se pudo cargar la información del equipo.';
            setTeamInfoState(prev => ({
                ...prev,
                loading: false,
                error: message
            }));
        }
    }, [client]);

    const handleLoadModule = async (module: string) => {
        setLoadingModules(prev => ({ ...prev, [module]: true }));
        setError('');
        const torneo = '32361';
        const division = '8555';
        const grupo = '16960';

        try {
            if (module === 'posiciones') {
                const standings = await client.getStandings('DTS094', torneo, division, grupo, { m: '2' });
                setDatos(prev => ({ ...prev, [module]: standings }));
                
                setMatchdayMatches(null);

                try {
                    const [schedule, resultados] = await Promise.all([
                        client.getRolJuegos('DTS094', torneo, division, grupo, { v: '1' }),
                        client.getResultados('DTS094', torneo, division, grupo, { m: '2', smodo: '0' })
                    ]);

                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];

                    const toResultMatch = (match: any): ZioneResultMatch => ({
                        time: match.time,
                        kickoff: match.kickoff,
                        group: match.group,
                        stage: match.stage,
                        jornada: match.jornada,
                        team1: match.team1,
                        team2: match.team2,
                        score1: null,
                        score2: null,
                        separator: 'vs',
                        status: match.status
                    });

                    let currentJornadaNumber: number | null = null;
                    
                    if (Array.isArray(schedule.matchdays)) {
                        const todayMatchday = schedule.matchdays.find(md => md.date === todayStr);
                        if (todayMatchday && todayMatchday.matches && todayMatchday.matches.length > 0) {
                            const jornadaNum = todayMatchday.matches.find(m => m.jornada?.number != null)?.jornada?.number;
                            if (jornadaNum != null) {
                                currentJornadaNumber = jornadaNum;
                            }
                        }
                        
                        if (currentJornadaNumber == null) {
                            const futureMatchdays = schedule.matchdays
                                .filter(md => md.date && md.date >= todayStr && md.matches && md.matches.length > 0)
                                .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                            
                            if (futureMatchdays.length > 0) {
                                const nextMatchday = futureMatchdays[0];
                                const jornadaNum = nextMatchday.matches?.find(m => m.jornada?.number != null)?.jornada?.number;
                                if (jornadaNum != null) {
                                    currentJornadaNumber = jornadaNum;
                                }
                            }
                        }
                    }
                    
                    if (currentJornadaNumber == null && Array.isArray(resultados.matchdays)) {
                        const matchdaysWithResults = resultados.matchdays
                            .filter(md => {
                                const matches = md.matches ?? [];
                                return matches.some(m => isScoreValue(m.score1) || isScoreValue(m.score2));
                            })
                            .map(md => {
                                const matches = md.matches ?? [];
                                const jornadaNumbers = matches
                                    .map(m => m.jornada?.number)
                                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
                                const maxJornada = jornadaNumbers.length > 0 ? Math.max(...jornadaNumbers) : null;
                                return { matchday: md, jornadaNumber: maxJornada };
                            })
                            .filter(item => item.jornadaNumber != null)
                            .sort((a, b) => (b.jornadaNumber ?? 0) - (a.jornadaNumber ?? 0));
                        
                        if (matchdaysWithResults.length > 0) {
                            currentJornadaNumber = matchdaysWithResults[0].jornadaNumber;
                        }
                    }
                    
                    const matchCandidates: ZioneResultMatch[] = [];
                    const processedKeys = new Set<string>();
                    
                    if (currentJornadaNumber != null) {
                        if (Array.isArray(resultados.matchdays)) {
                            resultados.matchdays.forEach(matchday => {
                                const matches = matchday.matches ?? [];
                                matches.forEach(match => {
                                    if (match.jornada?.number === currentJornadaNumber) {
                                        const key = `${match.team1?.name}-${match.team2?.name}-${match.jornada?.number}`;
                                        if (!processedKeys.has(key)) {
                                            processedKeys.add(key);
                                            matchCandidates.push(match);
                                        }
                                    }
                                });
                            });
                        }
                        
                        if (Array.isArray(schedule.matchdays)) {
                            schedule.matchdays.forEach(matchday => {
                                const matches = matchday.matches ?? [];
                                matches.forEach(match => {
                                    if (match.jornada?.number === currentJornadaNumber) {
                                        const key = `${match.team1?.name}-${match.team2?.name}-${match.jornada?.number}`;
                                        if (!processedKeys.has(key)) {
                                            processedKeys.add(key);
                                            matchCandidates.push(toResultMatch(match));
                                        }
                                    }
                                });
                            });
                        }
                    }

                    if (matchCandidates.length > 0) {
                        setMatchdayMatches(matchCandidates.slice(0, 8));
                    }
                } catch (scheduleError) {
                    console.error('Error loading matchday matches:', scheduleError);
                }

            } else if (module === 'rol') {
                const schedule = await client.getRolJuegos('DTS094', torneo, division, grupo, { v: '1' });
                setDatos(prev => ({ ...prev, [module]: schedule }));
            } else if (module === 'resultados') {
                const resultados = await client.getResultados('DTS094', torneo, division, grupo, { m: '2', smodo: '0' });
                setDatos(prev => ({ ...prev, [module]: resultados }));
            } else {
                let params: Record<string, string> = { module };
                if (module === 'goleo') {
                    params = { module, gpoID: grupo };
                }
                const resp = await client.getDatos('DTS094', torneo, division, grupo, params);
                if (resp?.data) {
                    setDatos(prev => ({ ...prev, [module]: resp.data }));
                }
            }
        } catch (e) {
            setError(String(e));
        }

        setLoadingModules(prev => ({ ...prev, [module]: false }));
    };

    const renderTabs = (placement: 'top' | 'bottom') => (
        <nav className={`app-tabs app-tabs-${placement}`} role="tablist" aria-label="Módulos">
            {Object.entries(moduleNames).map(([key, title]) => (
                <button
                    key={`${placement}-${key}`}
                    role="tab"
                    aria-selected={selectedModule === key}
                    tabIndex={selectedModule === key ? 0 : -1}
                    className={`tab-button${selectedModule === key ? ' is-active' : ''}`}
                    aria-label={title}
                    title={title}
                    onClick={async () => {
                        setSelectedModule(key);
                        if (!datos[key]) await handleLoadModule(key);
                    }}
                >
                    <img
                        className="tab-icon-img"
                        src={moduleIcons[key]}
                        alt=""
                        aria-hidden
                        loading="lazy"
                    />
                    <span className="tab-label">{title}</span>
                </button>
            ))}
        </nav>
    );

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-header__info">
                    <span className="brand-mark" aria-hidden>🏆</span>
                    <div>
                        <h1 className="app-title">Estadísticas Forca</h1>
                        <p className="app-subtitle">Vista rápida del torneo</p>
                    </div>
                </div>
                <button
                    className="header-action"
                    onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                    aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
            </header>

            {renderTabs('top')}

            <main className="app-main">
                {error && <div className="app-alert" role="alert">{error}</div>}
                <ModulePanel
                    title={moduleNames[selectedModule]}
                    data={datos[selectedModule] ?? null}
                    onLoad={() => handleLoadModule(selectedModule)}
                    loading={!!loadingModules[selectedModule]}
                    moduleKey={selectedModule}
                    client={client}
                    icon={moduleIcons[selectedModule]}
                    matchdayMatches={matchdayMatches}
                    onTeamClick={handleTeamInfoRequest}
                />
            </main>

            <TeamInfoDrawer state={teamInfoState} onClose={closeTeamInfo} />

            {renderTabs('bottom')}
        </div>
    );
}
