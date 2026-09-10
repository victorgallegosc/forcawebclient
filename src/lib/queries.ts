import { queryOptions } from "@tanstack/react-query";

import { getCards, getSchedule, getScorers, getStandings } from "./league.functions";
import { getRideState } from "./rides/rides.functions";

export const standingsQuery = queryOptions({
  queryKey: ["standings"],
  queryFn: () => getStandings(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

export const scheduleQuery = queryOptions({
  queryKey: ["schedule"],
  queryFn: () => getSchedule(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

export const scorersQuery = queryOptions({
  queryKey: ["scorers"],
  queryFn: () => getScorers(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

export const cardsQuery = queryOptions({
  queryKey: ["cards"],
  queryFn: () => getCards(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

/** Loaded on the server too, so the first render already knows the rotation. */
export const rideStateQuery = queryOptions({
  queryKey: ["ride-state"],
  queryFn: () => getRideState(),
  staleTime: 30 * 1000,
});
