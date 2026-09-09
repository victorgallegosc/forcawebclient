import { createServerFn } from "@tanstack/react-start";

import type {
  Fetched,
  GroupPlayerStats,
  GroupSchedule,
  StandingsGroup,
} from "./zione/types";

export const getStandings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<StandingsGroup[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchStandings } = await import("./zione/parse.server");
    return cached("standings", fetchStandings);
  },
);

export const getSchedule = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<GroupSchedule[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchSchedule } = await import("./zione/parse.server");
    return cached("schedule", fetchSchedule);
  },
);

export const getScorers = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<GroupPlayerStats[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchScorers } = await import("./zione/parse.server");
    return cached("scorers", fetchScorers);
  },
);

export const getCards = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fetched<GroupPlayerStats[]>> => {
    const { cached } = await import("./league-cache.server");
    const { fetchCards } = await import("./zione/parse.server");
    return cached("cards", fetchCards);
  },
);
