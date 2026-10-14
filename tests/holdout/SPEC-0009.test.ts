import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeClock } from "../../src/shared/clock";

// Scénarios cachés de SPEC-0009 (Vitest) : parcours du client, du cache et des estimations avec d'autres données
// que le contrat de tests.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Airport {
  iata: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface FlightRoute {
  origin: Airport;
  destination: Airport;
}
type LookupResult<T> = { status: "found"; value: T } | { status: "unknown" } | { status: "unavailable" };
interface RouteSource {
  fetchRoute(callsign: string): Promise<FlightRoute | null>;
  fetchAircraftType(hex: string): Promise<string | null>;
}
interface FetchInit {
  method: "GET";
  headers: Record<string, string>;
  signal: AbortSignal;
}
interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
interface AdsbdbModule {
  createAdsbdbRouteSource(options: { fetch: (url: string, init: FetchInit) => Promise<FetchResponse> }): RouteSource;
}
interface RoutesModule {
  createFlightLookup(input: { source: RouteSource; clock: { now(): number } }): {
    route(callsign: string | null): Promise<LookupResult<FlightRoute>>;
    aircraftType(hex: string): Promise<LookupResult<string>>;
  };
  estimateFlight(input: {
    route: FlightRoute;
    position: { latitude: number; longitude: number };
    groundSpeedKmh: number | null;
    nowMs: number;
  }): { progress: number | null; arrivalMs: number | null };
  formatRouteCodes(route: FlightRoute): { origin: string; destination: string } | null;
  formatRouteCities(route: FlightRoute): string | null;
  formatEstimatedArrival(timestampMs: number, timeZone: string): string;
}
const routes = () => load<RoutesModule>("src/shared/routes/index.ts");
const adsbdb = () => load<AdsbdbModule>("src/shared/routes/adsbdb.ts");

const NOW = 1_800_000_000_000;

function reply(status: number, body: unknown): FetchResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function airportBody(code: string, city: string, latitude: number, longitude: number) {
  return { iata_code: code, municipality: city, latitude, longitude, name: `${city} Airport`, elevation: 12 };
}

describe("SPEC-0009 hidden scenarios (client and cache)", () => {
  it("serves a session: normalized calls, definitive answers kept, outage retried after the delay", async () => {
    const { createAdsbdbRouteSource } = await adsbdb();
    const { createFlightLookup } = await routes();
    const urls: string[] = [];
    let outage = false;
    const fetch = async (url: string): Promise<FetchResponse> => {
      urls.push(url);
      if (outage) return reply(503, { response: "unavailable" });
      if (url.endsWith("/callsign/EZY12AB")) {
        return reply(200, {
          response: {
            flightroute: {
              origin: airportBody("LYS", "Lyon", 45.7256, 5.0811),
              destination: airportBody("LGW", "Londres", 51.1481, -0.1903),
            },
          },
        });
      }
      if (url.endsWith("/callsign/PRIV01")) return reply(404, { response: "unknown callsign" });
      if (url.endsWith("/aircraft/406a11")) return reply(200, { response: { aircraft: { type: "A320 214" } } });
      return reply(404, { response: "unknown aircraft" });
    };
    const clock = createFakeClock(NOW);
    const lookup = createFlightLookup({ source: createAdsbdbRouteSource({ fetch }), clock });

    const first = await lookup.route("ezy12ab ");
    expect(first).toEqual({
      status: "found",
      value: {
        origin: { iata: "LYS", city: "Lyon", latitude: 45.7256, longitude: 5.0811 },
        destination: { iata: "LGW", city: "Londres", latitude: 51.1481, longitude: -0.1903 },
      },
    });
    await expect(lookup.route("PRIV01")).resolves.toEqual({ status: "unknown" });
    await expect(lookup.route("ezy12ab")).resolves.toEqual(first);
    await expect(lookup.route("PRIV01")).resolves.toEqual({ status: "unknown" });
    await expect(lookup.route("EZY/../12")).resolves.toEqual({ status: "unknown" });
    expect(urls).toEqual(["https://api.adsbdb.com/v0/callsign/EZY12AB", "https://api.adsbdb.com/v0/callsign/PRIV01"]);

    outage = true;
    await expect(lookup.aircraftType("406A11")).resolves.toEqual({ status: "unavailable" });
    outage = false;
    clock.advance(9_000);
    await expect(lookup.aircraftType("406a11")).resolves.toEqual({ status: "unavailable" });
    expect(urls.filter((url) => url.includes("/aircraft/"))).toHaveLength(1);
    clock.advance(1_000);
    await expect(lookup.aircraftType("406a11")).resolves.toEqual({ status: "found", value: "A320 214" });
    await expect(lookup.aircraftType("406a11")).resolves.toEqual({ status: "found", value: "A320 214" });
    await expect(lookup.aircraftType("00ffff")).resolves.toEqual({ status: "unknown" });
    expect(urls.filter((url) => url.includes("/aircraft/"))).toEqual([
      "https://api.adsbdb.com/v0/aircraft/406a11",
      "https://api.adsbdb.com/v0/aircraft/406a11",
      "https://api.adsbdb.com/v0/aircraft/00ffff",
    ]);
  });

  it("turns a route into display values for a transatlantic leg, a local flight and a half-hour time zone", async () => {
    const { estimateFlight, formatRouteCodes, formatRouteCities, formatEstimatedArrival } = await routes();
    const transatlantic: FlightRoute = {
      origin: { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55 },
      destination: { iata: "JFK", city: "New York", latitude: 40.6398, longitude: -73.7789 },
    };
    // Position à mi-chemin environ sur l'orthodromie : la progression est proche de 50 %, jamais hors de [0, 1].
    const middle = { latitude: 52.2, longitude: -35 };
    const estimate = estimateFlight({ route: transatlantic, position: middle, groundSpeedKmh: 900, nowMs: NOW });
    expect(estimate.progress).toBeGreaterThan(0.4);
    expect(estimate.progress).toBeLessThan(0.6);
    expect(estimate.arrivalMs).toBeGreaterThan(NOW + 2 * 3_600_000);
    expect(estimate.arrivalMs).toBeLessThan(NOW + 5 * 3_600_000);
    expect(formatRouteCodes(transatlantic)).toEqual({ origin: "CDG", destination: "JFK" });
    expect(formatRouteCities(transatlantic)).toBe("Paris → New York");

    // Vol local : deux aéroports confondus, pas de progression, mais codes, villes et arrivée restent calculés.
    const local: FlightRoute = {
      origin: { iata: "LYS", city: "Lyon", latitude: 45.7256, longitude: 5.0811 },
      destination: { iata: "LYS", city: "Lyon", latitude: 45.7256, longitude: 5.0811 },
    };
    const circuit = estimateFlight({
      route: local,
      position: { latitude: 45.75, longitude: 5.1 },
      groundSpeedKmh: 180,
      nowMs: NOW,
    });
    expect(circuit.progress).toBeNull();
    expect(circuit.arrivalMs).not.toBeNull();
    expect(formatRouteCodes(local)).toEqual({ origin: "LYS", destination: "LYS" });

    // 1_800_000_000_000 : 08:00 UTC ; Kolkata est en UTC+5:30, Katmandou en UTC+5:45.
    expect(formatEstimatedArrival(NOW, "Asia/Kolkata")).toBe("~13:30");
    expect(formatEstimatedArrival(NOW + 59_999, "Asia/Kathmandu")).toBe("~13:45");
    expect(formatEstimatedArrival(NOW, "America/New_York")).toBe("~03:00");
  });
});
