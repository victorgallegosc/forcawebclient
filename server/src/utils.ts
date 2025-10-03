import { request } from 'undici';
import { CheerioAPI } from 'cheerio';
import iconv from 'iconv-lite';

export interface TablaMeta {
  index: number;
  id: string | null;
  className: string | null;
  title: string | null;
}

export interface TablaParsed {
  meta: TablaMeta;
  headers: string[];
  rows: Record<string, string>[];
}

// New interfaces for Zione standings parser
export interface ZioneMeta {
  title: string | null;
  subtitle: string | null;
  etapa: string | null;
  source_url: string | null;
  dts: string | null;
  m: string | null;
  torID: string | null;
  divID: string | null;
  gpoID: string | null;
}

export interface ZioneEquipo {
  name: string;
  href: string | null;
  img: string | null;
}

export interface ZioneRow {
  Lugar: number | null;
  Equipo: ZioneEquipo;
  JJ: number | null;
  JG: number | null;
  JE: number | null;
  EG: number | null;
  EP: number | null;
  JP: number | null;
  GF: number | null;
  GC: number | null;
  Dif: number | null;
  PA: number | null;
  Pts: number | null;
  idle: boolean;
}

export interface ZioneGroup {
  group: string;
  rows: ZioneRow[];
}

export interface ZioneStandings {
  meta: ZioneMeta;
  headers: string[];
  groups: ZioneGroup[];
}

// New interfaces for Zione schedule (Rol de Juegos) parser
export interface ZioneScheduleMeta {
  title: string | null;
  subtitle: string | null;
  source_url: string | null;
  ids: {
    dts: string | null;
    m: string | null;
    torID: string | null;
    divID: string | null;
    gpoID: string | null;
  };
  week: {
    label: string | null;
    start_date: string | null; // YYYY-MM-DD
    end_date: string | null;   // YYYY-MM-DD
    raw_range: string | null;
  };
  view: string | null; // "Rol Completo", "Rol por Equipo", etc.
}

export interface ZioneTeam {
  name: string;
  href: string | null;
  id: number | null;
}

export interface ZioneJornada {
  label: string;
  number: number | null;
}

export interface ZioneMatch {
  time: string | null;        // HH:MM
  kickoff: string | null;     // YYYY-MM-DDTHH:MM:SS
  place: string | null;
  team1: ZioneTeam;
  team2: ZioneTeam;
  group: string | null;
  stage: string | null;       // "Regular", etc.
  jornada: ZioneJornada;
  status: string | null;      // "Jugado", "Pendiente", etc.
}

export interface ZioneMatchday {
  label: string;
  date: string | null;        // YYYY-MM-DD
  matches: ZioneMatch[];
}

export interface ZioneResultReference {
  className: string;
  label: string;
}

export interface ZioneResultMatch {
  time: string | null;
  kickoff: string | null;
  group: string | null;
  stage: string | null;
  jornada: ZioneJornada;
  team1: ZioneTeam;
  team2: ZioneTeam;
  score1: number | null;
  score2: number | null;
  separator: string | null;
  status: string | null;
}

export interface ZioneResultMatchday {
  label: string;
  date: string | null;
  matches: ZioneResultMatch[];
}

export interface ZioneResults {
  type: 'results';
  meta: ZioneScheduleMeta;
  matchdays: ZioneResultMatchday[];
  summary: {
    total_results: number | null;
  };
  references: ZioneResultReference[];
}

export interface ZioneScheduleTeam {
  name: string;
  division: string | null;
  group: string | null;
  href: string | null;
  id: number | null;
}

export interface ZioneScheduleTeams {
  title: string | null;
  total: number | null;
  teams: ZioneScheduleTeam[];
}

export interface ZioneSchedule {
  meta: ZioneScheduleMeta;
  headers: string[];
  matchdays: ZioneMatchday[];
  rest: ZioneTeam[];           // equipos en descanso
  summary: {
    total_matches: number | null;
  };
  teamsByClub?: ZioneScheduleTeams | null;
}

export interface ZioneTeamMatchSummary {
  opponentName: string | null;
  opponentId: number | null;
  opponentHref: string | null;
  resultLabel: string | null;
  dateLabel: string | null;
  timeLabel: string | null;
  scoreText: string | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
}

export interface ZioneTeamStatItem {
  label: string;
  value: string;
}

export interface ZioneTeamInfo {
  meta: {
    teamId: number | null;
    name: string | null;
    division: string | null;
    group: string | null;
    captain: string | null;
    shield: string | null;
    source_url: string | null;
  };
  summary: {
    lastMatches: ZioneTeamMatchSummary[];
    nextMatches: ZioneTeamMatchSummary[];
  };
  stats: ZioneTeamStatItem[];
  statsTable?: TablaParsed | null;
  rosterTable?: TablaParsed | null;
  roster?: Array<{
    name: string;
    number: string | null;
    position: string | null;
    stats: Array<{ label: string; value: string }>;
  }>;
}

export interface CookieJar {
  cookies: string[];
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchResult {
  status: number;
  headers: Record<string, string | string[]>;
  text: string;
  jar: CookieJar;
}

/**
 * Helper function to convert string to integer with special case handling
 */
function toInt(value: string): number | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '–' || trimmed === '—') return null;
  
  // Replace Unicode minus sign with regular minus
  const normalized = trimmed.replace(/\u2212/g, '-').replace(/^\+/, '');
  
  const parsed = parseInt(normalized, 10);
  return isNaN(parsed) ? null : parsed;
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string): string | null {
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Attempt to fix common encoding artefacts present in Zione HTML responses
 */
function fixEncodingArtifacts(text: string): string {
  if (!text) return text;

  let fixed = text;

  // First try to decode common double-encoded sequences (Ã¡, Ã³, etc.)
  if (/[ÃÂ]/.test(fixed) || /ï¿½/.test(fixed)) {
    try {
      fixed = Buffer.from(fixed, 'latin1').toString('utf8');
    } catch {
      // ignore decoding errors and keep original text
    }
  }

  // Normalize the frequent "ï¿½" triple sequence to a single replacement char
  fixed = fixed.replace(/ï¿½/g, '�');

  const simpleReplacements: Array<[RegExp, string]> = [
    [/S�bado/g, 'Sábado'],
    [/s�bado/g, 'sábado'],
    [/Mi�rcoles/g, 'Miércoles'],
    [/mi�rcoles/g, 'miércoles'],
    [/Informaci�n/g, 'Información'],
    [/informaci�n/g, 'información'],
    [/Estad�sticas/g, 'Estadísticas'],
    [/estad�sticas/g, 'estadísticas'],
    [/Divisi�n/g, 'División'],
    [/divisi�n/g, 'división'],
    [/Selecci�n/g, 'Selección'],
    [/selecci�n/g, 'selección'],
    [/Opci�n/g, 'Opción'],
    [/opci�n/g, 'opción'],
    [/Funci�n/g, 'Función'],
    [/funci�n/g, 'función'],
    [/Gesti�n/g, 'Gestión'],
    [/gesti�n/g, 'gestión'],
    [/Administraci�n/g, 'Administración'],
    [/administraci�n/g, 'administración'],
    [/Organizaci�n/g, 'Organización'],
    [/organizaci�n/g, 'organización'],
    [/Regi�n/g, 'Región'],
    [/regi�n/g, 'región'],
    [/Campe�n/g, 'Campeón'],
    [/campe�n/g, 'campeón'],
    [/Posici�n/g, 'Posición'],
    [/posici�n/g, 'posición'],
    [/Categor�a/g, 'Categoría'],
    [/categor�a/g, 'categoría'],
    [/Instalaci�n/g, 'Instalación'],
    [/instalaci�n/g, 'instalación'],
    [/Planificaci�n/g, 'Planificación'],
    [/planificaci�n/g, 'planificación'],
    [/Pr�ximo/g, 'Próximo'],
    [/pr�ximo/g, 'próximo'],
    [/M�s/g, 'Más'],
    [/m�s/g, 'más'],
    [/D�a/g, 'Día'],
    [/d�a/g, 'día'],
    [/A�o/g, 'Año'],
    [/a�o/g, 'año'],
    [/Ni�o/g, 'Niño'],
    [/ni�o/g, 'niño'],
    [/Se�or/g, 'Señor'],
    [/se�or/g, 'señor']
  ];

  for (const [pattern, replacement] of simpleReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

  // Generic syllable replacements for palabras terminadas en "-ción", "-sión", etc.
  fixed = fixed.replace(/([cstmprldgnCSTMRLDGN])i�n/g, (_, letter: string) => `${letter}ión`);

  // Final fallback: replace any remaining replacement char with an unaccented vowel to avoid artefacts
  fixed = fixed.replace(/�/g, 'ó');

  return fixed;
}

/**
 * Normalize text by trimming and collapsing redundant whitespace
 */
function normalizeText(text: string): string {
  if (!text) return text;

  let cleaned = fixEncodingArtifacts(text);

  cleaned = cleaned
    .replace(/\r?\n/g, ' ')  // Preserve spacing for multiline content
    .replace(/\s+/g, ' ')     // Collapse repeated whitespace
    .trim();

  // Run artefact fixer again after trimming to catch patterns revealed by whitespace cleanup
  cleaned = fixEncodingArtifacts(cleaned);

  return cleaned;
}

function normalizeOrNull(text: string): string | null {
  const normalized = normalizeText(text);
  return normalized === '' ? null : normalized;
}

/**
 * Spanish month names mapping
 */
const SPANISH_MONTHS: Record<string, number> = {
  'enero': 1, 'ene': 1,
  'febrero': 2, 'feb': 2,
  'marzo': 3, 'mar': 3,
  'abril': 4, 'abr': 4,
  'mayo': 5, 'may': 5,
  'junio': 6, 'jun': 6,
  'julio': 7, 'jul': 7,
  'agosto': 8, 'ago': 8,
  'septiembre': 9, 'setiembre': 9, 'sep': 9, 'set': 9,
  'octubre': 10, 'oct': 10,
  'noviembre': 11, 'nov': 11,
  'diciembre': 12, 'dic': 12
};

/**
 * Parse Spanish date string to YYYY-MM-DD format
 * Examples: 
 * - "27-Sep-2025" -> "2025-09-27"
 * - "Sábado, 27-Sep-2025" -> "2025-09-27"
 */
function parseSpanishDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Clean up encoding issues and normalize
  const cleaned = dateStr.replace(/[^\w\s,.-]/g, '').trim();
  
  // Try pattern: "DD-Mon-YYYY" or "DD Mon YYYY"
  const pattern1 = /(\d{1,2})[-\s]([a-zA-Z]+)[-\s](\d{4})/i;
  const match1 = cleaned.match(pattern1);
  
  if (match1) {
    const [, day, month, year] = match1;
    const monthNum = SPANISH_MONTHS[month.toLowerCase()];
    
    if (monthNum) {
      const dayPadded = day.padStart(2, '0');
      const monthPadded = monthNum.toString().padStart(2, '0');
      return `${year}-${monthPadded}-${dayPadded}`;
    }
  }
  
  // Try pattern: "Month DD del YYYY" (full month names)
  const pattern2 = /([a-zA-Z]+)\s+(\d{1,2})\s+del\s+(\d{4})/i;
  const match2 = cleaned.match(pattern2);
  
  if (match2) {
    const [, month, day, year] = match2;
    const monthNum = SPANISH_MONTHS[month.toLowerCase()];
    
    if (monthNum) {
      const dayPadded = day.padStart(2, '0');
      const monthPadded = monthNum.toString().padStart(2, '0');
      return `${year}-${monthPadded}-${dayPadded}`;
    }
  }
  
  return null;
}

/**
 * Parse Spanish date range 
 * Example: "del Septiembre 22 del 2025 al Septiembre 28 del 2025"
 * Returns: { start_date: "2025-09-22", end_date: "2025-09-28" }
 */
function parseSpanishDateRange(rangeStr: string): { start_date: string | null; end_date: string | null } {
  if (!rangeStr) return { start_date: null, end_date: null };
  
  // Look for "del ... al ..." pattern
  const rangePattern = /del\s+(.+?)\s+al\s+(.+)/i;
  const match = rangeStr.match(rangePattern);
  
  if (match) {
    const [, startPart, endPart] = match;
    return {
      start_date: parseSpanishDate(startPart),
      end_date: parseSpanishDate(endPart)
    };
  }
  
  return { start_date: null, end_date: null };
}

/**
 * Extract time in HH:MM format from text
 * Examples: "<strong>17</strong>:00hs" -> "17:00", "18:30" -> "18:30"
 */
function extractTime(timeStr: string): string | null {
  if (!timeStr) return null;
  
  // Remove HTML tags and extract time pattern
  const cleaned = timeStr.replace(/<[^>]*>/g, '').trim();
  const timeMatch = cleaned.match(/(\d{1,2}):(\d{2})/);
  
  if (timeMatch) {
    const [, hours, minutes] = timeMatch;
    const hoursPadded = hours.padStart(2, '0');
    return `${hoursPadded}:${minutes}`;
  }
  
  return null;
}

/**
 * Extract team ID from href parameter
 * Example: "info.equipo.asp?dts=DTS094&m=1&e=600031" -> 600031
 */
function extractTeamId(href: string): number | null {
  if (!href) return null;
  
  const match = href.match(/[?&]e=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract jornada number from label
 * Example: "Jornada 1" -> 1
 */
function extractJornadaNumber(label: string): number | null {
  if (!label) return null;
  
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Resolve relative URL to absolute using base URL
 */
function resolveUrl(url: string | null, baseUrl: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Parse query string parameters from URL
 */
function parseQueryParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const urlObj = new URL(url);
    for (const [key, value] of urlObj.searchParams) {
      params[key] = value;
    }
  } catch {
    // Fallback regex parsing
    const matches = url.match(/[?&]([^=]+)=([^&]*)/g);
    if (matches) {
      matches.forEach(match => {
        const [, key, value] = match.match(/[?&]([^=]+)=([^&]*)/) || [];
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      });
    }
  }
  return params;
}

/**
 * Extract meta information from HTML document
 */
function extractMeta($: CheerioAPI): ZioneMeta {
  const meta: ZioneMeta = {
    title: null,
    subtitle: null,
    etapa: null,
    source_url: null,
    dts: null,
    m: null,
    torID: null,
    divID: null,
    gpoID: null
  };

  // Extract source_url from og:url meta tag
  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl) {
    meta.source_url = ogUrl;
    const params = parseQueryParams(ogUrl);
    meta.dts = params.dts || null;
    meta.m = params.m || null;
    meta.torID = params.torID || null;
    meta.divID = params.divID || null;
    meta.gpoID = params.gpoID || null;
  }

  // Extract title
  const titleEl = $('.enc-seccion h2');
  meta.title = titleEl.length ? titleEl.text().trim() : 'Tabla Posiciones';

  // Extract subtitle (first p after h2)
  if (titleEl.length) {
    const subtitleEl = titleEl.next('p');
    if (subtitleEl.length) {
      meta.subtitle = subtitleEl.text().trim() || null;
    }
  }

  // Extract etapa
  $('h2').each((_, el) => {
    const text = $(el).text();
    const match = text.match(/Etapa:\s*(.+)/i);
    if (match) {
      meta.etapa = match[1].trim();
      return false; // break
    }
  });

  return meta;
}

/**
 * Get fixed headers according to Zione specification
 */
function getFixedHeaders(): string[] {
  return ["Lugar", "Equipo", "JJ", "JG", "JE", "EG", "EP", "JP", "GF", "GC", "Dif", "PA", "Pts"];
}

/**
 * Parse a data row into ZioneRow format
 */
function parseDataRow($: CheerioAPI, $row: any, baseUrl: string): ZioneRow | null {
  const cells = $row.find('td');
  if (cells.length === 0) return null;

  // Lugar (position) - first cell
  const lugarText = $(cells[0]).text().trim();
  const lugar = toInt(lugarText);

  // Equipo (team) - second cell
  const equipoCell = $(cells[1]);
  const equipoLink = equipoCell.find('a');
  const equipoImg = equipoCell.find('img');
  
  const equipo: ZioneEquipo = {
    name: equipoLink.length ? equipoLink.text().trim() : equipoCell.text().trim(),
    href: equipoLink.length ? resolveUrl(equipoLink.attr('href') || null, baseUrl) : null,
    img: equipoImg.length ? resolveUrl(equipoImg.attr('src') || null, baseUrl) : null
  };

  // Numeric columns (JJ, JG, JE, EG, EP, JP, GF, GC, Dif, PA, Pts)
  const numericFields = ["JJ", "JG", "JE", "EG", "EP", "JP", "GF", "GC", "Dif", "PA", "Pts"];
  const row: any = { Lugar: lugar, Equipo: equipo };

  for (let i = 0; i < numericFields.length; i++) {
    const cellIndex = i + 2; // Skip Lugar and Equipo
    const cellValue = cellIndex < cells.length ? $(cells[cellIndex]).text().trim() : '';
    row[numericFields[i]] = toInt(cellValue);
  }

  // Check if row is idle
  row.idle = $row.hasClass('idle-team');

  return row as ZioneRow;
}

/**
 * Extract meta information for schedule from HTML document
 */
function extractScheduleMeta($: CheerioAPI): ZioneScheduleMeta {
  const meta: ZioneScheduleMeta = {
    title: null,
    subtitle: null,
    source_url: null,
    ids: {
      dts: null,
      m: null,
      torID: null,
      divID: null,
      gpoID: null
    },
    week: {
      label: null,
      start_date: null,
      end_date: null,
      raw_range: null
    },
    view: null
  };

  // Extract source_url from og:url meta tag
  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl) {
    meta.source_url = ogUrl;
    const params = parseQueryParams(ogUrl);
    meta.ids.dts = params.dts || null;
    meta.ids.m = params.m || null;
    meta.ids.torID = params.torID || null;
    meta.ids.divID = params.divID || null;
    meta.ids.gpoID = params.gpoID || null;
  }

  // Extract title
  const titleEl = $('.enc-seccion h2');
  meta.title = titleEl.length ? normalizeText(titleEl.text()) : 'Rol de Juegos';

  // Extract week information
  $('h2').each((_, el) => {
    const text = $(el).text();
    // Look for "Semana 5" pattern, handling &nbsp;
    const weekMatch = text.replace(/\u00A0/g, ' ').match(/Semana\s*(\d+)/i);
    if (weekMatch) {
      meta.week.label = normalizeText(text.replace(/\u00A0/g, ' '));
      
      // Look for date range in the next element
      const nextEl = $(el).next();
      if (nextEl.length) {
        const rangeText = normalizeText(nextEl.text());
        meta.week.raw_range = rangeText;
        const { start_date, end_date } = parseSpanishDateRange(rangeText);
        meta.week.start_date = start_date;
        meta.week.end_date = end_date;
      }
      return false; // break
    }
  });

  // Extract view (active tab)
  const activeView = $('.box-sel-view a.activo');
  if (activeView.length) {
    meta.view = normalizeOrNull(activeView.text());
  }

  if (titleEl.length) {
    const subtitleEl = titleEl.next('p');
    if (subtitleEl.length) {
      meta.subtitle = normalizeOrNull(subtitleEl.text());
    }
  }

  return meta;
}

/**
 * Get fixed headers for schedule according to Zione specification
 */
function getScheduleHeaders(): string[] {
  return ["Hora", "Lugar", "Equipo1", "Sep", "Equipo2", "Grupo", "Etapa", "Jornada", "Estatus"];
}

/**
 * Parse a team from a cell element
 */
function parseTeam($: CheerioAPI, cell: any, baseUrl: string): ZioneTeam {
  const $cell = $(cell);
  const link = $cell.find('a');
  
  if (link.length) {
    const href = link.attr('href') || null;
    return {
      name: normalizeText(link.text()),
      href: href ? resolveUrl(href, baseUrl) : null,
      id: href ? extractTeamId(href) : null
    };
  }
  
  return {
    name: normalizeText($cell.text()),
    href: null,
    id: null
  };
}

/**
 * Parse a match row from table
 */
function parseMatchRow($: CheerioAPI, $row: any, currentDate: string | null, baseUrl: string): ZioneMatch | null {
  const cells = $row.find('td');
  if (cells.length < 9) return null; // Need at least 9 cells for a valid match

  // Extract time
  const timeText = $(cells[0]).text().trim();
  const time = extractTime(timeText);
  
  // Build kickoff if we have both date and time
  let kickoff: string | null = null;
  if (currentDate && time) {
    kickoff = `${currentDate}T${time}:00`;
  }

  // Extract teams
  const team1 = parseTeam($, cells[2], baseUrl);
  const team2 = parseTeam($, cells[4], baseUrl);

  // Extract other fields
  const place = normalizeOrNull($(cells[1]).text());
  const jornadaText = $(cells[7]).text().trim();
  const status = normalizeOrNull($(cells[8]).text());

  const groupNormalized = normalizeOrNull($(cells[5]).text());
  const stageNormalized = normalizeOrNull($(cells[6]).text());
  const jornadaLabel = normalizeOrNull(jornadaText) || null;

  return {
    time,
    kickoff,
    place,
    team1,
    team2,
    group: groupNormalized,
    stage: stageNormalized,
    jornada: {
      label: jornadaLabel || '',
      number: extractJornadaNumber(jornadaLabel || jornadaText)
    },
    status
  };
}

/**
 * Parse teams at rest from .cnt_descanso section
 */
function parseRestTeams($: CheerioAPI, baseUrl: string): ZioneTeam[] {
  const rest: ZioneTeam[] = [];
  
  $('.cnt_descanso .eq_descansa').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a');
    
    if (link.length) {
      const href = link.attr('href') || null;
      rest.push({
        name: normalizeText(link.text()),
        href: href ? resolveUrl(href, baseUrl) : null,
        id: href ? extractTeamId(href) : null
      });
    }
  });
  
  return rest;
}

/**
 * Main parser function for Zione schedule tables (Rol de Juegos)
 */
export function parseZioneSchedule($: CheerioAPI, baseUrl: string = 'https://consola.zione.com.mx'): ZioneSchedule {
  // Extract metadata
  const meta = extractScheduleMeta($);
  
  // Get fixed headers
  const headers = getScheduleHeaders();
  
  // Find the statistics table
  let table = $('table.estadisticas');
  if (!table.length) {
    table = $('table').first();
  }
  
  if (!table.length) {
    return { 
      meta, 
      headers, 
      matchdays: [], 
      rest: [], 
      summary: { total_matches: null } 
    };
  }

  const matchdays: ZioneMatchday[] = [];
  let currentMatchday: ZioneMatchday | null = null;

  // Find tbody or use table directly
  const tbody = table.find('tbody');
  const rows = tbody.length ? tbody.find('tr') : table.find('tr');

  rows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    if (cells.length === 0) return; // Skip rows without cells

    // Check if this is a matchday header row (single cell with colspan)
    if (cells.length === 1) {
      const cell = $(cells[0]);
      const colspan = cell.attr('colspan');
      
      if (colspan) {
        const cellText = cell.text().trim();
        
        // Look for "Partidos: ..." pattern
        if (cellText.includes('Partidos:')) {
          const label = normalizeText(cellText.replace(/^.*Partidos:\s*/, '').trim());
          const date = parseSpanishDate(label);
          
          currentMatchday = { label, date, matches: [] };
          matchdays.push(currentMatchday);
        }
        return;
      }
    }

    // This is a data row - parse as match
    if (!currentMatchday) {
      // Create default matchday if none exists
      currentMatchday = { label: 'General', date: null, matches: [] };
      matchdays.push(currentMatchday);
    }

    const match = parseMatchRow($, $row, currentMatchday.date, baseUrl);
    if (match) {
      currentMatchday.matches.push(match);
    }
  });

  // Parse teams at rest
  const rest = parseRestTeams($, baseUrl);

  // Extract summary from tfoot
  let totalMatches: number | null = null;
  const footerTotal = table.find('tfoot b');
  if (footerTotal.length) {
    const totalText = footerTotal.text().trim();
    totalMatches = toInt(totalText);
  }

  return {
    meta,
    headers,
    matchdays,
    rest,
    summary: { total_matches: totalMatches },
    teamsByClub: null
  };
}

function extractGroupFromSubtitle(subtitle: string | null | undefined): string | null {
  if (!subtitle) return null;
  const match = subtitle.match(/Grupo\s+([^/]+)/i);
  return match ? match[0].trim() : null;
}

function parseTeamScheduleRow(
  $: CheerioAPI,
  $row: any,
  baseUrl: string,
  primaryTeam: ZioneTeam,
  fallbackDate: string | null,
  groupLabel: string | null
): { match: ZioneMatch; matchdayLabel: string; matchdayDate: string | null } | null {
  const cells = $row.find('td');
  if (cells.length < 8) return null;

  const stage = normalizeOrNull($(cells[0]).text());
  const jornadaText = normalizeText($(cells[1]).text());
  const fechaText = normalizeText($(cells[2]).text());
  const dateIso = parseSpanishDate(fechaText) || fallbackDate;
  const time = extractTime($(cells[3]).text().trim());
  const kickoff = dateIso && time ? `${dateIso}T${time}:00` : null;
  const place = normalizeOrNull($(cells[4]).text());
  const opponent = parseTeam($, cells[6], baseUrl);

  const statusCell = $(cells[7]).clone();
  const scoreText = statusCell.find('b').text().trim();
  let statusText = statusCell.find('small').text().trim();
  statusCell.find('b, small').remove();
  const extraStatus = statusCell.text().trim();
  if (!statusText && extraStatus) {
    statusText = extraStatus;
  }
  if (scoreText && !statusText) {
    statusText = scoreText;
  }

  const matchdayLabel = jornadaText || fechaText || stage || 'Partidos';

  const match: ZioneMatch = {
    time,
    kickoff,
    place,
    team1: { ...primaryTeam },
    team2: opponent,
    group: groupLabel,
    stage,
    jornada: {
      label: jornadaText || stage || fechaText || 'Jornada',
      number: extractJornadaNumber(jornadaText || stage || '')
    },
    status: normalizeOrNull(statusText)
  };

  return { match, matchdayLabel, matchdayDate: dateIso };
}

export function parseZioneTeamSchedule(
  $: CheerioAPI,
  options: { teamName?: string | null; teamId?: string | number | null; dts?: string | null },
  baseUrl: string = 'https://consola.zione.com.mx'
): ZioneSchedule {
  const meta = extractScheduleMeta($);
  const headers = getScheduleHeaders();

  if (options.teamName) {
    meta.title = options.teamName;
  }

  const table = $('table.estadisticas').first();
  if (!table.length) {
    return {
      meta,
      headers,
      matchdays: [],
      rest: [],
      summary: { total_matches: null }
    };
  }

  const dts = options.dts || meta.ids.dts || null;
  const teamIdNumber = options.teamId != null ? Number(options.teamId) : null;
  const teamHref = teamIdNumber != null && dts ? resolveUrl(`/info.equipo.asp?dts=${dts}&m=1&e=${teamIdNumber}`, baseUrl) : null;
  const primaryTeam: ZioneTeam = {
    name: options.teamName || meta.title || 'Equipo',
    href: teamHref,
    id: teamIdNumber
  };

  const groupLabel = extractGroupFromSubtitle(meta.subtitle);

  const matchdayMap = new Map<string, ZioneMatchday>();
  const rows = table.find('tbody tr');

  rows.each((_, row) => {
    const parsed = parseTeamScheduleRow($, $(row), baseUrl, primaryTeam, null, groupLabel);
    if (!parsed) return;

    let matchday = matchdayMap.get(parsed.matchdayLabel);
    if (!matchday) {
      matchday = {
        label: parsed.matchdayLabel,
        date: parsed.matchdayDate,
        matches: []
      };
      matchdayMap.set(parsed.matchdayLabel, matchday);
    } else if (!matchday.date && parsed.matchdayDate) {
      matchday.date = parsed.matchdayDate;
    }

    matchday.matches.push(parsed.match);
  });

  const matchdays = Array.from(matchdayMap.values());

  let totalMatches: number | null = null;
  const footerTotal = table.find('tfoot b');
  if (footerTotal.length) {
    totalMatches = toInt(footerTotal.text().trim());
  }

  return {
    meta,
    headers,
    matchdays,
    rest: [],
    summary: { total_matches: totalMatches },
    teamsByClub: null
  };
}

function parseRoster($: CheerioAPI): Array<{
  name: string;
  number: string | null;
  position: string | null;
  stats: Array<{ label: string; value: string }>;
}> {
  const roster: Array<{
    name: string;
    number: string | null;
    position: string | null;
    stats: Array<{ label: string; value: string }>;
  }> = [];

  const labelMap: Record<string, string> = {
    GOL: 'Goles',
    AGOL: 'Autogoles',
    PNAL: 'Penales',
    Amarilla: 'Amarillas',
    Roja: 'Rojas'
  };

  $('table.estadisticas tbody tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    if (!cells.length) return;

    const playerCell = $(cells[0]);
    const nameLink = playerCell.find('.player-name a').first();
    const rawName = nameLink.length ? nameLink.text() : playerCell.text();
    const name = normalizeText(rawName);
    if (!name || name === '--') return;

    const numberText = playerCell.find('.player-name span').first().text().trim();
    const number = numberText && numberText !== '--' ? numberText : null;

    const position = normalizeOrNull($(cells[1]).text());

    const stats: Array<{ label: string; value: string }> = [];
    const headers = ['GOL', 'AGOL', 'PNAL', 'Amarilla', 'Azul', 'Roja'];
    for (let i = 0; i < headers.length; i++) {
      const cellIndex = i + 2;
      if (cellIndex >= cells.length) break;
      const label = headers[i];
      if (label === 'Azul') continue;
      const valueRaw = $(cells[cellIndex]).text().trim();
      const value = valueRaw && valueRaw !== '-' && valueRaw !== '—' ? valueRaw : '0';
      stats.push({ label: labelMap[label] || label, value });
    }

    roster.push({ name, number, position, stats });
  });

  return roster;
}

function collectStatusLookup($: CheerioAPI): Record<string, string> {
  const map: Record<string, string> = {};
  $('#cnt_res_st_refs span').each((_, el) => {
    const clsAttr = $(el).attr('class') || '';
    const cls = clsAttr.split(/\s+/).find(name => /^res_st_/i.test(name));
    if (cls) {
      map[cls] = normalizeText($(el).text()) || cls;
    }
  });
  return map;
}

function extractStatusFromElement($: CheerioAPI, element: any, lookup: Record<string, string>): string | null {
  const classes = new Set<string>();

  const collect = (el: any) => {
    const attr = $(el).attr('class');
    if (!attr) return;
    attr.split(/\s+/).forEach(cls => {
      if (cls) classes.add(cls);
    });
  };

  collect(element);
  $(element).find('*').each((_, child) => collect(child));

  for (const cls of classes) {
    if (lookup[cls]) return lookup[cls];
    if (/^res_st_/i.test(cls)) return cls;
  }

  return null;
}

function parseResultMatchRow(
  $: CheerioAPI,
  $row: any,
  currentDate: string | null,
  baseUrl: string,
  statusLookup: Record<string, string>
): ZioneResultMatch | null {
  const cells = $row.find('td');
  if (cells.length < 9) return null;

  const timeText = $(cells[0]).text().trim();
  const time = extractTime(timeText);

  let kickoff: string | null = null;
  if (currentDate && time) {
    kickoff = `${currentDate}T${time}:00`;
  }

  const group = normalizeOrNull($(cells[1]).text());
  const stage = normalizeOrNull($(cells[2]).text());
  const jornadaLabelRaw = normalizeOrNull($(cells[3]).text()) || '';

  const team1 = parseTeam($, cells[4], baseUrl);
  const team2 = parseTeam($, cells[5], baseUrl);

  const score1 = toInt($(cells[6]).text());
  const separator = normalizeOrNull($(cells[7]).text());
  const score2 = toInt($(cells[8]).text());

  const status =
    extractStatusFromElement($, cells[6], statusLookup) ||
    extractStatusFromElement($, cells[8], statusLookup) ||
    extractStatusFromElement($, $row, statusLookup);

  return {
    time,
    kickoff,
    group,
    stage,
    jornada: {
      label: jornadaLabelRaw,
      number: extractJornadaNumber(jornadaLabelRaw)
    },
    team1,
    team2,
    score1,
    score2,
    separator,
    status
  };
}

export function parseZioneResults($: CheerioAPI, baseUrl: string = 'https://consola.zione.com.mx'): ZioneResults {
  const meta = extractScheduleMeta($);
  const statusLookup = collectStatusLookup($);

  let table = $('table.estadisticas');
  if (!table.length) {
    table = $('table').first();
  }

  const matchdays: ZioneResultMatchday[] = [];
  let currentMatchday: ZioneResultMatchday | null = null;

  if (table.length) {
    const tbody = table.find('tbody');
    const rows = tbody.length ? tbody.find('tr') : table.find('tr');

    rows.each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length === 0) return;

      if (cells.length === 1) {
        const cell = $(cells[0]);
        const colspan = cell.attr('colspan');
        if (colspan) {
          const cellText = cell.text().trim();
          if (cellText.includes('Resultados:')) {
            const label = normalizeText(cellText.replace(/^.*Resultados:\s*/, '').trim());
            const date = parseSpanishDate(label);
            currentMatchday = { label, date, matches: [] };
            matchdays.push(currentMatchday);
          }
          return;
        }
      }

      if (!currentMatchday) {
        currentMatchday = { label: 'General', date: null, matches: [] };
        matchdays.push(currentMatchday);
      }

      const match = parseResultMatchRow($, $row, currentMatchday.date, baseUrl, statusLookup);
      if (match) {
        currentMatchday.matches.push(match);
      }
    });
  }

  let totalResults: number | null = null;
  const footer = table.find('tfoot b');
  if (footer.length) {
    totalResults = toInt(footer.text().trim());
  }

  const references: ZioneResultReference[] = Object.entries(statusLookup).map(([className, label]) => ({ className, label }));

  return {
    type: 'results',
    meta,
    matchdays,
    summary: { total_results: totalResults },
    references
  };
}

export function parseZioneScheduleTeams($: CheerioAPI, baseUrl: string = 'https://consola.zione.com.mx'): ZioneScheduleTeams | null {
  let table = $('table.estadisticas');
  if (!table.length) {
    table = $('table').first();
  }

  if (!table.length) {
    return null;
  }

  const rows = table.find('tbody tr');
  const teams: ZioneScheduleTeam[] = [];

  rows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const name = normalizeOrNull($(cells[0]).text()) || '';
    if (!name) return;

    const division = normalizeOrNull($(cells[1]).text());
    const group = normalizeOrNull($(cells[2]).text());

    const link = $(cells[3]).find('a');
    let href: string | null = null;
    let id: number | null = null;
    if (link.length) {
      const rawHref = link.attr('href') || null;
      href = rawHref ? resolveUrl(rawHref, baseUrl) : null;
      if (rawHref) {
        const match = rawHref.match(/[?&]e=(\d+)/);
        if (match) {
          id = parseInt(match[1], 10) || null;
        }
      }
    }

    teams.push({
      name,
      division,
      group,
      href,
      id
    });
  });

  let total: number | null = null;
  const footer = table.find('tfoot b');
  if (footer.length) {
    const totalText = footer.text();
    total = toInt(totalText);
  }

  return {
    title: null,
    total,
    teams
  };
}

/**
 * Main parser function for Zione standings tables
 */
export function parseZioneStandings($: CheerioAPI, baseUrl: string = 'https://consola.zione.com.mx'): ZioneStandings {
  // Extract metadata
  const meta = extractMeta($);
  
  // Get fixed headers
  const headers = getFixedHeaders();
  
  // Find the statistics table
  let table = $('table.estadisticas');
  if (!table.length) {
    table = $('table').first();
  }
  
  if (!table.length) {
    return { meta, headers, groups: [] };
  }

  const groups: ZioneGroup[] = [];
  let currentGroup: ZioneGroup | null = null;

  // Find tbody or use table directly
  const tbody = table.find('tbody');
  const rows = tbody.length ? tbody.find('tr') : table.find('tr');

  rows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    if (cells.length === 0) return; // Skip rows without cells

    // Check if this is a group header row (single cell with colspan)
    if (cells.length === 1) {
      const cell = $(cells[0]);
      const colspan = cell.attr('colspan');
      if (colspan) {
        // Extract group name from <b> tag or cell text
        const boldEl = cell.find('b');
        const groupName = boldEl.length ? boldEl.text().trim() : cell.text().trim();
        
        if (groupName) {
          currentGroup = { group: groupName, rows: [] };
          groups.push(currentGroup);
        }
        return;
      }
    }

    // This is a data row
    if (!currentGroup) {
      // Create default group if none exists
      currentGroup = { group: 'General', rows: [] };
      groups.push(currentGroup);
    }

    const parsedRow = parseDataRow($, $row, baseUrl);
    if (parsedRow) {
      currentGroup.rows.push(parsedRow);
    }
  });

  return { meta, headers, groups };
}

/**
 * Build URL with query parameters
 */
export function buildUrl(basePath: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(basePath, process.env.BASE_URL || 'https://consola.zione.com.mx');
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value.toString());
    }
  });
  
  return url.toString();
}

/**
 * Fetch with cookie jar management
 */
export async function fetchWithCookies(
  url: string,
  options: FetchOptions = {},
  jar: CookieJar = { cookies: [] }
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...(options.headers || {})
  };

  // Add cookies to request
  if (jar.cookies.length > 0) {
    headers.Cookie = jar.cookies.join('; ');
  }

  try {
    // undici expects a specific HttpMethod type; coerce here for flexibility
    const methodAny = (options.method || 'GET') as any;
    const response = await request(url, {
      method: methodAny,
      headers,
      body: options.body,
    } as any);

    const responseHeaders: Record<string, string | string[]> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      responseHeaders[key] = value as string | string[];
    });

    const arrayBuffer = await response.body.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentTypeHeader = response.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader.find(Boolean)
      : contentTypeHeader;
    const charsetMatch = typeof contentType === 'string'
      ? contentType.match(/charset=([^;]+)/i)
      : null;

    const ensureEncoding = (encoding: string | null | undefined): string => {
      if (!encoding) return 'utf-8';
      const normalized = encoding.trim().toLowerCase();
      return iconv.encodingExists(normalized) ? normalized : 'utf-8';
    };

    const decodeBuffer = (encoding: string): string => {
      try {
        return iconv.decode(buffer, encoding);
      } catch {
        return buffer.toString('utf-8');
      }
    };

    let text = decodeBuffer(ensureEncoding(charsetMatch?.[1]));

    if (text.includes('\uFFFD')) {
      // Fallback for legacy ISO-8859-1 pages without charset header
      text = decodeBuffer('latin1');
    }

    // Extract cookies from Set-Cookie headers
    const newJar: CookieJar = { cookies: [...jar.cookies] };
    const setCookieHeaders = response.headers['set-cookie'];
    
    if (setCookieHeaders) {
      const cookieHeaders = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
      cookieHeaders.forEach(cookieHeader => {
        if (typeof cookieHeader === 'string') {
          // Extract just the name=value part (before first semicolon)
          const cookiePart = cookieHeader.split(';')[0].trim();
          if (cookiePart) {
            // Update existing cookie or add new one
            const [name] = cookiePart.split('=');
            const existingIndex = newJar.cookies.findIndex(c => c.startsWith(name + '='));
            if (existingIndex >= 0) {
              newJar.cookies[existingIndex] = cookiePart;
            } else {
              newJar.cookies.push(cookiePart);
            }
          }
        }
      });
    }

    return {
      status: response.statusCode,
      headers: responseHeaders,
      text,
      jar: newJar
    };
  } catch (error) {
    throw new Error(`Fetch error for ${url}: ${error}`);
  }
}

/**
 * Legacy function - convert HTML table to JSON structure (keeping for compatibility)
 */
export function tableToJson($: CheerioAPI, tableElement: any, index: number): TablaParsed {
  const $table = $(tableElement);

  // Extract metadata
  const meta: TablaMeta = {
    index,
    id: $table.attr('id') || null,
    className: $table.attr('class') || null,
    title: null
  };

  // Try to find a title
  const caption = $table.find('caption').first().text().trim();
  if (caption) {
    meta.title = caption;
  } else {
    const prevHeading = $table.prevAll('h1, h2, h3, h4, h5, h6').first().text().trim();
    if (prevHeading) meta.title = prevHeading;
    else meta.title = 'Tabla';
  }

  // Extract headers
  const headers: string[] = [];
  const headerRow = $table.find('thead tr').first();
  if (headerRow.length) {
    headerRow.find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim());
    });
  } else {
    // Fallback to first row
    const firstRow = $table.find('tr').first();
    firstRow.find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim());
    });
  }

  // Extract rows
  const rows: Record<string, string>[] = [];
  const dataRows = $table.find('tbody tr');
  if (dataRows.length) {
    dataRows.each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      const rowData: Record<string, string> = {};
      
      cells.each((cellIndex, cell) => {
        const headerKey = headers[cellIndex] || `col_${cellIndex}`;
        rowData[headerKey] = $(cell).text().trim();
      });
      
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    });
  }

  return { meta, headers, rows };
}

export function parseTeamInfo(
  $: CheerioAPI,
  teamId: string | number | null,
  baseUrl: string = 'https://consola.zione.com.mx'
): ZioneTeamInfo {
  const safeTeamId = teamId != null ? Number(teamId) : null;

  const shieldSrc = $('#escudo_equipo').attr('src') || null;
  const shield = toAbsoluteUrl(shieldSrc, baseUrl);
  const name = $('.enc-seccion span').first().text().trim() || null;

  const headerParagraph = $('.enc-seccion p').first();
  const boldItems = headerParagraph.find('b');
  const division = normalizeOrNull(boldItems.eq(0).text()) || null;
  const captain = normalizeOrNull(boldItems.eq(1).text()) || null;

  const cleanGroupValue = (value: string): string | null => {
    if (!value) return null;
    if (!/grupo/i.test(value)) return null;
    const normalized = normalizeText(value)
      .replace(/\//g, ' ')
      .replace(/Capit[áa]n?.*/i, '')
      .replace(/Capitan?.*/i, '')
      .trim();
    if (!normalized) return null;
    const match = normalized.match(/Grupo\s+(.+)/i);
    return match ? match[1].trim() : normalized;
  };

  let group: string | null = null;
  headerParagraph.contents().each((_, node) => {
    if (group) return;
    if (node.type === 'text' && node.data) {
      const possible = cleanGroupValue(node.data);
      if (possible) {
        group = possible;
      }
    }
  });

  if (!group) {
    const paragraphText = normalizeText(
      headerParagraph.clone().children('b').remove().end().text()
    );
    group = cleanGroupValue(paragraphText);
  }

  const parseMatchSection = (titleContains: string): ZioneTeamMatchSummary[] => {
    const matches: ZioneTeamMatchSummary[] = [];
    const sectionHeader = $(`#cnt_info_partidos b`).filter((_, el) => {
      return $(el).text().toLowerCase().includes(titleContains.toLowerCase());
    }).first();

    if (!sectionHeader.length) return matches;

    const sectionRoot = sectionHeader.closest('div');
    if (!sectionRoot.length) return matches;

    sectionRoot.find('.box_info').each((_, box) => {
      const $box = $(box);
      const opponentAnchor = $box.find('.datos_equipo a').first();
      const opponentName = opponentAnchor.text().trim() || null;
      const opponentHref = opponentAnchor.attr('href') || null;
      const opponentIdMatch = opponentHref?.match(/e=(\d+)/i);
      const opponentId = opponentIdMatch ? Number(opponentIdMatch[1]) : null;

      const resultLabelRaw = $box.find('.datos_equipo').clone().children('a').remove().end().text().replace(/\s+/g, ' ').trim();
      const resultLabel = resultLabelRaw || null;

      const dateTimeText = $box.find('.datos_partido').text().replace(/\s+/g, ' ').trim();
      const [datePart, timePartRaw] = dateTimeText.split(/\s+(?=\d)/).map(part => part?.trim() || null);
      const timePart = timePartRaw ? timePartRaw.replace(/hs/i, '').trim() : null;

      const scoreTextRaw = $box.find('.marcador').text().replace(/\s+/g, ' ').trim();
      const scoreMatch = scoreTextRaw.match(/(-?\d+)\s*[-–]\s*(-?\d+)/);
      const scoreFor = scoreMatch ? Number(scoreMatch[1]) : null;
      const scoreAgainst = scoreMatch ? Number(scoreMatch[2]) : null;
      const scoreText = scoreTextRaw || null;

      matches.push({
        opponentName,
        opponentId,
        opponentHref: opponentHref ? toAbsoluteUrl(opponentHref, baseUrl) : null,
        resultLabel,
        dateLabel: datePart || null,
        timeLabel: timePart || null,
        scoreText,
        scoreFor,
        scoreAgainst
      });
    });

    return matches;
  };

  const lastMatches = parseMatchSection('últimos partidos');
  const nextMatches = parseMatchSection('próximos partidos');

  const stats: ZioneTeamStatItem[] = [];
  let statsTable: TablaParsed | null = null;
  const statsTableElement = $('#cnt_estadisticas_gen table').first();
  if (statsTableElement.length) {
    statsTable = tableToJson($, statsTableElement, 0);
    statsTable.rows.forEach(row => {
      Object.entries(row).forEach(([key, value]) => {
        if (key && value != null && value !== '') {
          stats.push({ label: key, value: value.toString() });
        }
      });
    });
  }

  let rosterTable: TablaParsed | null = null;
  const rosterElement = $('table.estadisticas').first();
  if (rosterElement.length) {
    rosterTable = tableToJson($, rosterElement, 0);
  }

  const roster = parseRoster($);

  return {
    meta: {
      teamId: safeTeamId,
      name,
      division,
      group,
      captain,
      shield,
      source_url: baseUrl
    },
    summary: {
      lastMatches,
      nextMatches
    },
    stats,
    statsTable,
    rosterTable,
    roster
  };
}

/**
 * Parse all select elements in HTML
 */
export function parseSelects($: CheerioAPI) {
  const selects: Array<{
    name: string | null;
    id: string | null;
    options: Array<{ value: string; text: string; selected: boolean }>;
  }> = [];

  $('select').each((si: number, selectEl: any) => {
    const $select = $(selectEl);
    const options: Array<{ value: string; text: string; selected: boolean }> = [];

    $select.find('option').each((oi: number, optionEl: any) => {
      const $option = $(optionEl);
      const value = $option.attr('value') || '';
      const text = $option.text().trim();
      const selected = !!$option.prop('selected');

      if (value && text) {
        options.push({ value, text, selected });
      }
    });

    selects.push({
      name: $select.attr('name') || null,
      id: $select.attr('id') || null,
      options
    });
  });

  return selects;
}

/**
 * Extract horarios/divisions from HTML (robust approach)
 */
export function extractHorarios($: CheerioAPI): Array<{ divID: string; label: string }> {
  const horarios: Array<{ divID: string; label: string }> = [];

  // Method 1: Look for select elements with division-related names
  $('select').each((_, selectEl) => {
    const $select = $(selectEl);
    const name = ($select.attr('name') || '').toLowerCase();
    const id = ($select.attr('id') || '').toLowerCase();
    
    if (name.includes('div') || name.includes('hor') || name.includes('categoria') || 
        id.includes('div') || id.includes('hor') || id.includes('categoria')) {
      
      $select.find('option').each((_, optionEl) => {
        const $option = $(optionEl);
        const value = $option.attr('value') || '';
        const text = $option.text().trim();
        
        if (value && /^\d{3,}$/.test(value) && text) {
          horarios.push({ divID: value, label: text });
        }
      });
    }
  });

  // Method 2: Look for links with divID parameter
  if (horarios.length === 0) {
    $('a[href*="divID="]').each((_, linkEl) => {
      const $link = $(linkEl);
      const href = $link.attr('href') || '';
      const text = $link.text().trim();
      
      const divIDMatch = href.match(/divID=(\d{3,})/);
      if (divIDMatch && text) {
        const divID = divIDMatch[1];
        // Avoid duplicates
        if (!horarios.find(h => h.divID === divID)) {
          horarios.push({ divID, label: text });
        }
      }
    });
  }

  // Method 3: Fallback regex search in HTML
  if (horarios.length === 0) {
    const htmlContent = $.html();
    const divIDMatches = htmlContent.match(/divID=(\d{3,})/g);
    if (divIDMatches) {
      divIDMatches.forEach((match, index) => {
        const divID = match.replace('divID=', '');
        if (!horarios.find(h => h.divID === divID)) {
          horarios.push({ divID, label: `División ${divID}` });
        }
      });
    }
  }

  return horarios;
}

/**
 * Parse candidate IDs from links (gpoID and others)
 */
export function parseCandidateIDsFromLinks($: CheerioAPI): {
  gpoCandidates: string[];
  grupoSelectName: string | null;
} {
  const gpoCandidates: string[] = [];
  let grupoSelectName: string | null = null;

  // Look for gpoID in links
  $('a[href*="gpoID="]').each((_, linkEl) => {
    const $link = $(linkEl);
    const href = $link.attr('href') || '';
    
    const gpoIDMatch = href.match(/gpoID=(\d+)/);
    if (gpoIDMatch) {
      const gpoID = gpoIDMatch[1];
      if (!gpoCandidates.includes(gpoID)) {
        gpoCandidates.push(gpoID);
      }
    }
  });

  // Look for select with grupo-related name
  $('select').each((_, selectEl) => {
    const $select = $(selectEl);
    const name = ($select.attr('name') || '').toLowerCase();
    const id = ($select.attr('id') || '').toLowerCase();
    
    if (name.includes('grupo') || name.includes('gpo') || id.includes('grupo') || id.includes('gpo')) {
      grupoSelectName = $select.attr('name') || $select.attr('id') || null;
    }
  });

  return { gpoCandidates, grupoSelectName };
}
