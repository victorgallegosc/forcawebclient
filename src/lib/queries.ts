import { queryOptions } from "@tanstack/react-query";

import { getCards, getSchedule, getScorers, getStandings } from "./league.functions";
import { getRideState } from "./rides/rides.functions";
import { getDriverRouteFn } from "./rides/maps.functions";
import type { Driver } from "./rides/rotation";
import { TOURNAMENT_ID } from "./zione/constants";

export const standingsQuery = queryOptions({
  queryKey: ["standings", TOURNAMENT_ID],
  queryFn: () => getStandings(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

export const scheduleQuery = queryOptions({
  queryKey: ["schedule", TOURNAMENT_ID],
  queryFn: () => getSchedule(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

export const scorersQuery = queryOptions({
  queryKey: ["scorers", TOURNAMENT_ID],
  queryFn: () => getScorers(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

export const cardsQuery = queryOptions({
  queryKey: ["cards", TOURNAMENT_ID],
  queryFn: () => getCards(),
  staleTime: 5 * 60 * 1000,
  retry: 2,
  retryDelay: (attempt: number) => 400 * (attempt + 1),
});

/** Loaded on the server too, so the first render already knows the rotation. */
export const rideStateQuery = queryOptions({
  queryKey: ["ride-state", TOURNAMENT_ID],
  queryFn: () => getRideState(),
  staleTime: 30 * 1000,
});

export function driverRouteQuery(driver: Driver) {
  return queryOptions({
    queryKey: ["driver-route", TOURNAMENT_ID, driver],
    queryFn: () => getDriverRouteFn({ data: { driver } }),
    staleTime: 10 * 60 * 1000,
  });
}