import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdsbQuery, AdsbSource, Aircraft } from "../../src/shared/adsb";

// Contrat de SPEC-0007 (Vitest) : client adsb.lol, conversion, validation, choix de la source.
// Le rafraîchissement toutes les 10 s est joué par SPEC-0007.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec : chargés par chemin, avec les types du contrat d'interface recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

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
interface AdsbLolModule {
  ADSB_REQUEST_TIMEOUT_MS: number;
  buildAdsbLolUrl(query: AdsbQuery): string;
  createAdsbLolSource(options: { fetch: FetchLike }): AdsbSource;
}
interface SelectModule {
  chooseAdsbSource(input: { isDev: boolean; requested: string | undefined }): "demo" | "real";
}
const adsbLol = () => load<AdsbLolModule>("src/shared/adsb/adsblol.ts");
const select = () => load<SelectModule>("src/shared/adsb/select.ts");

const LYON: AdsbQuery = { latitude: 45.764, longitude: 4.836, radiusKm: 80 };
const KM_PER_DEGREE = (6371 * Math.PI) / 180;

/** Avion au format adsb.lol : pieds, nœuds, `flight` complété de blancs. */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hex: "7380c7",
    type: "adsb_icao",
    flight: "ELY018  ",
    alt_baro: 38975,
    gs: 548.5,
    track: 107.18,
    lat: 45.66687,
    lon: 4.181906,
    seen_pos: 0,
    ...overrides,
  };
}

function okResponse(body: unknown): FetchResponse {
  return { ok: true, status: 200, json: async () => body };
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

async function fetchWith(body: unknown, query: AdsbQuery = LYON): Promise<Aircraft[]> {
  const { createAdsbLolSource } = await adsbLol();
  const { fetch } = stubFetch(async () => okResponse(body));
  return createAdsbLolSource({ fetch }).fetchAircraft(query);
}

/** Rejet d'une promesse, ou `null` si elle réussit. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(
    () => null,
    (caught: unknown) => caught as Error,
  );
}

const COORDINATES = /45\.7|4\.83|-?\d+\.\d{3}/;

function expectNear(actual: number | null, expected: number, tolerance: number) {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(tolerance);
}

describe("SPEC-0007 adsb.lol client", () => {
  it("CA1 : builds the request URL with a fixed host, 3-decimal coordinates and a radius in nautical miles", async () => {
    const { buildAdsbLolUrl } = await adsbLol();
    expect(buildAdsbLolUrl({ latitude: 45.7644, longitude: 4.8357, radiusKm: 80 })).toBe(
      "https://api.adsb.lol/v2/point/45.764/4.836/44",
    );
    expect(buildAdsbLolUrl({ latitude: -33.8688, longitude: 151.2093, radiusKm: 10 })).toBe(
      "https://api.adsb.lol/v2/point/-33.869/151.209/6",
    );
    expect(buildAdsbLolUrl({ latitude: 45.5, longitude: -0.0004, radiusKm: 1000 })).toBe(
      "https://api.adsb.lol/v2/point/45.5/0/250",
    );
  });

  it("CA2 : calls fetch once with GET, an abort signal and no position outside the URL, then converts the units", async () => {
    const { createAdsbLolSource } = await adsbLol();
    const { fetch, calls } = stubFetch(async () =>
      okResponse({ ac: [raw({ hex: "7380C7", extra: { any: 1 } })], now: 1 }),
    );
    const aircraft = await createAdsbLolSource({ fetch }).fetchAircraft(LYON);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.adsb.lol/v2/point/45.764/4.836/44");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(calls[0]?.init.headers)).not.toMatch(/45\.7|4\.83/);

    expect(aircraft).toHaveLength(1);
    const [plane] = aircraft as [Aircraft];
    expect(plane.hex).toBe("7380c7");
    expect(plane.callsign).toBe("ELY018");
    expect(plane.latitude).toBeCloseTo(45.66687, 5);
    expect(plane.longitude).toBeCloseTo(4.181906, 5);
    expectNear(plane.altitudeM, 11879.58, 1);
    expectNear(plane.groundSpeedKmh, 1015.8, 0.1);
    expect(plane.trackDeg).toBeCloseTo(107.18, 2);
  });

  it("CA2 : gives a null callsign when the flight is empty, blank or absent", async () => {
    const aircraft = await fetchWith({
      ac: [
        raw({ hex: "aaaaaa", flight: "" }),
        raw({ hex: "bbbbbb", flight: "      " }),
        raw({ hex: "cccccc", flight: undefined }),
      ],
    });
    expect(aircraft.map((plane) => plane.callsign)).toEqual([null, null, null]);
  });

  it("CA3 : drops the aircraft on the ground and keeps an aircraft with a zero ground speed", async () => {
    const aircraft = await fetchWith({
      ac: [
        raw({ hex: "aaaaaa", alt_baro: "ground", gs: 12 }),
        raw({ hex: "bbbbbb", alt_baro: 1200, gs: 0 }),
        raw({ hex: "cccccc", alt_baro: "ground" }),
      ],
    });
    expect(aircraft.map((plane) => plane.hex)).toEqual(["bbbbbb"]);
    expect(aircraft[0]?.groundSpeedKmh).toBe(0);
  });

  it("CA4 : advances the position along the track by the age of the position", async () => {
    // 400 nœuds = 740,8 km/h = 0,2058 km/s ; 10 s donnent 2,058 km.
    const north = raw({ hex: "a00001", lat: 45.7, lon: 4.8, track: 0, gs: 400, seen_pos: 10 });
    const east = raw({ hex: "a00002", lat: 45.7, lon: 4.8, track: 90, gs: 400, seen_pos: 10 });
    const fresh = raw({ hex: "a00003", lat: 45.7, lon: 4.8, track: 0, gs: 400, seen_pos: 0 });
    const aircraft = await fetchWith({ ac: [north, east, fresh] });
    const [n, e, f] = aircraft as [Aircraft, Aircraft, Aircraft];

    expectNear((n.latitude - 45.7) * KM_PER_DEGREE, 2.058, 0.05);
    expect(n.longitude).toBeCloseTo(4.8, 6);
    expectNear((e.longitude - 4.8) * KM_PER_DEGREE * Math.cos((45.7 * Math.PI) / 180), 2.058, 0.05);
    expect(e.latitude).toBeCloseTo(45.7, 4);
    expect(f.latitude).toBe(45.7);
    expect(f.longitude).toBe(4.8);
  });

  it("CA4 : leaves the position alone when the age is invalid or the motion is unknown, and never drops an old aircraft", async () => {
    const aircraft = await fetchWith({
      ac: [
        raw({ hex: "b00001", lat: 45.7, lon: 4.8, seen_pos: -5 }),
        raw({ hex: "b00002", lat: 45.7, lon: 4.8, seen_pos: "soon" }),
        raw({ hex: "b00003", lat: 45.7, lon: 4.8, seen_pos: 30, gs: undefined }),
        raw({ hex: "b00004", lat: 45.7, lon: 4.8, seen_pos: 30, track: undefined }),
        raw({ hex: "b00005", lat: 45.7, lon: 4.8, seen_pos: 600, track: 0 }),
      ],
    });
    expect(aircraft.map((plane) => plane.hex)).toEqual(["b00001", "b00002", "b00003", "b00004", "b00005"]);
    for (const plane of aircraft.slice(0, 4)) {
      expect(plane.latitude).toBe(45.7);
      expect(plane.longitude).toBe(4.8);
    }
    expect((aircraft[4] as Aircraft).latitude).toBeGreaterThan(45.7);
  });

  it("CA4 : wraps the longitude at the antimeridian and drops an aircraft pushed out of range at the pole", async () => {
    const aircraft = await fetchWith({
      ac: [
        raw({ hex: "a10001", lat: 10, lon: 179.99, track: 90, gs: 400, seen_pos: 10 }),
        raw({ hex: "a10002", lat: 89.99, lon: 0, track: 0, gs: 400, seen_pos: 30 }),
        raw({ hex: "a10003", lat: 90, lon: 0, track: 90, gs: 400, seen_pos: 10 }),
      ],
    });
    expect(aircraft.map((plane) => plane.hex)).toEqual(["a10001"]);
    const [crossing] = aircraft as [Aircraft];
    expect(crossing.longitude).toBeGreaterThanOrEqual(-180);
    expect(crossing.longitude).toBeLessThan(-179.9);
  });

  it("CA5 : turns an invalid field into null without dropping the aircraft", async () => {
    const aircraft = await fetchWith({
      ac: [
        raw({ hex: "c00001", flight: 1506, alt_baro: "high", gs: -3, track: 400 }),
        raw({ hex: "c00002", flight: undefined, alt_baro: Number.NaN, gs: "fast", track: -1 }),
        raw({ hex: "c00003", alt_baro: undefined, gs: undefined, track: undefined, flight: undefined }),
        raw({
          hex: "c00004",
          flight: undefined,
          alt_baro: Number.POSITIVE_INFINITY,
          gs: Number.POSITIVE_INFINITY,
          track: Number.POSITIVE_INFINITY,
        }),
      ],
    });
    expect(aircraft).toHaveLength(4);
    for (const plane of aircraft) {
      expect(plane.callsign).toBeNull();
      expect(plane.altitudeM).toBeNull();
      expect(plane.groundSpeedKmh).toBeNull();
      expect(plane.trackDeg).toBeNull();
    }
  });

  it("CA5 : keeps a track of exactly 0 and 360", async () => {
    const aircraft = await fetchWith({ ac: [raw({ hex: "d00001", track: 0 }), raw({ hex: "d00002", track: 360 })] });
    expect(aircraft.map((plane) => plane.trackDeg)).toEqual([0, 360]);
  });

  it("CA5 : drops an aircraft without a valid hex or position", async () => {
    const aircraft = await fetchWith({
      ac: [
        raw({ hex: "~3895ff" }),
        raw({ hex: "12345" }),
        raw({ hex: "1234567" }),
        raw({ hex: "zzzzzz" }),
        raw({ hex: undefined }),
        raw({ hex: "e00001", lat: undefined }),
        raw({ hex: "e00002", lon: "4.8" }),
        raw({ hex: "e00003", lat: 91 }),
        raw({ hex: "e00004", lon: -180.5 }),
        raw({ hex: "e00005", lat: 90, lon: -180 }),
        raw({ hex: "E00006" }),
      ],
    });
    expect(aircraft.map((plane) => plane.hex)).toEqual(["e00005", "e00006"]);
  });

  it("CA6 : rejects with ADSB_UNAVAILABLE on an unreadable response, and accepts an empty list", async () => {
    const { createAdsbLolSource } = await adsbLol();
    const bodies: unknown[] = [null, "text", 42, [], {}, { ac: null }, { ac: "none" }, { ac: {} }, { msg: "No error" }];
    for (const body of bodies) {
      const { fetch } = stubFetch(async () => okResponse(body));
      const error = await rejectionOf(createAdsbLolSource({ fetch }).fetchAircraft(LYON));
      expect(error).toMatchObject({ code: "ADSB_UNAVAILABLE" });
      expect(String(error?.message)).not.toMatch(COORDINATES);
    }
    const notJson = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    const unreadable = await rejectionOf(createAdsbLolSource({ fetch: notJson.fetch }).fetchAircraft(LYON));
    expect(unreadable).toMatchObject({ code: "ADSB_UNAVAILABLE" });
    expect(String(unreadable?.message)).not.toMatch(COORDINATES);
    await expect(fetchWith({ ac: [], msg: "No error", total: 0 })).resolves.toEqual([]);
  });

  it("CA6 : keeps the valid aircraft of a response that also holds malformed entries", async () => {
    const aircraft = await fetchWith({ ac: [null, "x", 7, raw({ hex: "f00001" }), [], { hex: "f00002" }] });
    expect(aircraft.map((plane) => plane.hex)).toEqual(["f00001"]);
  });

  it("CA7 : rejects with ADSB_UNAVAILABLE, without any coordinate in the message, on a network error or a bad status", async () => {
    const { createAdsbLolSource } = await adsbLol();
    const failures: FetchLike[] = [
      async () => {
        throw new TypeError("Network request failed for /45.764/4.836/44");
      },
      async () => ({ ok: false, status: 429, json: async () => ({ ac: [raw()] }) }),
      async () => ({ ok: false, status: 503, json: async () => ({}) }),
    ];
    for (const fetch of failures) {
      const error = await createAdsbLolSource({ fetch })
        .fetchAircraft(LYON)
        .then(
          () => null,
          (caught: unknown) => caught,
        );
      expect(error).toMatchObject({ code: "ADSB_UNAVAILABLE" });
      expect(String((error as Error).message)).not.toMatch(COORDINATES);
    }
  });

  describe("timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("CA7 : aborts a request that has not answered after ADSB_REQUEST_TIMEOUT_MS and rejects with ADSB_UNAVAILABLE", async () => {
      const { createAdsbLolSource, ADSB_REQUEST_TIMEOUT_MS } = await adsbLol();
      expect(ADSB_REQUEST_TIMEOUT_MS).toBe(8000);
      const { fetch, calls } = stubFetch(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      );
      const settled = rejectionOf(createAdsbLolSource({ fetch }).fetchAircraft(LYON));
      await vi.advanceTimersByTimeAsync(ADSB_REQUEST_TIMEOUT_MS - 1);
      expect(calls[0]?.init.signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls[0]?.init.signal.aborted).toBe(true);
      const error = await settled;
      expect(error).toMatchObject({ code: "ADSB_UNAVAILABLE" });
      expect(String(error?.message)).not.toMatch(COORDINATES);
    });
  });

  describe("timeout without abort support", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("CA7 : rejects at the deadline even when fetch ignores the abort signal", async () => {
      const { createAdsbLolSource, ADSB_REQUEST_TIMEOUT_MS } = await adsbLol();
      const { fetch } = stubFetch(() => new Promise<FetchResponse>(() => undefined));
      const settled = rejectionOf(createAdsbLolSource({ fetch }).fetchAircraft(LYON));
      await vi.advanceTimersByTimeAsync(ADSB_REQUEST_TIMEOUT_MS);
      const error = await settled;
      expect(error).toMatchObject({ code: "ADSB_UNAVAILABLE" });
    });
  });

  it("CA7 : rejects an invalid query without calling fetch", async () => {
    const { createAdsbLolSource, buildAdsbLolUrl } = await adsbLol();
    const invalid: AdsbQuery[] = [
      { ...LYON, latitude: 91 },
      { ...LYON, latitude: -90.1 },
      { ...LYON, longitude: 180.1 },
      { ...LYON, longitude: Number.NaN },
      { ...LYON, latitude: Number.POSITIVE_INFINITY },
      { ...LYON, radiusKm: 0 },
      { ...LYON, radiusKm: -5 },
      { ...LYON, radiusKm: Number.NaN },
      { ...LYON, radiusKm: Number.POSITIVE_INFINITY },
      { ...LYON, longitude: -180.1 },
    ];
    for (const query of invalid) {
      const { fetch, calls } = stubFetch(async () => okResponse({ ac: [] }));
      const error = await rejectionOf(createAdsbLolSource({ fetch }).fetchAircraft(query));
      expect(error).toMatchObject({ code: "ADSB_UNAVAILABLE" });
      expect(String(error?.message)).not.toMatch(COORDINATES);
      expect(calls).toHaveLength(0);
      expect(() => buildAdsbLolUrl(query)).toThrow(expect.objectContaining({ code: "ADSB_UNAVAILABLE" }));
    }
  });

  it("CA8 : picks the demo source only in development with the variable set to exactly demo", async () => {
    const { chooseAdsbSource } = await select();
    expect(chooseAdsbSource({ isDev: true, requested: "demo" })).toBe("demo");
    expect(chooseAdsbSource({ isDev: false, requested: "demo" })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: undefined })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: "real" })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: "DEMO" })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: " demo" })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: "" })).toBe("real");
  });
});
