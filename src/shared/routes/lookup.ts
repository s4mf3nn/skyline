import type { Clock } from "../clock";
import {
  type FlightLookup,
  type FlightRoute,
  type LookupResult,
  normalizeCallsign,
  normalizeHex,
  ROUTE_RETRY_AFTER_MS,
  type RouteSource,
} from "./index";

type Entry<T> =
  | { kind: "settled"; result: LookupResult<T> }
  | { kind: "pending"; promise: Promise<LookupResult<T>> }
  | { kind: "failed"; atMs: number };

/** Une table de recherche : réponses définitives gardées, requêtes partagées, reprise après délai. */
function createTable<T>(fetchValue: (key: string) => Promise<T | null>, clock: Clock) {
  const entries = new Map<string, Entry<T>>();

  async function request(key: string): Promise<LookupResult<T>> {
    try {
      const value = await fetchValue(key);
      const result: LookupResult<T> = value === null ? { status: "unknown" } : { status: "found", value };
      entries.set(key, { kind: "settled", result });
      return result;
    } catch {
      // Échec non gardé comme réponse : la source est seulement bloquée pendant le délai de reprise.
      entries.set(key, { kind: "failed", atMs: clock.now() });
      return { status: "unavailable" };
    }
  }

  return (key: string): Promise<LookupResult<T>> => {
    const entry = entries.get(key);
    if (entry?.kind === "settled") return Promise.resolve(entry.result);
    if (entry?.kind === "pending") return entry.promise;
    if (entry?.kind === "failed" && clock.now() - entry.atMs < ROUTE_RETRY_AFTER_MS) {
      return Promise.resolve({ status: "unavailable" });
    }
    const promise = request(key);
    entries.set(key, { kind: "pending", promise });
    return promise;
  };
}

/** Cache de session des routes et des types d'appareil devant une `RouteSource`. */
export function createFlightLookup(input: { source: RouteSource; clock: Clock }): FlightLookup {
  const { source, clock } = input;
  const lookupRoute = createTable<FlightRoute>((callsign) => source.fetchRoute(callsign), clock);
  const lookupType = createTable<string>((hex) => source.fetchAircraftType(hex), clock);
  const unknown = { status: "unknown" } as const;

  return {
    async route(callsign) {
      const key = normalizeCallsign(callsign);
      return key === null ? unknown : lookupRoute(key);
    },
    async aircraftType(hex) {
      const key = normalizeHex(hex);
      return key === null ? unknown : lookupType(key);
    },
  };
}
