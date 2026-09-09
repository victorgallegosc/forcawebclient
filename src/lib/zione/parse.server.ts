import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

import {
  ALLOWED_GROUP_NAMES,
  CATEGORY_ID,
  DTS,
  GROUPS,
  TOURNAMENT_ID,
  ZIONE_BASE,
} from "./constants";
import type {
  GroupPlayerStats,
  GroupSchedule,
  Match,
  MatchWeek,
  PlayerStat,
  StandingRow,
  StandingsGroup,
} from "./types";

const clean = (value: string | undefined | null) =>
  (value ?? "").replace(/\s+/g, " ").trim();

const num = (value: string | undefined | null): number => {
  const parsed = Number.parseInt(clean(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, ZIONE_BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

async function loadPage(url: string): Promise<CheerioAPI> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "es-MX,es;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`Zione responded ${response.status} for ${url}`);
  return cheerio.load(await response.text());
}

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** "Sáb, 4 Jul, 2026" -> "2026-07-04" */
export function parseSpanishDate(label: string): string | null {
  const match = clean(label).match(/(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]+),?\s+(\d{4})/);
  if (!match) return null;
  const [, day, monthWord, year] = match;
  const month = MONTHS[monthWord!.slice(0, 3).toLowerCase()];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

const groupParams = (gpoID: string) => ({
  dts: DTS,
  m: "2",
  torID: TOURNAMENT_ID,
  divID: CATEGORY_ID,
  gpoID,
});

/* ---------------------------------- standings --------------------------------- */

export async function fetchStandings(): Promise<StandingsGroup[]> {
  const $ = await loadPage(
    buildUrl("/tab.posiciones.asp", {
      dts: DTS,
      m: "2",
      torID: TOURNAMENT_ID,
      divID: CATEGORY_ID,
    }),
  );

  const byGroup = new Map<string, StandingRow[]>();
  let current = "";

  $('table.base-table tbody tr').each((_, element) => {
    const row = $(element);
    if (row.hasClass("base-table__divider")) {
      current = clean(row.text());
      return;
    }
    if (!ALLOWED_GROUP_NAMES.includes(current)) return;

    const stats = row.find("td.is-stat").map((__, td) => clean($(td).text())).get();
    const team = clean(row.find(".identity__description").text());
    if (!team || stats.length < 10) return;

    const list = byGroup.get(current) ?? [];
    list.push({
      position: num(row.find("td.is-ranking").first().text()),
      team,
      group: current,
      played: num(stats[0]),
      won: num(stats[1]),
      drawn: num(stats[2]),
      lost: num(stats[5]),
      goalsFor: num(stats[6]),
      goalsAgainst: num(stats[7]),
      diff: num(stats[8]),
      points: num(stats[stats.length - 1]),
    });
    byGroup.set(current, list);
  });

  return GROUPS.filter((group) => byGroup.has(group.name)).map((group) => ({
    groupId: group.id,
    groupName: group.name,
    rows: byGroup.get(group.name) ?? [],
  }));
}

/* ---------------------------------- schedule ---------------------------------- */

function parseWeeks($: CheerioAPI, withScore: boolean): MatchWeek[] {
  const weeks: MatchWeek[] = [];

  $('[data-table-role="schedule"]').each((_, wrapper) => {
    const block = $(wrapper);
    const label = clean(block.find(".base-title").first().text());
    const range = clean(block.find(".base-subtitle").first().text());
    const matches: Match[] = [];
    let dateLabel = "";

    block.find("tbody tr").each((__, element) => {
      const row = $(element);
      if (row.hasClass("base-table__divider")) {
        dateLabel = clean(row.text());
        return;
      }

      const teams = row.find("td.is-team");
      if (teams.length < 2) return;

      const home = clean(teams.eq(0).find(".cell-stack__main").text());
      const away = clean(teams.eq(1).find(".cell-stack__main").text());
      if (!home || !away) return;

      const group = clean(teams.eq(0).find(".cell-stack__meta").text());
      if (!ALLOWED_GROUP_NAMES.includes(group)) return;

      const roundCell = row.find("td").eq(3);
      const cells = row.find("td");

      let homeGoals: number | null = null;
      let awayGoals: number | null = null;
      let status = "";
      let place = "";
      let time = "";

      if (withScore) {
        time = clean(cells.eq(4).text()).replace(/\s*hrs\.?$/i, "");
        const scoreParts = row
          .find("td.is-score")
          .find("spam, span")
          .map((___, node) => clean($(node).text()))
          .get()
          .filter((value) => /^\d+$/.test(value));
        if (scoreParts.length >= 2) {
          homeGoals = num(scoreParts[0]);
          awayGoals = num(scoreParts[1]);
          status = "Jugado";
        }
      } else {
        time = clean(cells.eq(4).text()).replace(/\s*hrs\.?$/i, "");
        place = clean(cells.eq(5).text());
        status = clean(cells.eq(6).text());
      }

      matches.push({
        date: dateLabel,
        iso: parseSpanishDate(dateLabel),
        home,
        away,
        group,
        round: clean(roundCell.find(".cell-stack__main").text()),
        stage: clean(roundCell.find(".cell-stack__meta").text()),
        time,
        place,
        status,
        homeGoals,
        awayGoals,
      });
    });

    if (matches.length > 0) weeks.push({ label, range, matches });
  });

  return weeks;
}

export async function fetchGroupSchedule(gpoID: string): Promise<GroupSchedule> {
  const group = GROUPS.find((entry) => entry.id === gpoID)!;
  const [scheduleDoc, resultsDoc] = await Promise.all([
    loadPage(buildUrl("/rol.juegos.asp", { ...groupParams(gpoID), v: "1" })),
    loadPage(buildUrl("/tab.resultados.asp", groupParams(gpoID))),
  ]);

  const weeks = parseWeeks(scheduleDoc, false);
  const scored = parseWeeks(resultsDoc, true);

  const scoreIndex = new Map<string, Match>();
  for (const week of scored) {
    for (const match of week.matches) {
      scoreIndex.set(`${match.iso ?? match.date}|${match.home}|${match.away}`, match);
    }
  }

  for (const week of weeks) {
    for (const match of week.matches) {
      const hit = scoreIndex.get(`${match.iso ?? match.date}|${match.home}|${match.away}`);
      if (hit && hit.homeGoals !== null) {
        match.homeGoals = hit.homeGoals;
        match.awayGoals = hit.awayGoals;
        match.status = "Jugado";
      }
    }
  }

  return { groupId: group.id, groupName: group.name, weeks };
}

export async function fetchSchedule(): Promise<GroupSchedule[]> {
  return Promise.all(GROUPS.map((group) => fetchGroupSchedule(group.id)));
}

/* ------------------------------- player tables -------------------------------- */

async function fetchPlayerTable(
  path: string,
  gpoID: string,
): Promise<GroupPlayerStats> {
  const group = GROUPS.find((entry) => entry.id === gpoID)!;
  const $ = await loadPage(buildUrl(path, groupParams(gpoID)));
  const rows: PlayerStat[] = [];

  $("table.base-table tbody tr").each((_, element) => {
    const row = $(element);
    const player = clean(row.find(".identity__description").text());
    if (!player) return;
    const stats = row.find("td.is-stat").map((__, td) => clean($(td).text())).get();
    if (stats.length === 0) return;

    rows.push({
      position: num(row.find("td.is-ranking").first().text()),
      player,
      team: clean(row.find(".identity__meta").first().text()),
      group: group.name,
      played: num(stats[0]),
      average: stats.length >= 3 ? (stats[1] ?? null) : null,
      value: num(stats[stats.length - 1]),
    });
  });

  return { groupId: group.id, groupName: group.name, rows };
}

export async function fetchScorers(): Promise<GroupPlayerStats[]> {
  return Promise.all(GROUPS.map((group) => fetchPlayerTable("/tab.scoreind.asp", group.id)));
}

export async function fetchCards(): Promise<GroupPlayerStats[]> {
  return Promise.all(GROUPS.map((group) => fetchPlayerTable("/tab.tarjetas.asp", group.id)));
}
