import type { Driver } from "./rotation";

export type MapStopId = "victor" | "gabo" | "mau" | "canchas";

export type MapStop = {
  id: MapStopId;
  label: string;
  plusCode: string;
  lat: number;
  lng: number;
};

export const RIDE_STOPS: Record<MapStopId, MapStop> = {
  victor: {
    id: "victor",
    label: "Casa de Víctor",
    plusCode: "75QXPJR3+W4",
    lat: 25.7422714,
    lng: -100.397197,
  },
  gabo: {
    id: "gabo",
    label: "Casa de Gabo",
    plusCode: "QH4V+FF2 Monterrey, Nuevo León",
    lat: 25.7561321,
    lng: -100.4063682,
  },
  mau: {
    id: "mau",
    label: "Casa de Mau",
    plusCode: "PJRG+C3F Monterrey, Nuevo León",
    lat: 25.7410709,
    lng: -100.3748193,
  },
  canchas: {
    id: "canchas",
    label: "Canchas",
    plusCode: "QP4G+4H San Nicolás de los Garza, Nuevo León",
    lat: 25.75545,
    lng: -100.2735059,
  },
};

/** Pickup order after leaving the driver's house, ending at the fields. */
export const DRIVER_ROUTE: Record<Driver, MapStopId[]> = {
  "Víctor": ["victor", "gabo", "mau", "canchas"],
  Mau: ["mau", "gabo", "victor", "canchas"],
  Gabo: ["gabo", "victor", "mau", "canchas"],
};

export type RouteLeg = {
  from: MapStop;
  to: MapStop;
  durationText: string;
  durationSeconds: number;
  distanceText: string;
  distanceMeters: number;
};

export type DriverRoutePlan = {
  driver: Driver;
  stops: MapStop[];
  legs: RouteLeg[];
  totalDurationSeconds: number;
  totalDurationText: string;
  totalDistanceMeters: number;
  totalDistanceText: string;
  mapsUrl: string;
  source: "google" | "unavailable";
};

function coords(stop: MapStop) {
  return `${stop.lat},${stop.lng}`;
}

export function googleMapsDirectionsUrl(driver: Driver): string {
  const ids = DRIVER_ROUTE[driver];
  const stops = ids.map((id) => RIDE_STOPS[id]);
  const origin = coords(stops[0]!);
  const destination = coords(stops[stops.length - 1]!);
  const waypoints = stops
    .slice(1, -1)
    .map((stop) => coords(stop))
    .join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function emptyPlan(driver: Driver, stops: MapStop[], mapsUrl: string): DriverRoutePlan {
  return {
    driver,
    stops,
    legs: [],
    totalDurationSeconds: 0,
    totalDurationText: "—",
    totalDistanceMeters: 0,
    totalDistanceText: "—",
    mapsUrl,
    source: "unavailable",
  };
}

type DirectionsResponse = {
  status: string;
  error_message?: string;
  routes?: Array<{
    legs: Array<{
      duration: { text: string; value: number };
      distance: { text: string; value: number };
    }>;
  }>;
};

export async function fetchDriverRoutePlan(driver: Driver): Promise<DriverRoutePlan> {
  const ids = DRIVER_ROUTE[driver];
  const stops = ids.map((id) => RIDE_STOPS[id]);
  const mapsUrl = googleMapsDirectionsUrl(driver);
  const key =
    process.env["GOOGLE_MAPS_API_KEY"] ||
    process.env["VITE_GOOGLE_MAPS_API_KEY"] ||
    process.env["GOOGLE_API_KEY"];

  if (!key) {
    return emptyPlan(driver, stops, mapsUrl);
  }

  const origin = coords(stops[0]!);
  const destination = coords(stops[stops.length - 1]!);
  const waypoints = stops
    .slice(1, -1)
    .map((stop) => coords(stop))
    .join("|");

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "mx");
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");
  if (waypoints) url.searchParams.set("waypoints", waypoints);
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) {
    return emptyPlan(driver, stops, mapsUrl);
  }

  const data = (await response.json()) as DirectionsResponse;
  if (data.status !== "OK" || !data.routes?.[0]?.legs) {
    return emptyPlan(driver, stops, mapsUrl);
  }

  const apiLegs = data.routes[0].legs;
  const legs: RouteLeg[] = apiLegs.map((leg, index) => ({
    from: stops[index]!,
    to: stops[index + 1]!,
    durationText: leg.duration.text,
    durationSeconds: leg.duration.value,
    distanceText: leg.distance.text,
    distanceMeters: leg.distance.value,
  }));

  const totalDurationSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
  const totalDistanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);

  return {
    driver,
    stops,
    legs,
    totalDurationSeconds,
    totalDurationText: formatDuration(totalDurationSeconds),
    totalDistanceMeters,
    totalDistanceText: formatDistance(totalDistanceMeters),
    mapsUrl,
    source: "google",
  };
}
