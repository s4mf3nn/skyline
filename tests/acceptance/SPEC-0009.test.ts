import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeClock } from "../../src/shared/clock";

// Contrat de SPEC-0009 (Vitest) : client adsbdb.com, cache de session, estimations et formats.
// L'affichage sur Ciel et sur les cartes est joué par SPEC-0009.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec : chargés par chemin, avec les types du contrat d'interface recopiés ici.
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
interface RouteSource {
  fetchRoute(callsign: string): Promise<FlightRoute | null>;
  fetchAircraftType(hex: string): Promise<string | null>;
}
type LookupResult<T> = { status: "found"; value: T } | { status: "unknown" } | { status: "unavailable" };
interface FlightLookup {
  route(callsign: string | null): Promise<LookupResult<FlightRoute>>;
  aircraftType(hex: string): Promise<LookupResult<string>>;
}
interface FakeRouteSource extends RouteSource {
  readonly routeRequests: string[];
  readonly typeRequests: string[];
  setUnavailable(unavailable: boolean): void;
}
interface RoutesModule {
  ROUTE_REQUEST_TIMEOUT_MS: number;
  ROUTE_RETRY_AFTER_MS: number;
  normalizeCallsign(callsign: string | null): string | null;
  createFlightLookup(input: { source: RouteSource; clock: { now(): number } }): FlightLookup;
  estimateFlight(input: {
    route: FlightRoute;
    position: { latitude: number; longitude: number };
    groundSpeedKmh: number | null;
    nowMs: number;
  }): { progress: number | null; arrivalMs: number | null };
  formatRouteCodes(route: FlightRoute): { origin: string; destination: string } | null;
  formatRouteCities(route: FlightRoute): string | null;
  formatEstimatedArrival(timestampMs: number, timeZone: string): string;
  createFakeRouteSource(data?: {
    routes?: Record<string, FlightRoute | null>;
    aircraftTypes?: Record<string, string | null>;
  }): FakeRouteSource;
}
interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
interface FetchInit {
  method: "GET";
  headers: Record<string, string>;
  signal: AbortSignal;
}
type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>;
interface AdsbdbModule {
  ROUTE_REQUEST_TIMEOUT_MS: number;
  buildCallsignUrl(callsign: string | null): string | null;
  buildAircraftUrl(hex: string): string | null;
  createAdsbdbRouteSource(options: { fetch: FetchLike }): RouteSource;
}
const routes = () => load<RoutesModule>("src/shared/routes/index.ts");
const adsbdb = () => load<AdsbdbModule>("src/shared/routes/adsbdb.ts");

const NOW = 1_800_000_000_000;
const KM_PER_DEGREE = (6371 * Math.PI) / 180;

function airport(overrides: Partial<Airport> = {}): Airport {
  return { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55, ...overrides };
}

/** Réponse adsbdb d'une route, avec des champs superflus que le client doit ignorer. */
function flightrouteBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    response: {
      flightroute: {
        callsign: "AFR1015",
        callsign_icao: "AFR1015",
        airline: { name: "Air France", icao: "AFR", iata: "AF" },
        origin: {
          country_iso_name: "HR",
          elevation: 79,
          iata_code: "SPU",
          icao_code: "LDSP",
          latitude: 43.5389,
          longitude: 16.298,
          municipality: "Split",
          name: "Split Airport",
        },
        destination: {
          country_iso_name: "FR",
          elevation: 392,
          iata_code: "CDG",
          icao_code: "LFPG",
          latitude: 49.0128,
          longitude: 2.55,
          municipality: "Paris",
          name: "Charles de Gaulle International Airport",
        },
        ...overrides,
      },
    },
  };
}

function aircraftBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    response: {
      aircraft: {
        type: "A319 111",
        icao_type: "A319",
        manufacturer: "Airbus",
        mode_s: "3944ED",
        registration: "F-GRHN",
        registered_owner: "Air France",
        ...overrides,
      },
    },
  };
}

function reply(status: number, body: unknown): FetchResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Faux de `fetch` : enregistre les appels et répond avec `handler`. */
function stubFetch(handler: (url: string, init: FetchInit) => Promise<FetchResponse>) {
  const calls: Array<{ url: string; init: FetchInit }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetch, calls };
}

async function routeFrom(status: number, body: unknown, callsign = "AFR1015"): Promise<FlightRoute | null> {
  const { createAdsbdbRouteSource } = await adsbdb();
  const { fetch } = stubFetch(async () => reply(status, body));
  return createAdsbdbRouteSource({ fetch }).fetchRoute(callsign);
}

async function typeFrom(status: number, body: unknown, hex = "3944ed"): Promise<string | null> {
  const { createAdsbdbRouteSource } = await adsbdb();
  const { fetch } = stubFetch(async () => reply(status, body));
  return createAdsbdbRouteSource({ fetch }).fetchAircraftType(hex);
}

/** Rejet d'une promesse, ou `null` si elle réussit. */
async function rejectionOf(promise: Promise<unknown>): Promise<(Error & { code?: string }) | null> {
  return promise.then(
    () => null,
    (caught: unknown) => caught as Error & { code?: string },
  );
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe("SPEC-0009 adsbdb.com client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CA1 : normalizes the callsign and builds a fixed-host URL, refusing anything outside the format", async () => {
    const { normalizeCallsign } = await routes();
    const { buildCallsignUrl } = await adsbdb();
    expect(normalizeCallsign(" afr1015 ")).toBe("AFR1015");
    expect(normalizeCallsign("U24617")).toBe("U24617");
    expect(normalizeCallsign("N1")).toBe("N1");
    expect(normalizeCallsign("ABCDEFGH")).toBe("ABCDEFGH");
    for (const hostile of [
      null,
      "",
      "   ",
      "A",
      "ABCDEFGHI",
      "AF R1",
      "AFR1015/..",
      "../v0/aircraft/3944ed",
      "AFR1015?x=1",
      "AFR1015#x",
      "AFR%2F1",
      "ÀFR1",
      "AF\u0000R1",
      "AFR\n1",
      "AFR-1",
    ]) {
      expect(normalizeCallsign(hostile)).toBeNull();
      expect(buildCallsignUrl(hostile)).toBeNull();
    }
    expect(buildCallsignUrl("AFR1015")).toBe("https://api.adsbdb.com/v0/callsign/AFR1015");
    expect(buildCallsignUrl("  afr1015\t")).toBe("https://api.adsbdb.com/v0/callsign/AFR1015");
  });

  it("CA2 : builds the aircraft URL from a six-digit hexadecimal address only", async () => {
    const { buildAircraftUrl } = await adsbdb();
    expect(buildAircraftUrl("3944ed")).toBe("https://api.adsbdb.com/v0/aircraft/3944ed");
    expect(buildAircraftUrl(" 3944ED ")).toBe("https://api.adsbdb.com/v0/aircraft/3944ed");
    for (const hostile of [
      "39 44ED",
      "~3944ed",
      "3944ed/x",
      "3944e",
      "3944edd",
      "",
      "zzzzzz",
      "3944ed?x=1",
      "../3944ed",
    ]) {
      expect(buildAircraftUrl(hostile)).toBeNull();
    }
  });

  it("CA3 : requests a route with one GET carrying only the callsign, and sends nothing for a refused callsign", async () => {
    const { createAdsbdbRouteSource } = await adsbdb();
    const { fetch, calls } = stubFetch(async () => reply(200, flightrouteBody()));
    const source = createAdsbdbRouteSource({ fetch });
    await source.fetchRoute(" afr1015 ");
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0] as { url: string; init: FetchInit };
    expect(url).toBe("https://api.adsbdb.com/v0/callsign/AFR1015");
    expect(init.method).toBe("GET");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(init.headers).map((name) => name.toLowerCase())).toEqual(["accept"]);
    expect(init).not.toHaveProperty("body");
    expect(url).not.toContain("?");

    await expect(source.fetchRoute("AFR1015/../x")).resolves.toBeNull();
    await expect(source.fetchRoute("")).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("CA4 : converts the route, ignoring extra fields and nulling the fields that are missing or invalid", async () => {
    await expect(routeFrom(200, flightrouteBody())).resolves.toEqual({
      origin: { iata: "SPU", city: "Split", latitude: 43.5389, longitude: 16.298 },
      destination: { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55 },
    });

    const route = await routeFrom(
      200,
      flightrouteBody({
        origin: { iata_code: "spu", municipality: "   ", latitude: "43.5", longitude: 181 },
        destination: { iata_code: "CDGX", municipality: "  Paris  ", latitude: -91, longitude: -180 },
      }),
    );
    expect(route).toEqual({
      origin: { iata: null, city: null, latitude: null, longitude: null },
      destination: { iata: null, city: "Paris", latitude: null, longitude: -180 },
    });

    const noAirports = await routeFrom(200, flightrouteBody({ origin: null, destination: "CDG" }));
    const empty = { iata: null, city: null, latitude: null, longitude: null };
    expect(noAirports).toEqual({ origin: empty, destination: empty });
    const missing = await routeFrom(200, { response: { flightroute: {} } });
    expect(missing).toEqual({ origin: empty, destination: empty });
  });

  it("CA5 : treats an unknown callsign as a definitive null answer, not as an error", async () => {
    await expect(routeFrom(404, { response: "unknown callsign" }, "ZZZ9999")).resolves.toBeNull();
    await expect(routeFrom(200, { response: "unknown callsign" }, "ZZZ9999")).resolves.toBeNull();
  });

  it.each([
    { label: "a non-JSON body", status: 200, body: undefined, unreadable: true },
    { label: "an array", status: 200, body: [], unreadable: false },
    { label: "a null body", status: 200, body: null, unreadable: false },
    {
      label: "a response that is neither object nor the unknown phrase",
      status: 200,
      body: { response: "SECRET-BODY-MARKER" },
    },
    { label: "a missing flightroute", status: 200, body: { response: {} } },
    { label: "a null flightroute", status: 200, body: { response: { flightroute: null } } },
    { label: "a flightroute that is not an object", status: 200, body: { response: { flightroute: "AFR1015" } } },
    { label: "a 404 that is not the unknown phrase", status: 404, body: { response: "not found" } },
    { label: "a 400 invalid callsign", status: 400, body: { response: "invalid callsign: AFR1015" } },
    { label: "a 429", status: 429, body: { response: "SECRET-BODY-MARKER too many requests" } },
    { label: "a 500", status: 500, body: flightrouteBody() },
  ])("CA6 : rejects with ROUTE_UNAVAILABLE on $label", async ({ status, body, unreadable }) => {
    const { createAdsbdbRouteSource } = await adsbdb();
    const { fetch } = stubFetch(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (unreadable) throw new SyntaxError("Unexpected token <");
        return body;
      },
    }));
    const caught = await rejectionOf(createAdsbdbRouteSource({ fetch }).fetchRoute("AFR1015"));
    expect(caught?.code).toBe("ROUTE_UNAVAILABLE");
    expect(caught?.message).not.toContain("api.adsbdb.com");
    expect(caught?.message).not.toContain("AFR1015");
    expect(caught?.message).not.toContain("SECRET-BODY-MARKER");
  });

  it("CA6 : rejects with ROUTE_UNAVAILABLE on a network error and on a request that never answers", async () => {
    const { createAdsbdbRouteSource, ROUTE_REQUEST_TIMEOUT_MS } = await adsbdb();
    expect(ROUTE_REQUEST_TIMEOUT_MS).toBe(8_000);

    const failing = createAdsbdbRouteSource({
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    });
    expect((await rejectionOf(failing.fetchRoute("AFR1015")))?.code).toBe("ROUTE_UNAVAILABLE");

    vi.useFakeTimers();
    let signal: AbortSignal | null = null;
    // Un `fetch` qui ignore le signal : le rejet doit avoir lieu quand même.
    const silent = createAdsbdbRouteSource({
      fetch: (_url, init) => {
        signal = init.signal;
        return new Promise<FetchResponse>(() => undefined);
      },
    });
    const pending = rejectionOf(silent.fetchRoute("AFR1015"));
    await vi.advanceTimersByTimeAsync(ROUTE_REQUEST_TIMEOUT_MS - 1);
    expect((signal as AbortSignal | null)?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending)?.code).toBe("ROUTE_UNAVAILABLE");
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
  });

  it("CA7 : reads the aircraft type, with the same request constraints and the same unavailable failures", async () => {
    const { createAdsbdbRouteSource } = await adsbdb();
    const { fetch, calls } = stubFetch(async () => reply(200, aircraftBody()));
    const source = createAdsbdbRouteSource({ fetch });
    await expect(source.fetchAircraftType("3944ED")).resolves.toBe("A319 111");
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0] as { url: string; init: FetchInit };
    expect(url).toBe("https://api.adsbdb.com/v0/aircraft/3944ed");
    expect(init.method).toBe("GET");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(init.headers).map((name) => name.toLowerCase())).toEqual(["accept"]);
    await expect(source.fetchAircraftType("39 44ed")).resolves.toBeNull();
    expect(calls).toHaveLength(1);

    await expect(typeFrom(200, aircraftBody({ type: "  A20N  " }))).resolves.toBe("A20N");
    for (const type of [undefined, null, "", "   ", 320, "X".repeat(41)]) {
      await expect(typeFrom(200, aircraftBody({ type }))).resolves.toBeNull();
    }
    await expect(typeFrom(200, aircraftBody({ type: "X".repeat(40) }))).resolves.toBe("X".repeat(40));
    await expect(typeFrom(404, { response: "unknown aircraft" }, "000000")).resolves.toBeNull();
    await expect(typeFrom(200, { response: "unknown aircraft" }, "000000")).resolves.toBeNull();

    for (const [status, body] of [
      [200, { response: { aircraft: null } }],
      [200, { response: "boom" }],
      [200, []],
      [404, { response: "nope" }],
      [500, aircraftBody()],
    ] as const) {
      expect((await rejectionOf(typeFrom(status, body)))?.code).toBe("ROUTE_UNAVAILABLE");
    }
  });
});

describe("SPEC-0009 session cache", () => {
  const ROUTE: FlightRoute = {
    origin: airport({ iata: "SPU", city: "Split", latitude: 43.5389, longitude: 16.298 }),
    destination: airport(),
  };

  async function setup(data?: Parameters<RoutesModule["createFakeRouteSource"]>[0]) {
    const module = await routes();
    const source = module.createFakeRouteSource(data);
    const clock = createFakeClock(NOW);
    const lookup = module.createFlightLookup({ source, clock });
    return { ...module, source, clock, lookup };
  }

  it("CA8 : keeps definitive answers for the whole session, one source call per aircraft", async () => {
    const { lookup, source } = await setup({
      routes: { AFR1015: ROUTE, PRV1: null },
      aircraftTypes: { "3944ed": "A319 111", "000000": null },
    });
    await expect(lookup.route("AFR1015")).resolves.toEqual({ status: "found", value: ROUTE });
    await expect(lookup.route("afr1015")).resolves.toEqual({ status: "found", value: ROUTE });
    await expect(lookup.route(" AFR1015 ")).resolves.toEqual({ status: "found", value: ROUTE });
    await expect(lookup.route("PRV1")).resolves.toEqual({ status: "unknown" });
    await expect(lookup.route("PRV1")).resolves.toEqual({ status: "unknown" });
    expect(source.routeRequests).toEqual(["AFR1015", "PRV1"]);

    await expect(lookup.aircraftType("3944ED")).resolves.toEqual({ status: "found", value: "A319 111" });
    await expect(lookup.aircraftType("3944ed")).resolves.toEqual({ status: "found", value: "A319 111" });
    await expect(lookup.aircraftType("000000")).resolves.toEqual({ status: "unknown" });
    await expect(lookup.aircraftType("000000")).resolves.toEqual({ status: "unknown" });
    expect(source.typeRequests).toEqual(["3944ed", "000000"]);
  });

  it("CA8 : shares one request between simultaneous calls for the same aircraft", async () => {
    const { lookup, source } = await setup({ routes: { AFR1015: ROUTE }, aircraftTypes: { "3944ed": "A319 111" } });
    const answers = await Promise.all([
      lookup.route("AFR1015"),
      lookup.route("afr1015"),
      lookup.route("AFR1015"),
      lookup.aircraftType("3944ed"),
      lookup.aircraftType("3944ED"),
    ]);
    expect(answers.map((answer) => answer.status)).toEqual(["found", "found", "found", "found", "found"]);
    expect(source.routeRequests).toEqual(["AFR1015"]);
    expect(source.typeRequests).toEqual(["3944ed"]);
  });

  it("CA9 : does not keep an unavailable answer but blocks the source for 10 s, per aircraft", async () => {
    const { lookup, source, clock, ROUTE_RETRY_AFTER_MS } = await setup({
      routes: { AFR1015: ROUTE, BAW117: ROUTE },
      aircraftTypes: { "3944ed": "A319 111" },
    });
    expect(ROUTE_RETRY_AFTER_MS).toBe(10_000);
    source.setUnavailable(true);
    await expect(lookup.route("AFR1015")).resolves.toEqual({ status: "unavailable" });
    expect(source.routeRequests).toEqual(["AFR1015"]);

    source.setUnavailable(false);
    clock.advance(9_999);
    await expect(lookup.route("AFR1015")).resolves.toEqual({ status: "unavailable" });
    expect(source.routeRequests).toEqual(["AFR1015"]);

    // L'échec d'un indicatif ne bloque pas les autres, ni les types.
    await expect(lookup.route("BAW117")).resolves.toEqual({ status: "found", value: ROUTE });
    await expect(lookup.aircraftType("3944ed")).resolves.toEqual({ status: "found", value: "A319 111" });

    clock.advance(1);
    await expect(lookup.route("AFR1015")).resolves.toEqual({ status: "found", value: ROUTE });
    expect(source.routeRequests).toEqual(["AFR1015", "BAW117", "AFR1015"]);
    await expect(lookup.route("AFR1015")).resolves.toEqual({ status: "found", value: ROUTE });
    expect(source.routeRequests).toHaveLength(3);
  });

  it("CA9 : a failing aircraft type is blocked for 10 s too, and a second failure restarts the delay", async () => {
    const { lookup, source, clock } = await setup({ aircraftTypes: { "3944ed": "A319 111" } });
    source.setUnavailable(true);
    await expect(lookup.aircraftType("3944ed")).resolves.toEqual({ status: "unavailable" });
    clock.advance(10_000);
    await expect(lookup.aircraftType("3944ed")).resolves.toEqual({ status: "unavailable" });
    expect(source.typeRequests).toHaveLength(2);
    source.setUnavailable(false);
    clock.advance(9_999);
    await expect(lookup.aircraftType("3944ed")).resolves.toEqual({ status: "unavailable" });
    expect(source.typeRequests).toHaveLength(2);
    clock.advance(1);
    await expect(lookup.aircraftType("3944ed")).resolves.toEqual({ status: "found", value: "A319 111" });
  });

  it("CA10 : answers unknown without calling the source for a refused callsign or address", async () => {
    const { lookup, source } = await setup({ routes: { AFR1015: ROUTE } });
    for (const hostile of [null, "", "AFR1015/..", "A", "AFR 1015"]) {
      await expect(lookup.route(hostile)).resolves.toEqual({ status: "unknown" });
    }
    for (const hostile of ["", "3944e", "~3944ed", "../3944ed"]) {
      await expect(lookup.aircraftType(hostile)).resolves.toEqual({ status: "unknown" });
    }
    expect(source.routeRequests).toEqual([]);
    expect(source.typeRequests).toEqual([]);
  });
});

describe("SPEC-0009 estimates and formats", () => {
  // Géométrie sur un méridien : l'orthodromie est exactement `Δlatitude × 111,195 km`.
  const at = (northKm: number) => ({ latitude: 45 + northKm / KM_PER_DEGREE, longitude: 4.8 });
  const route = (originNorthKm: number, destinationNorthKm: number): FlightRoute => ({
    origin: airport({ iata: "LYS", city: "Lyon", ...at(originNorthKm) }),
    destination: airport({ iata: "CDG", city: "Paris", ...at(destinationNorthKm) }),
  });

  it("CA11 : estimates progress as the distance flown over the origin-destination distance", async () => {
    const { estimateFlight } = await routes();
    const quarter = estimateFlight({ route: route(0, 480), position: at(120), groundSpeedKmh: 720, nowMs: NOW });
    expect(quarter.progress).toBeCloseTo(0.25, 3);
    const start = estimateFlight({ route: route(0, 480), position: at(0), groundSpeedKmh: 720, nowMs: NOW });
    expect(start.progress).toBe(0);
    const arrived = estimateFlight({ route: route(0, 480), position: at(480), groundSpeedKmh: 720, nowMs: NOW });
    expect(arrived.progress).toBeCloseTo(1, 3);
  });

  it("CA11 : bounds progress to [0, 1] for an aircraft behind its origin or past its destination", async () => {
    const { estimateFlight } = await routes();
    const past = estimateFlight({ route: route(0, 480), position: at(600), groundSpeedKmh: 720, nowMs: NOW });
    expect(past.progress).toBe(1);
    // Derrière l'origine, sur le même méridien : la distance parcourue vaut 100 km (orthodromie, jamais négative).
    const behind = estimateFlight({ route: route(0, 480), position: at(-100), groundSpeedKmh: 720, nowMs: NOW });
    expect(behind.progress).toBeCloseTo(100 / 480, 3);
  });

  it("CA11 : estimates the arrival from the remaining distance and the ground speed", async () => {
    const { estimateFlight } = await routes();
    // 363 km restants à 720 km/h : 1 815 s.
    const estimate = estimateFlight({ route: route(0, 484), position: at(121), groundSpeedKmh: 720, nowMs: NOW });
    expect(estimate.arrivalMs).not.toBeNull();
    expect(Math.abs((estimate.arrivalMs as number) - (NOW + 1_815_000))).toBeLessThanOrEqual(1_000);
    // L'avion qui a dépassé sa destination : distance restante positive, jamais une heure passée.
    const past = estimateFlight({ route: route(0, 484), position: at(500), groundSpeedKmh: 720, nowMs: NOW });
    expect(past.arrivalMs).toBeGreaterThan(NOW);
    // La distance se lit sur l'orthodromie, pas sur un plan : un trajet est-ouest de 600 km.
    const east = { latitude: 60, longitude: 10 };
    const far = { latitude: 60, longitude: 25 };
    const eastRoute: FlightRoute = { origin: airport({ ...east }), destination: airport({ ...far }) };
    const expectedKm = haversineKm(east, far);
    const flown = estimateFlight({ route: eastRoute, position: east, groundSpeedKmh: 900, nowMs: NOW });
    expect(Math.abs((flown.arrivalMs as number) - NOW - (expectedKm / 900) * 3_600_000)).toBeLessThanOrEqual(1_000);
  });

  it("CA11 : computes progress and arrival independently, and nulls what cannot be known", async () => {
    const { estimateFlight } = await routes();
    const base = route(0, 480);
    const noOriginCoordinates: FlightRoute = {
      ...base,
      origin: { ...base.origin, latitude: null, longitude: null },
    };
    const withoutOrigin = estimateFlight({
      route: noOriginCoordinates,
      position: at(120),
      groundSpeedKmh: 720,
      nowMs: NOW,
    });
    expect(withoutOrigin.progress).toBeNull();
    expect(withoutOrigin.arrivalMs).not.toBeNull();

    const noDestinationCoordinates: FlightRoute = {
      ...base,
      destination: { ...base.destination, latitude: 49, longitude: null },
    };
    const withoutDestination = estimateFlight({
      route: noDestinationCoordinates,
      position: at(120),
      groundSpeedKmh: 720,
      nowMs: NOW,
    });
    expect(withoutDestination).toEqual({ progress: null, arrivalMs: null });

    for (const groundSpeedKmh of [null, 0, -10]) {
      const slow = estimateFlight({ route: base, position: at(120), groundSpeedKmh, nowMs: NOW });
      expect(slow.arrivalMs).toBeNull();
      expect(slow.progress).toBeCloseTo(0.25, 3);
    }

    // Deux aéroports à moins de 1 km l'un de l'autre : pas de progression.
    const local = estimateFlight({ route: route(0, 0.9), position: at(0.4), groundSpeedKmh: 720, nowMs: NOW });
    expect(local.progress).toBeNull();
    expect(local.arrivalMs).not.toBeNull();
  });

  it("CA12 : formats the codes, the cities and the estimated arrival, or nothing when incomplete", async () => {
    const { formatRouteCodes, formatRouteCities, formatEstimatedArrival } = await routes();
    const complete: FlightRoute = {
      origin: airport({ iata: "CDG", city: "Paris" }),
      destination: airport({ iata: "DUS", city: "Düsseldorf" }),
    };
    expect(formatRouteCodes(complete)).toEqual({ origin: "CDG", destination: "DUS" });
    expect(formatRouteCities(complete)).toBe("Paris → Düsseldorf");

    const noCode: FlightRoute = { ...complete, destination: airport({ iata: null, city: "Düsseldorf" }) };
    expect(formatRouteCodes(noCode)).toBeNull();
    expect(formatRouteCities(noCode)).toBe("Paris → Düsseldorf");
    const noCity: FlightRoute = { ...complete, origin: airport({ iata: "CDG", city: null }) };
    expect(formatRouteCodes(noCity)).toEqual({ origin: "CDG", destination: "DUS" });
    expect(formatRouteCities(noCity)).toBeNull();

    expect(formatEstimatedArrival(1_800_000_000_000, "Europe/Paris")).toBe("~09:00");
    expect(formatEstimatedArrival(1_800_000_000_000, "Pacific/Auckland")).toBe("~21:00");
    expect(formatEstimatedArrival(1_800_000_000_000, "Asia/Kolkata")).toBe("~13:30");
    expect(formatEstimatedArrival(1_800_000_059_999, "Europe/Paris")).toBe("~09:00");
    // 23:05 UTC la veille : 00:05 à Paris, jamais « 24:05 ».
    expect(formatEstimatedArrival(NOW - 32_100_000, "Europe/Paris")).toBe("~00:05");
  });
});
