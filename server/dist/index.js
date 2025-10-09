"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cheerio_1 = require("cheerio");
const utils_1 = require("./utils");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5174;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
/**
 * GET /api/torneos?dts={DTS}
 */
app.get('/api/torneos', async (req, res) => {
    try {
        const dts = req.query.dts;
        if (!dts) {
            return res.status(400).json({ error: 'DTS parameter is required' });
        }
        const url = (0, utils_1.buildUrl)('/tab.posiciones.asp', { dts, m: 1 });
        const response = await (0, utils_1.fetchWithCookies)(url);
        if (response.status !== 200) {
            return res.status(response.status).json({
                error: 'Failed to fetch tournaments',
                details: `HTTP ${response.status}`
            });
        }
        const $ = (0, cheerio_1.load)(response.text);
        const selects = (0, utils_1.parseSelects)($);
        const torneoSelect = selects.find(s => s.name?.toLowerCase().includes('torneo') || s.name === 'fTorneo');
        if (!torneoSelect) {
            return res.status(404).json({
                error: 'Tournament select not found',
                details: 'No select element with name containing "torneo" or "fTorneo"'
            });
        }
        const torneos = torneoSelect.options
            .filter(opt => opt.value && opt.text)
            .map(opt => ({
            torID: opt.value,
            nombre: opt.text,
            selected: opt.selected
        }));
        res.json({
            source: url,
            selectName: torneoSelect.name,
            torneos
        });
    }
    catch (error) {
        console.error('Error fetching torneos:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/horarios?dts={DTS}&torID={torID}
 */
app.get('/api/horarios', async (req, res) => {
    try {
        const dts = req.query.dts;
        const torID = req.query.torID;
        if (!dts || !torID) {
            return res.status(400).json({
                error: 'DTS and torID parameters are required'
            });
        }
        let jar = { cookies: [] };
        // Step 1: Prime cookies with m=1 request
        const url1 = (0, utils_1.buildUrl)('/tab.posiciones.asp', { dts, m: 1 });
        const response1 = await (0, utils_1.fetchWithCookies)(url1, {}, jar);
        jar = response1.jar;
        if (response1.status !== 200) {
            return res.status(response1.status).json({
                error: 'Failed to prime session',
                details: `HTTP ${response1.status}`
            });
        }
        // Step 2: POST to select tournament
        const postUrl = (0, utils_1.buildUrl)('/tab.posiciones.asp', { dts, m: 1, smodo: 0 });
        const postResponse = await (0, utils_1.fetchWithCookies)(postUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': url1
            },
            body: `fTorneo=${torID}`
        }, jar);
        jar = postResponse.jar;
        if (postResponse.status !== 200) {
            return res.status(postResponse.status).json({
                error: 'Failed to select tournament',
                details: `HTTP ${postResponse.status}`
            });
        }
        // Step 3: GET m=2 to see horarios
        const url3 = (0, utils_1.buildUrl)('/tab.posiciones.asp', { dts, m: 2, smodo: 0, torID });
        const response3 = await (0, utils_1.fetchWithCookies)(url3, {
            headers: {
                'Referer': postUrl
            }
        }, jar);
        if (response3.status !== 200) {
            return res.status(response3.status).json({
                error: 'Failed to fetch horarios',
                details: `HTTP ${response3.status}`
            });
        }
        const $ = (0, cheerio_1.load)(response3.text);
        const horarios = (0, utils_1.extractHorarios)($);
        const { gpoCandidates, grupoSelectName } = (0, utils_1.parseCandidateIDsFromLinks)($);
        res.json({
            source: url3,
            horarios,
            gpoCandidates,
            grupoSelectName
        });
    }
    catch (error) {
        console.error('Error fetching horarios:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/datos?dts={DTS}&torID={torID}&divID={divID}[&gpoID={gpoID}]
 */
app.get('/api/datos', async (req, res) => {
    try {
        const dts = req.query.dts;
        const torID = req.query.torID;
        const divID = req.query.divID;
        const gpoID = req.query.gpoID;
        const module = req.query.module;
        const v = req.query.v;
        const e = req.query.e;
        if (!dts || !torID || !divID) {
            return res.status(400).json({
                error: 'DTS, torID, and divID parameters are required'
            });
        }
        let jar = { cookies: [] };
        // Session setup (same as horarios)
        const url1 = (0, utils_1.buildUrl)('/tab.posiciones.asp', { dts, m: 1 });
        const response1 = await (0, utils_1.fetchWithCookies)(url1, {}, jar);
        jar = response1.jar;
        const postUrl = (0, utils_1.buildUrl)('/tab.posiciones.asp', { dts, m: 1, smodo: 0 });
        const postResponse = await (0, utils_1.fetchWithCookies)(postUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': url1
            },
            body: `fTorneo=${torID}`
        }, jar);
        jar = postResponse.jar;
        // Helper function to fetch and parse module
        const fetchModule = async (path, params, refererOverride) => {
            // Orden de parámetros igual que HAR
            const orderedParams = {};
            if (params.m)
                orderedParams.m = params.m;
            if (params.dts)
                orderedParams.dts = params.dts;
            if (params.smodo)
                orderedParams.smodo = params.smodo;
            if (params.torID)
                orderedParams.torID = params.torID;
            if (params.divID)
                orderedParams.divID = params.divID;
            if (params.gpoID)
                orderedParams.gpoID = params.gpoID;
            if (params.v)
                orderedParams.v = params.v;
            if (params.e)
                orderedParams.e = params.e;
            const moduleUrl = (0, utils_1.buildUrl)(path, orderedParams);
            const moduleResponse = await (0, utils_1.fetchWithCookies)(moduleUrl, {
                headers: {
                    'Referer': refererOverride || postUrl,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                    'Connection': 'keep-alive',
                    'DNT': '1',
                }
            }, jar);
            if (moduleResponse.status !== 200) {
                throw new Error(`Failed to fetch ${path}: HTTP ${moduleResponse.status}`);
            }
            // Check if response is JSON
            const contentType = moduleResponse.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                return {
                    url: moduleUrl,
                    tablesCount: 0,
                    tables: [JSON.parse(moduleResponse.text)]
                };
            }
            // Parse HTML tables
            const $ = (0, cheerio_1.load)(moduleResponse.text);
            const tables = [];
            $('table').each((index, tableEl) => {
                const table = (0, utils_1.tableToJson)($, tableEl, index);
                if (!table || table.rows.length === 0)
                    return;
                // Helper: normalize strings for comparison
                const normalize = (s) => String(s || '').toLowerCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');
                // Filter out rows that look like duplicated header rows (more robust check)
                const filteredRows = [];
                const headerNorm = (table.headers || []).map(h => normalize(h));
                for (const r of table.rows) {
                    // Detect rows where the same non-empty text is repeated across all columns
                    // (some pages render group markers by repeating the label across the row)
                    try {
                        const vals = Object.values(r || {}).map(v => String(v || '').trim()).filter(v => v !== '');
                        if (vals.length > 0) {
                            const allSame = vals.every(v => v === vals[0]);
                            if (allSame && /grupo|tabla posiciones|etapa/i.test(vals[0])) {
                                // replace row with a normalized Grupo marker object
                                const grp = { Grupo: vals[0] };
                                filteredRows.push(grp);
                                continue;
                            }
                        }
                    }
                    catch (e) {
                        // ignore and fall back to normal processing
                    }
                    // If row is a single Grupo marker, keep for now (we'll use it to split)
                    const keys = Object.keys(r || {});
                    if (keys.length === 1 && /grupo/i.test(keys[0])) {
                        filteredRows.push(r);
                        continue;
                    }
                    // Count matches between cell values and header labels
                    let matches = 0;
                    let nonEmpty = 0;
                    for (let i = 0; i < headerNorm.length; i++) {
                        const headerKey = headerNorm[i];
                        const cellVal = normalize((r[table.headers[i]] ?? r[Object.keys(r)[i]] ?? ''));
                        if (cellVal)
                            nonEmpty++;
                        if (headerKey && cellVal && headerKey === cellVal)
                            matches++;
                    }
                    // If more than half non-empty cells equal header labels, skip this row
                    if (nonEmpty > 0 && matches >= Math.max(1, Math.floor(nonEmpty * 0.5))) {
                        continue; // skip duplicated header-like row
                    }
                    filteredRows.push(r);
                }
                // If filteredRows contain Grupo-only rows, split into multiple TablaParsed entries
                const hasGrupo = filteredRows.some(r => Object.keys(r || {}).length === 1 && /grupo/i.test(Object.keys(r || {})[0]));
                if (hasGrupo) {
                    let currentRows = [];
                    let currentTitle = null;
                    for (const r of filteredRows) {
                        const keys = Object.keys(r || {});
                        if (keys.length === 1 && /grupo/i.test(keys[0])) {
                            // push previous segment as a table
                            if (currentRows.length > 0 && currentTitle) {
                                const metaWithTitle = { ...table.meta, title: currentTitle };
                                tables.push({ meta: metaWithTitle, headers: table.headers, rows: currentRows });
                            }
                            // start new segment (ignore footer-like group titles)
                            const rawVal = String(r[keys[0]] || '');
                            const val = rawVal.toLowerCase();
                            if (/tabla posiciones|tabla posiciones etapa/i.test(val)) {
                                currentRows = [];
                                currentTitle = null;
                                continue;
                            }
                            // set the new currentTitle from the Grupo marker (preserve original casing)
                            currentTitle = rawVal;
                            currentRows = [];
                        }
                        else {
                            currentRows.push(r);
                        }
                    }
                    if (currentRows.length > 0 && currentTitle) {
                        const metaWithTitle = { ...table.meta, title: currentTitle };
                        tables.push({ meta: metaWithTitle, headers: table.headers, rows: currentRows });
                    }
                }
                else {
                    // no Grupo markers -> keep whole table as is
                    tables.push({ meta: table.meta, headers: table.headers, rows: filteredRows });
                }
            });
            return {
                url: moduleUrl,
                tablesCount: tables.length,
                tables
            };
        };
        // Map module name to endpoint and params (según HAR/script)
        const moduleMap = {
            posiciones: {
                path: '/tab.posiciones.asp',
                params: base => ({ ...base, m: '2', smodo: 0 })
            },
            rol: {
                path: '/rol.juegos.asp',
                // Siempre usar los params correctos para rol de juegos
                params: base => ({
                    ...base,
                    m: '2',
                    smodo: 0,
                    v: 1,
                    gpoID: '16960',
                    torID: '32361',
                    divID: '8555',
                    dts: 'DTS094'
                })
            },
            resultados: {
                path: '/tab.resultados.asp',
                params: base => ({ ...base, m: '2', smodo: 0 })
            },
            goleo: {
                path: '/tab.scoreind.asp',
                params: base => ({ ...base, m: '2' })
            },
            defofe: {
                path: '/tab.defofe.asp',
                params: base => ({ ...base, m: '2' })
            },
            tarjetas: {
                path: '/tab.tarjetas.asp',
                params: base => ({ ...base, m: '2' })
            },
            castigados: {
                path: '/tab.castigados.asp',
                params: base => ({ ...base, m: '2' })
            },
            concentrado: {
                path: '/tab.concentrado.asp',
                params: base => ({ ...base, m: '2' })
            }
        };
        // Build base params
        const baseParams = {
            dts, torID, divID, gpoID
        };
        if (v)
            baseParams.v = v;
        if (e)
            baseParams.e = e;
        // Si se pide solo un módulo
        if (module && moduleMap[module]) {
            const mod = moduleMap[module];
            const data = await fetchModule(mod.path, mod.params(baseParams));
            return res.json({
                params: { dts, torID, divID, gpoID, module, v, e },
                data
            });
        }
        // Si se piden todos los módulos
        const modules = {
            posiciones: await fetchModule(moduleMap['posiciones'].path, moduleMap['posiciones'].params(baseParams)),
            rol: await fetchModule(moduleMap['rol'].path, moduleMap['rol'].params(baseParams)),
            resultados: await fetchModule(moduleMap['resultados'].path, moduleMap['resultados'].params(baseParams)),
            goleo: await fetchModule(moduleMap['goleo'].path, moduleMap['goleo'].params(baseParams)),
            defofe: await fetchModule(moduleMap['defofe'].path, moduleMap['defofe'].params(baseParams)),
            tarjetas: await fetchModule(moduleMap['tarjetas'].path, moduleMap['tarjetas'].params(baseParams)),
            castigados: await fetchModule(moduleMap['castigados'].path, moduleMap['castigados'].params(baseParams)),
            concentrado: await fetchModule(moduleMap['concentrado'].path, moduleMap['concentrado'].params(baseParams))
        };
        res.json({
            params: { dts, torID, divID, gpoID },
            modules
        });
    }
    catch (error) {
        console.error('Error fetching datos:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/team-info', async (req, res) => {
    try {
        const dts = req.query.dts;
        const teamId = req.query.teamId;
        const teamName = req.query.teamName;
        const m = req.query.m || '1';
        const torID = req.query.torID;
        const divID = req.query.divID;
        const gpoID = req.query.gpoID;
        if (!dts || !teamId) {
            return res.status(400).json({ error: 'Parameters dts and teamId are required' });
        }
        // Use fresh cookies for each team info request to avoid session conflicts
        let jar = { cookies: [] };
        // Clear any existing session by going to a neutral page
        const neutralUrl = (0, utils_1.buildUrl)('/', { dts });
        await (0, utils_1.fetchWithCookies)(neutralUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'DNT': '1',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
            }
        }, jar);
        const buildTeamUrl = (section) => (0, utils_1.buildUrl)('/info.equipo.asp', { dts, m: section, e: teamId });
        let teamUrl = buildTeamUrl(m || '1');
        // Add a small delay to avoid potential rate limiting or session conflicts
        await new Promise(resolve => setTimeout(resolve, 100));
        let teamResponse = await (0, utils_1.fetchWithCookies)(teamUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'DNT': '1',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
            }
        }, jar);
        if (teamResponse.status !== 200 && m !== '1') {
            // Retry with the default section (m=1) when an alternative section fails
            teamUrl = buildTeamUrl('1');
            teamResponse = await (0, utils_1.fetchWithCookies)(teamUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'DNT': '1',
                    'Pragma': 'no-cache',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
                }
            }, jar);
        }
        if (teamResponse.status !== 200) {
            return res.status(teamResponse.status).json({
                error: 'Failed to fetch team page',
                details: `HTTP ${teamResponse.status}`
            });
        }
        const $ = (0, cheerio_1.load)(teamResponse.text);
        // Extract the team name from the page to verify we got the right page
        const pageTeamName = $('.enc-seccion span').first().text().trim();
        // Check if we got the wrong team due to Zione ID mapping issues
        const isWrongTeam = teamName && pageTeamName &&
            !pageTeamName.toLowerCase().includes(teamName.toLowerCase()) &&
            !teamName.toLowerCase().includes(pageTeamName.toLowerCase());
        if (isWrongTeam) {
            // Try to find the team by searching in standings
            if (torID && divID) {
                try {
                    const standingsUrl = (0, utils_1.buildUrl)('/tab.posiciones.asp', {
                        dts,
                        m: 2,
                        smodo: 0,
                        torID,
                        divID,
                        gpoID
                    });
                    const standingsResponse = await (0, utils_1.fetchWithCookies)(standingsUrl, {}, jar);
                    if (standingsResponse.status === 200) {
                        const $$ = (0, cheerio_1.load)(standingsResponse.text);
                        const standings = (0, utils_1.parseZioneStandings)($$);
                        // Find the correct team in standings
                        let correctTeamId = null;
                        outerLoop: for (const group of standings.groups) {
                            for (const row of group.rows) {
                                const teamNameInStandings = row.Equipo?.name?.trim() || '';
                                if (teamNameInStandings.toLowerCase().includes(teamName.toLowerCase()) ||
                                    teamName.toLowerCase().includes(teamNameInStandings.toLowerCase())) {
                                    const href = row.Equipo?.href || '';
                                    const match = href.match(/e=(\d+)/i);
                                    if (match) {
                                        correctTeamId = match[1];
                                        break outerLoop;
                                    }
                                }
                            }
                        }
                        // If we found the correct ID, try again with that ID
                        if (correctTeamId && correctTeamId !== teamId) {
                            const correctUrl = (0, utils_1.buildUrl)('/info.equipo.asp', { dts, m: '1', e: correctTeamId });
                            const correctResponse = await (0, utils_1.fetchWithCookies)(correctUrl, {
                                headers: {
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                                    'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                                    'Cache-Control': 'no-cache',
                                    'Connection': 'keep-alive',
                                    'DNT': '1',
                                    'Pragma': 'no-cache',
                                    'Upgrade-Insecure-Requests': '1',
                                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
                                }
                            }, jar);
                            if (correctResponse.status === 200) {
                                teamResponse = correctResponse;
                                teamUrl = correctUrl;
                            }
                        }
                    }
                }
                catch (searchError) {
                    // Continue with original response if search fails
                }
            }
        }
        const teamInfo = (0, utils_1.parseTeamInfo)($, teamId, teamUrl);
        let standingsSummary = null;
        if (torID && divID) {
            try {
                const standingsUrl = (0, utils_1.buildUrl)('/tab.posiciones.asp', {
                    dts,
                    m: 2,
                    smodo: 0,
                    torID,
                    divID,
                    gpoID
                });
                const standingsResponse = await (0, utils_1.fetchWithCookies)(standingsUrl, {}, jar);
                if (standingsResponse.status === 200) {
                    const $$ = (0, cheerio_1.load)(standingsResponse.text);
                    const standings = (0, utils_1.parseZioneStandings)($$);
                    outer: for (const group of standings.groups) {
                        for (const row of group.rows) {
                            const href = row.Equipo?.href || '';
                            const match = href.match(/e=(\d+)/i);
                            if ((match && match[1] === teamId) || row.Equipo?.name?.trim().toLowerCase() === teamInfo.meta.name?.trim().toLowerCase()) {
                                standingsSummary = { group: group.group, row };
                                break outer;
                            }
                        }
                    }
                }
            }
            catch (standingsError) {
                console.warn('Failed to enrich team info with standings', standingsError);
            }
        }
        const response = {
            team: teamInfo,
            standings: standingsSummary
        };
        res.json(response);
    }
    catch (error) {
        console.error('Error fetching team info:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// New endpoint specifically for parsing Zione schedule (Rol de Juegos) with proper structure
app.get('/api/rol-juegos-parsed/:dts', async (req, res) => {
    try {
        const { dts } = req.params;
        const { m = '2', torID = '', divID = '', gpoID = '', v = '1' } = req.query;
        if (!dts) {
            return res.status(400).json({ error: 'DTS parameter is required' });
        }
        // Build URL for schedule
        const url = (0, utils_1.buildUrl)('/rol.juegos.asp', {
            dts,
            m,
            ...(torID && { torID }),
            ...(divID && { divID }),
            ...(gpoID && { gpoID }),
            ...(v && { v })
        });
        let jar = { cookies: [] };
        // Fetch the schedule page
        const response = await (0, utils_1.fetchWithCookies)(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
                'DNT': '1',
            }
        }, jar);
        jar = response.jar;
        if (response.status !== 200) {
            return res.status(response.status).json({
                error: `Failed to fetch schedule: HTTP ${response.status}`
            });
        }
        // Parse with Cheerio and use the new Zione schedule parser
        const $ = (0, cheerio_1.load)(response.text);
        const schedule = (0, utils_1.parseZioneSchedule)($);
        // Attempt to fetch "Rol por Equipo" list for quick access
        try {
            const teamUrl = (0, utils_1.buildUrl)('/rol.juegos.asp', {
                dts,
                m: 3,
                smodo: 0,
                v: 2,
                torID,
                divID,
                gpoID
            });
            const teamsResponse = await (0, utils_1.fetchWithCookies)(teamUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                    'Connection': 'keep-alive',
                    'DNT': '1',
                    'Referer': url
                }
            }, jar);
            jar = teamsResponse.jar;
            if (teamsResponse.status === 200) {
                const $$ = (0, cheerio_1.load)(teamsResponse.text);
                schedule.teamsByClub = (0, utils_1.parseZioneScheduleTeams)($$) || undefined;
            }
        }
        catch (err) {
            console.warn('Failed to fetch teams by club for rol de juegos:', err);
        }
        res.json(schedule);
    }
    catch (error) {
        console.error('Error fetching rol-juegos-parsed:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/rol-juegos-equipo/:dts/:teamId', async (req, res) => {
    try {
        const { dts, teamId } = req.params;
        const { torID = '', divID = '', gpoID = '', v = '2' } = req.query;
        if (!dts || !teamId || !torID || !divID) {
            return res.status(400).json({
                error: 'Se requieren los parámetros dts, teamId, torID y divID'
            });
        }
        let jar = { cookies: [] };
        const teamUrl = (0, utils_1.buildUrl)('/rol.juegos.asp', {
            dts,
            m: 4,
            v,
            smodo: 0,
            e: teamId,
            torID,
            divID,
            gpoID
        });
        const response = await (0, utils_1.fetchWithCookies)(teamUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
                'DNT': '1'
            }
        }, jar);
        if (response.status !== 200) {
            return res.status(response.status).json({
                error: `Failed to fetch team schedule: HTTP ${response.status}`
            });
        }
        const $ = (0, cheerio_1.load)(response.text);
        const teamHeading = $('.box-seccion h2 a').first().text().trim()
            || $('.box-seccion h2').first().text().trim()
            || null;
        const schedule = (0, utils_1.parseZioneTeamSchedule)($, { teamName: teamHeading, teamId, dts });
        console.log(`Fetched schedule for team ${teamId} from ${teamUrl}`);
        res.json(schedule);
    }
    catch (error) {
        console.error('Error fetching rol-juegos-equipo:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api/resultados-parsed/:dts', async (req, res) => {
    try {
        const { dts } = req.params;
        const { torID = '', divID = '', gpoID = '', m = '2', v = '', smodo = '0' } = req.query;
        if (!dts || !torID || !divID) {
            return res.status(400).json({
                error: 'Se requieren los parámetros dts, torID y divID'
            });
        }
        let jar = { cookies: [] };
        const url = (0, utils_1.buildUrl)('/tab.resultados.asp', {
            dts,
            m,
            smodo,
            v,
            torID,
            divID,
            gpoID
        });
        const response = await (0, utils_1.fetchWithCookies)(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
                'DNT': '1'
            }
        }, jar);
        if (response.status !== 200) {
            return res.status(response.status).json({
                error: `Failed to fetch resultados: HTTP ${response.status}`
            });
        }
        const $ = (0, cheerio_1.load)(response.text);
        const parsed = (0, utils_1.parseZioneResults)($);
        res.json(parsed);
    }
    catch (error) {
        console.error('Error fetching resultados-parsed:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// New endpoint specifically for parsing Zione standings with proper structure
app.get('/api/posiciones-parsed/:dts', async (req, res) => {
    try {
        const { dts } = req.params;
        const { m = '2', torID = '', divID = '', gpoID = '' } = req.query;
        if (!dts) {
            return res.status(400).json({ error: 'DTS parameter is required' });
        }
        // Build URL for standings
        const url = (0, utils_1.buildUrl)('/tab.posiciones.asp', {
            dts,
            m,
            ...(torID && { torID }),
            ...(divID && { divID }),
            ...(gpoID && { gpoID })
        });
        // Fetch the standings page
        const response = await (0, utils_1.fetchWithCookies)(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'es-MX,es-419;q=0.9,es;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
                'DNT': '1',
            }
        });
        if (response.status !== 200) {
            return res.status(response.status).json({
                error: `Failed to fetch standings: HTTP ${response.status}`
            });
        }
        // Parse with Cheerio and use the new Zione standings parser
        const $ = (0, cheerio_1.load)(response.text);
        const standings = (0, utils_1.parseZioneStandings)($);
        res.json(standings);
    }
    catch (error) {
        console.error('Error fetching posiciones-parsed:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
if (process.env.NETLIFY !== 'true') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map