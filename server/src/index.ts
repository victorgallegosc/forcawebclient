import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { load } from 'cheerio';
import {
  buildUrl,
  fetchWithCookies,
  tableToJson,
  parseZioneStandings,
  parseZioneSchedule,
  parseZioneScheduleTeams,
  parseZioneResults,
  parseSelects,
  extractHorarios,
  parseCandidateIDsFromLinks,
  parseTeamInfo,
  parseZioneTeamSchedule,
  CookieJar,
  TablaParsed,
  ZioneTeamInfo,
  ZioneRow
} from './utils';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json());

// Types for API responses
interface Torneo {
  torID: string;
  nombre: string;
  selected?: boolean;
}

interface Horario {
  divID: string;
  label: string;
  selected?: boolean;
}

interface ModuleData {
  url: string;
  tablesCount: number;
  tables: TablaParsed[];
}

interface DatosModules {
  posiciones: ModuleData;
  rol: ModuleData;
  resultados: ModuleData;
  goleo: ModuleData;
  defofe: ModuleData;
  tarjetas: ModuleData;
  castigados: ModuleData;
  concentrado: ModuleData;
}

/**
 * GET /api/torneos?dts={DTS}
 */
app.get('/api/torneos', async (req, res) => {
  try {
    const dts = req.query.dts as string;
    if (!dts) {
      return res.status(400).json({ error: 'DTS parameter is required' });
    }

    const url = buildUrl('/tab.posiciones.asp', { dts, m: 1 });
    const response = await fetchWithCookies(url);

    if (response.status !== 200) {
      return res.status(response.status).json({
        error: 'Failed to fetch tournaments',
        details: `HTTP ${response.status}`
      });
    }

    const $ = load(response.text);
    const selects = parseSelects($);
    
    const torneoSelect = selects.find(s => 
      s.name?.toLowerCase().includes('torneo') || s.name === 'fTorneo'
    );

    if (!torneoSelect) {
      return res.status(404).json({
        error: 'Tournament select not found',
        details: 'No select element with name containing "torneo" or "fTorneo"'
      });
    }

    const torneos: Torneo[] = torneoSelect.options
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
  } catch (error) {
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
    const dts = req.query.dts as string;
    const torID = req.query.torID as string;

    if (!dts || !torID) {
      return res.status(400).json({
        error: 'DTS and torID parameters are required'
      });
    }

    let jar: CookieJar = { cookies: [] };

    // Step 1: Prime cookies with m=1 request
    const url1 = buildUrl('/tab.posiciones.asp', { dts, m: 1 });
    const response1 = await fetchWithCookies(url1, {}, jar);
    jar = response1.jar;

    if (response1.status !== 200) {
      return res.status(response1.status).json({
        error: 'Failed to prime session',
        details: `HTTP ${response1.status}`
      });
    }

    // Step 2: POST to select tournament
    const postUrl = buildUrl('/tab.posiciones.asp', { dts, m: 1, smodo: 0 });
    const postResponse = await fetchWithCookies(postUrl, {
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
    const url3 = buildUrl('/tab.posiciones.asp', { dts, m: 2, smodo: 0, torID });
    const response3 = await fetchWithCookies(url3, {
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

    const $ = load(response3.text);
    const horarios = extractHorarios($);
    const { gpoCandidates, grupoSelectName } = parseCandidateIDsFromLinks($);

    res.json({
      source: url3,
      horarios,
      gpoCandidates,
      grupoSelectName
    });
  } catch (error) {
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
    const dts = req.query.dts as string;
    const torID = req.query.torID as string;
    const divID = req.query.divID as string;
    const gpoID = req.query.gpoID as string | undefined;
    const module = req.query.module as string | undefined;
    const v = req.query.v as string | undefined;
    const e = req.query.e as string | undefined;

    if (!dts || !torID || !divID) {
      return res.status(400).json({
        error: 'DTS, torID, and divID parameters are required'
      });
    }

    let jar: CookieJar = { cookies: [] };

    // Session setup (same as horarios)
    const url1 = buildUrl('/tab.posiciones.asp', { dts, m: 1 });
    const response1 = await fetchWithCookies(url1, {}, jar);
    jar = response1.jar;

    const postUrl = buildUrl('/tab.posiciones.asp', { dts, m: 1, smodo: 0 });
    const postResponse = await fetchWithCookies(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url1
      },
      body: `fTorneo=${torID}`
    }, jar);
    jar = postResponse.jar;

    // Helper function to fetch and parse module
    const fetchModule = async (
      path: string,
      params: Record<string, string | number | undefined>,
      refererOverride?: string
    ): Promise<ModuleData> => {
      // Orden de parámetros igual que HAR
      const orderedParams: Record<string, string | number | undefined> = {};
      if (params.m) orderedParams.m = params.m;
      if (params.dts) orderedParams.dts = params.dts;
      if (params.smodo) orderedParams.smodo = params.smodo;
      if (params.torID) orderedParams.torID = params.torID;
      if (params.divID) orderedParams.divID = params.divID;
      if (params.gpoID) orderedParams.gpoID = params.gpoID;
      if (params.v) orderedParams.v = params.v;
      if (params.e) orderedParams.e = params.e;
      const moduleUrl = buildUrl(path, orderedParams);
      const moduleResponse = await fetchWithCookies(moduleUrl, {
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
      const contentType = moduleResponse.headers['content-type'] as string || '';
      if (contentType.includes('application/json')) {
        return {
          url: moduleUrl,
          tablesCount: 0,
          tables: [JSON.parse(moduleResponse.text)]
        };
      }

      // Parse HTML tables
      const $ = load(moduleResponse.text);
      const tables: TablaParsed[] = [];
      $('table').each((index, tableEl) => {
        const table = tableToJson($, tableEl, index);
        if (!table || table.rows.length === 0) return;

        // Helper: normalize strings for comparison
        const normalize = (s: any) => String(s || '').toLowerCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');

        // Filter out rows that look like duplicated header rows (more robust check)
        const filteredRows: Record<string,string>[] = [];
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
                const grp = { Grupo: vals[0] } as any;
                filteredRows.push(grp);
                continue;
              }
            }
          } catch (e) {
            // ignore and fall back to normal processing
          }

          // If row is a single Grupo marker, keep for now (we'll use it to split)
          const keys = Object.keys(r || {});
          if (keys.length === 1 && /grupo/i.test(keys[0])) {
            filteredRows.push(r as any);
            continue;
          }

          // Count matches between cell values and header labels
          let matches = 0; let nonEmpty = 0;
          for (let i = 0; i < headerNorm.length; i++) {
            const headerKey = headerNorm[i];
            const cellVal = normalize((r[table.headers[i]] ?? r[Object.keys(r)[i]] ?? ''));
            if (cellVal) nonEmpty++;
            if (headerKey && cellVal && headerKey === cellVal) matches++;
          }
          // If more than half non-empty cells equal header labels, skip this row
          if (nonEmpty > 0 && matches >= Math.max(1, Math.floor(nonEmpty * 0.5))) {
            continue; // skip duplicated header-like row
          }

          filteredRows.push(r as any);
        }

        // If filteredRows contain Grupo-only rows, split into multiple TablaParsed entries
        const hasGrupo = filteredRows.some(r => Object.keys(r || {}).length === 1 && /grupo/i.test(Object.keys(r || {})[0]));
        if (hasGrupo) {
            let currentRows: Record<string,string>[] = [];
            let currentTitle: string | null = null;
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
              } else {
                currentRows.push(r as any);
              }
            }
            if (currentRows.length > 0 && currentTitle) {
              const metaWithTitle = { ...table.meta, title: currentTitle };
              tables.push({ meta: metaWithTitle, headers: table.headers, rows: currentRows });
            }
        } else {
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
    const moduleMap: Record<string, { path: string; params: (base: any) => any }> = {
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
    const baseParams: Record<string, string | number | undefined> = {
      dts, torID, divID, gpoID
    };
    if (v) baseParams.v = v;
    if (e) baseParams.e = e;

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
    const modules: DatosModules = {
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
  } catch (error) {
    console.error('Error fetching datos:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/team-info', async (req, res) => {
  try {
    const dts = req.query.dts as string;
    const teamId = req.query.teamId as string;
    const m = (req.query.m as string) || '1';
    const torID = req.query.torID as string | undefined;
    const divID = req.query.divID as string | undefined;
    const gpoID = req.query.gpoID as string | undefined;

    if (!dts || !teamId) {
      return res.status(400).json({ error: 'Parameters dts and teamId are required' });
    }

    const buildTeamUrl = (section: string) => buildUrl('/info.equipo.asp', { dts, m: section, e: teamId });

    let teamUrl = buildTeamUrl(m || '1');
    let teamResponse = await fetchWithCookies(teamUrl);

    if (teamResponse.status !== 200 && m !== '1') {
      // Retry with the default section (m=1) when an alternative section fails
      teamUrl = buildTeamUrl('1');
      teamResponse = await fetchWithCookies(teamUrl);
    }

    if (teamResponse.status !== 200) {
      return res.status(teamResponse.status).json({
        error: 'Failed to fetch team page',
        details: `HTTP ${teamResponse.status}`
      });
    }

    const $ = load(teamResponse.text);
    const teamInfo: ZioneTeamInfo = parseTeamInfo($, teamId, teamUrl);

    interface StandingsSummary {
      group: string;
      row: ZioneRow;
    }

    let standingsSummary: StandingsSummary | null = null;

    if (torID && divID) {
      try {
        const standingsUrl = buildUrl('/tab.posiciones.asp', {
          dts,
          m: 2,
          smodo: 0,
          torID,
          divID,
          gpoID
        });

        const standingsResponse = await fetchWithCookies(standingsUrl);
        if (standingsResponse.status === 200) {
          const $$ = load(standingsResponse.text);
          const standings = parseZioneStandings($$);
          outer:
          for (const group of standings.groups) {
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
      } catch (standingsError) {
        console.warn('Failed to enrich team info with standings', standingsError);
      }
    }

    res.json({
      team: teamInfo,
      standings: standingsSummary
    });
  } catch (error) {
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
    const { m = '2', torID = '', divID = '', gpoID = '', v = '1' } = req.query as Record<string, string>;

    if (!dts) {
      return res.status(400).json({ error: 'DTS parameter is required' });
    }

    // Build URL for schedule
    const url = buildUrl('/rol.juegos.asp', { 
      dts, 
      m, 
      ...(torID && { torID }),
      ...(divID && { divID }),
      ...(gpoID && { gpoID }),
      ...(v && { v })
    });

    let jar: CookieJar = { cookies: [] };

    // Fetch the schedule page
    const response = await fetchWithCookies(url, {
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
    const $ = load(response.text);
    const schedule = parseZioneSchedule($);

    // Attempt to fetch "Rol por Equipo" list for quick access
    try {
      const teamUrl = buildUrl('/rol.juegos.asp', {
        dts,
        m: 3,
        smodo: 0,
        v: 2,
        torID,
        divID,
        gpoID
      });

      const teamsResponse = await fetchWithCookies(teamUrl, {
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
        const $$ = load(teamsResponse.text);
        schedule.teamsByClub = parseZioneScheduleTeams($$) || undefined;
      }
    } catch (err) {
      console.warn('Failed to fetch teams by club for rol de juegos:', err);
    }

    res.json(schedule);

  } catch (error) {
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
    const { torID = '', divID = '', gpoID = '', v = '2' } = req.query as Record<string, string>;

    if (!dts || !teamId || !torID || !divID) {
      return res.status(400).json({
        error: 'Se requieren los parámetros dts, teamId, torID y divID'
      });
    }

    let jar: CookieJar = { cookies: [] };

    const teamUrl = buildUrl('/rol.juegos.asp', {
      dts,
      m: 4,
      v,
      smodo: 0,
      e: teamId,
      torID,
      divID,
      gpoID
    });

    const response = await fetchWithCookies(teamUrl, {
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

    const $ = load(response.text);
    const teamHeading = $('.box-seccion h2 a').first().text().trim()
      || $('.box-seccion h2').first().text().trim()
      || null;

    const schedule = parseZioneTeamSchedule($, { teamName: teamHeading, teamId, dts });

    console.log(`Fetched schedule for team ${teamId} from ${teamUrl}`);
    res.json(schedule);
  } catch (error) {
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
    const { torID = '', divID = '', gpoID = '', m = '2', v = '', smodo = '0' } = req.query as Record<string, string>;

    if (!dts || !torID || !divID) {
      return res.status(400).json({
        error: 'Se requieren los parámetros dts, torID y divID'
      });
    }

    let jar: CookieJar = { cookies: [] };

    const url = buildUrl('/tab.resultados.asp', {
      dts,
      m,
      smodo,
      v,
      torID,
      divID,
      gpoID
    });

    const response = await fetchWithCookies(url, {
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

    const $ = load(response.text);
    const parsed = parseZioneResults($);

    res.json(parsed);
  } catch (error) {
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
    const { m = '2', torID = '', divID = '', gpoID = '' } = req.query as Record<string, string>;

    if (!dts) {
      return res.status(400).json({ error: 'DTS parameter is required' });
    }

    // Build URL for standings
    const url = buildUrl('/tab.posiciones.asp', { 
      dts, 
      m, 
      ...(torID && { torID }),
      ...(divID && { divID }),
      ...(gpoID && { gpoID })
    });

    // Fetch the standings page
    const response = await fetchWithCookies(url, {
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
    const $ = load(response.text);
    const standings = parseZioneStandings($);

    res.json(standings);

  } catch (error) {
    console.error('Error fetching posiciones-parsed:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
