import { createServerFn } from "@tanstack/react-start";

import { TOURNAMENT_ID } from "./zione/constants";
import type {
  Fetched,
  GroupPlayerStats,
  GroupSchedule,
  StandingsGroup,
} from "./zione/types";

const cacheKey = (name: string) => `${name}:${TOURNAMENT_ID}`;

export const getStandings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<StandingsGroup[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchStandings } = await import("./zione/parse.server");
    return cached(cacheKey("standings"), fetchStandings);
  },
);

export const getSchedule = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<GroupSchedule[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchSchedule } = await import("./zione/parse.server");
    return cached(cacheKey("schedule"), fetchSchedule);
  },
);

export const getScorers = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<GroupPlayerStats[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchScorers } = await import("./zione/parse.server");
    return cached(cacheKey("scorers"), fetchScorers);
  },
);

export const getCards = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<GroupPlayerStats[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchCards } = await import("./zione/parse.server");
    return cached(cacheKey("cards"), fetchCards);
  },
);
