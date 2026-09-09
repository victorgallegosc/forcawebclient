import { queryOptions } from "@tanstack/react-query";

import { getCards, getSchedule, getScorers, getStandings } from "./league.functions";

export const standingsQuery = queryOptions({
  queryKey: ["standings"],
  queryFn: () => getStandings(),
  staleTime: 5 * 60 * 1000,
});

export const scheduleQuery = queryOptions({
  queryKey: ["schedule"],
  queryFn: () => getSchedule(),
  staleTime: 5 * 60 * 1000,
});

export const scorersQuery = queryOptions({
  queryKey: ["scorers"],
  queryFn: () => getScorers(),
  staleTime: 5 * 60 * 1000,
});

export const cardsQuery = queryOptions({
  queryKey: ["cards"],
  queryFn: () => getCards(),
  staleTime: 5 * 60 * 1000,
});
