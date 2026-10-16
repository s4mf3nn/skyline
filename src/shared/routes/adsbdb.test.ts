import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../adsb/adsblol";
import { buildAircraftUrl, buildCallsignUrl, createAdsbdbRouteSource } from "./adsbdb";
import { ROUTE_REQUEST_TIMEOUT_MS } from "./index";

const respond =
  (body: unknown, status = 200): FetchLike =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const airport = {
  iata_code: "CDG",
  municipality: " Paris ",
  latitude: 49.0128,
  longitude: 2.55,
  country_name: "France",
};
const routeBody = {
  response: {
    flightroute: {
      callsign: "AFR1015",
      airline: { name: "Air France" },
      origin: airport,
      destination: { iata_code: "LYS", municipality: "Lyon", latitude: 45.7256, longitude: 5.0811 },
    },
  },
};

const aircraftBody = (type: unknown) => ({ response: { aircraft: { type, registration: "F-GRHZ" } } });

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (caught) {
    return (caught as Error).message;
  }
  throw new Error("expected a rejection");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildCallsignUrl", () => {
  it("normalizes the callsign into a fixed host and path", () => {
    expect(buildCallsignUrl(" afr1015 ")).toBe("https://api.adsbdb.com/v0/callsign/AFR1015");
  });

  it("refuses callsigns that could alter the path", () => {
    for (const bad of ["", "A", "AFR101512", "AF R1", "AFR1015/..", "AFR1015?x=1", "AFR%2F1", "ÀFR1", "AFR\n15"]) {
      expect(buildCallsignUrl(bad)).toBeNull();
    }
  });
});

describe("buildAircraftUrl", () => {
  it("lowercases a six-digit hex", () => {
    expect(buildAircraftUrl("3944ED")).toBe("https://api.adsbdb.com/v0/aircraft/3944ed");
  });

  it("refuses anything else", () => {
    for (const bad of ["39 44ED", "~3944ed", "3944ed/x", "3944e", "3944edd"]) {
      expect(buildAircraftUrl(bad)).toBeNull();
    }
  });
});

describe("adsbdb.com client: fetchRoute", () => {
  it("calls fetch once with a bare GET and a signal", async () => {
    const fetch = vi.fn(respond(routeBody));
    await createAdsbdbRouteSource({ fetch }).fetchRoute("afr1015");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.adsbdb.com/v0/callsign/AFR1015");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init).not.toHaveProperty("body");
  });

  it("does not call fetch for a refused callsign", async () => {
    const fetch = vi.fn(respond(routeBody));
    expect(await createAdsbdbRouteSource({ fetch }).fetchRoute("AF R1")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("converts a complete route and ignores extra fields", async () => {
    const route = await createAdsbdbRouteSource({ fetch: respond(routeBody) }).fetchRoute("AFR1015");
    expect(route).toEqual({
      origin: { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55 },
      destination: { iata: "LYS", city: "Lyon", latitude: 45.7256, longitude: 5.0811 },
    });
  });

  it("turns invalid or missing fields into null without rejecting the route", async () => {
    const body = {
      response: {
        flightroute: {
          origin: { iata_code: "cdg1", municipality: "  ", latitude: 95, longitude: "2" },
          destination: "LYS",
        },
      },
    };
    const none = { iata: null, city: null, latitude: null, longitude: null };
    expect(await createAdsbdbRouteSource({ fetch: respond(body) }).fetchRoute("AFR1015")).toEqual({
      origin: none,
      destination: none,
    });
  });

  it("returns null for an unknown callsign, with status 404 or 200", async () => {
    const unknown = { response: "unknown callsign" };
    expect(await createAdsbdbRouteSource({ fetch: respond(unknown, 404) }).fetchRoute("AFR1015")).toBeNull();
    expect(await createAdsbdbRouteSource({ fetch: respond(unknown) }).fetchRoute("AFR1015")).toBeNull();
  });

  it("rejects a 404 that does not carry the unknown phrase", async () => {
    for (const body of [{ response: "nope" }, { response: {} }, routeBody, aircraftBody("A319"), "not json", null]) {
      const source = createAdsbdbRouteSource({ fetch: respond(body, 404) });
      expect(await messageOf(source.fetchRoute("AFR1015"))).toBe("Route source unavailable");
      expect(await messageOf(source.fetchAircraftType("3944ed"))).toBe("Route source unavailable");
    }
  });

  it("rejects with ROUTE_UNAVAILABLE on every other response", async () => {
    const fetches: FetchLike[] = [
      async () => {
        throw new Error("network down https://secret");
      },
      respond(routeBody, 400),
      respond(routeBody, 429),
      respond(routeBody, 500),
      async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      }),
      respond("text"),
      respond(null),
      respond([]),
      respond({ response: "unknown aircraft" }),
      respond({ response: 3 }),
      respond({ response: {} }),
      respond({ response: { flightroute: null } }),
      respond({ response: { flightroute: "x" } }),
    ];
    for (const fetch of fetches) {
      const message = await messageOf(createAdsbdbRouteSource({ fetch }).fetchRoute("AFR1015"));
      expect(message).toBe("Route source unavailable");
    }
  });

  it("rejects after the timeout even when fetch ignores the signal, and aborts it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetch: FetchLike = (_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    };
    const pending = messageOf(createAdsbdbRouteSource({ fetch }).fetchRoute("AFR1015"));
    await vi.advanceTimersByTimeAsync(ROUTE_REQUEST_TIMEOUT_MS);
    expect(await pending).toBe("Route source unavailable");
    expect(signal?.aborted).toBe(true);
  });

  it("clears the timer once the response arrived", async () => {
    vi.useFakeTimers();
    await createAdsbdbRouteSource({ fetch: respond(routeBody) }).fetchRoute("AFR1015");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("adsbdb.com client: fetchAircraftType", () => {
  it("calls fetch once on the aircraft URL and returns the trimmed type", async () => {
    const fetch = vi.fn(respond(aircraftBody(" A319 111 ")));
    expect(await createAdsbdbRouteSource({ fetch }).fetchAircraftType("3944ED")).toBe("A319 111");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.adsbdb.com/v0/aircraft/3944ed");
    expect(init?.headers).toEqual({ Accept: "application/json" });
  });

  it("returns null for a missing, empty, too long or non-string type", async () => {
    for (const type of [undefined, "  ", "x".repeat(41), 7]) {
      expect(
        await createAdsbdbRouteSource({ fetch: respond(aircraftBody(type)) }).fetchAircraftType("3944ed"),
      ).toBeNull();
    }
  });

  it("returns null for an unknown aircraft and for a refused hex without calling fetch", async () => {
    const unknown = { response: "unknown aircraft" };
    expect(await createAdsbdbRouteSource({ fetch: respond(unknown, 404) }).fetchAircraftType("3944ed")).toBeNull();
    expect(await createAdsbdbRouteSource({ fetch: respond(unknown) }).fetchAircraftType("3944ed")).toBeNull();
    const fetch = vi.fn(respond(aircraftBody("A319")));
    expect(await createAdsbdbRouteSource({ fetch }).fetchAircraftType("39 44ED")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects with ROUTE_UNAVAILABLE on failures", async () => {
    const bodies = [{ response: "unknown callsign" }, { response: {} }, { response: { aircraft: null } }, null];
    for (const body of bodies) {
      const message = await messageOf(createAdsbdbRouteSource({ fetch: respond(body) }).fetchAircraftType("3944ed"));
      expect(message).toBe("Route source unavailable");
    }
    expect(await messageOf(createAdsbdbRouteSource({ fetch: respond({}, 500) }).fetchAircraftType("3944ed"))).toBe(
      "Route source unavailable",
    );
  });
});
