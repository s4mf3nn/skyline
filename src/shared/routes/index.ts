// Point d'entrée : types, constantes, normalisation, faux et cache de session. Le client réseau vit dans `adsbdb.ts`.
export interface Airport {
  iata: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface FlightRoute {
  origin: Airport;
  destination: Airport;
}

/** Source des routes (ADR-0002). `null` : réponse définitive « inconnu ». Rejette avec `ROUTE_UNAVAILABLE`. */
export interface RouteSource {
  fetchRoute(callsign: string): Promise<FlightRoute | null>;
  fetchAircraftType(hex: string): Promise<string | null>;
}

export type LookupResult<T> = { status: "found"; value: T } | { status: "unknown" } | { status: "unavailable" };

export interface FlightLookup {
  route(callsign: string | null): Promise<LookupResult<FlightRoute>>;
  aircraftType(hex: string): Promise<LookupResult<string>>;
}

export const ROUTE_REQUEST_TIMEOUT_MS = 8_000;
export const ROUTE_RETRY_AFTER_MS = 10_000;

const CALLSIGN_FORMAT = /^[A-Z0-9]{2,8}$/;
const HEX_FORMAT = /^[0-9a-f]{6}$/;

/** Indicatif sans blancs de bord, en majuscules, ou `null` s'il n'a pas le format attendu. */
export function normalizeCallsign(callsign: string | null): string | null {
  if (callsign === null) return null;
  const normalized = callsign.trim().toUpperCase();
  return CALLSIGN_FORMAT.test(normalized) ? normalized : null;
}

/** Adresse OACI sans blancs de bord, en minuscules, ou `null` si ce n'est pas 6 chiffres hexadécimaux. */
export function normalizeHex(hex: string): string | null {
  const normalized = hex.trim().toLowerCase();
  return HEX_FORMAT.test(normalized) ? normalized : null;
}

export { createFakeRouteSource } from "./fake";
export { createFlightLookup } from "./lookup";
