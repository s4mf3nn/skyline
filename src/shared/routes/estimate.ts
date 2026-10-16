import { formatClockTime } from "../clock";
import { groundDistanceKm } from "../scene/geo";
import type { Airport, FlightRoute } from "./index";

/** Deux aéroports plus proches que cette distance : pas de progression à estimer. */
const MIN_ROUTE_DISTANCE_KM = 1;
const MS_PER_HOUR = 3_600_000;

interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface EstimateInput {
  route: FlightRoute;
  /** Position de l'avion à `nowMs`. */
  position: Coordinates;
  groundSpeedKmh: number | null;
  nowMs: number;
}

export interface FlightEstimate {
  progress: number | null;
  arrivalMs: number | null;
}

/** Vue de Ciel : chaque ligne est `null` tant qu'elle est incomplète. */
export interface SkyRouteView {
  codes: { origin: string; destination: string } | null;
  cities: string | null;
  arrival: string | null;
  progressPercent: number | null;
}

function coordinatesOf(airport: Airport): Coordinates | null {
  if (airport.latitude === null || airport.longitude === null) return null;
  return { latitude: airport.latitude, longitude: airport.longitude };
}

function progressOf(route: FlightRoute, position: Coordinates): number | null {
  const origin = coordinatesOf(route.origin);
  const destination = coordinatesOf(route.destination);
  if (origin === null || destination === null) return null;
  const totalKm = groundDistanceKm(origin, destination);
  if (totalKm < MIN_ROUTE_DISTANCE_KM) return null;
  return Math.min(1, groundDistanceKm(origin, position) / totalKm);
}

function arrivalOf(input: EstimateInput): number | null {
  const destination = coordinatesOf(input.route.destination);
  const { groundSpeedKmh } = input;
  if (destination === null || groundSpeedKmh === null || groundSpeedKmh <= 0) return null;
  const remainingKm = groundDistanceKm(input.position, destination);
  return Math.round(input.nowMs + (remainingKm / groundSpeedKmh) * MS_PER_HOUR);
}

/** Avancement du vol et heure d'arrivée, estimés sur l'appareil (ADR-0003) ; chacun est `null` sans l'autre. */
export function estimateFlight(input: EstimateInput): FlightEstimate {
  return { progress: progressOf(input.route, input.position), arrivalMs: arrivalOf(input) };
}

/** Codes IATA d'origine et de destination, ou `null` si l'un manque. */
export function formatRouteCodes(route: FlightRoute): { origin: string; destination: string } | null {
  const { iata: origin } = route.origin;
  const { iata: destination } = route.destination;
  return origin === null || destination === null ? null : { origin, destination };
}

/** « Ville d'origine → ville de destination », ou `null` si l'une manque. */
export function formatRouteCities(route: FlightRoute): string | null {
  const { city: origin } = route.origin;
  const { city: destination } = route.destination;
  return origin === null || destination === null ? null : `${origin} → ${destination}`;
}

/** `~HH:MM` dans le fuseau reçu : le tilde dit que l'heure est une estimation. */
export function formatEstimatedArrival(timestampMs: number, timeZone: string): string {
  return `~${formatClockTime(timestampMs, timeZone)}`;
}

/** Tout ce que Ciel affiche du vol, calculé ici pour que l'écran ne fasse aucun calcul. */
export function skyRouteView(input: EstimateInput & { timeZone: string }): SkyRouteView {
  const { progress, arrivalMs } = estimateFlight(input);
  return {
    codes: formatRouteCodes(input.route),
    cities: formatRouteCities(input.route),
    arrival: arrivalMs === null ? null : formatEstimatedArrival(arrivalMs, input.timeZone),
    progressPercent: progress === null ? null : Math.round(100 * progress),
  };
}
