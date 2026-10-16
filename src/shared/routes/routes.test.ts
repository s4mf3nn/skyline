import { describe, expect, it } from "vitest";
import { createFakeClock } from "../clock";
import {
  createFakeRouteSource,
  createFlightLookup,
  type FlightRoute,
  normalizeCallsign,
  normalizeHex,
  ROUTE_RETRY_AFTER_MS,
} from "./index";

const PARIS_NICE: FlightRoute = {
  origin: { iata: "CDG", city: "Paris", latitude: 49.0097, longitude: 2.5479 },
  destination: { iata: "NCE", city: "Nice", latitude: 43.6584, longitude: 7.2159 },
};

function setup(data?: Parameters<typeof createFakeRouteSource>[0]) {
  const source = createFakeRouteSource(data);
  const clock = createFakeClock(1_000_000);
  return { source, clock, lookup: createFlightLookup({ source, clock }) };
}

describe("normalizeCallsign", () => {
  it("trims and uppercases a valid callsign", () => {
    expect(normalizeCallsign(" afr1015 ")).toBe("AFR1015");
  });

  it.each([null, "", "A", "ABCDEFGHI", "AF R1", "AFR1015/..", "AFR1015?x=1", "AFR%2F1", "ÀFR1", "AFR\u00001"])(
    "rejects %j",
    (value) => {
      expect(normalizeCallsign(value)).toBeNull();
    },
  );
});

describe("normalizeHex", () => {
  it("trims and lowercases a valid hex", () => {
    expect(normalizeHex(" 3944EF ")).toBe("3944ef");
  });

  it.each(["", "3944e", "3944efa", "3944eg", "39 44e", "../etc"])("rejects %j", (value) => {
    expect(normalizeHex(value)).toBeNull();
  });
});

describe("createFlightLookup route", () => {
  it("keeps a definitive answer for the session, before or after normalization", async () => {
    const { source, lookup } = setup({ routes: { AFR1015: PARIS_NICE } });
    expect(await lookup.route("afr1015")).toEqual({ status: "found", value: PARIS_NICE });
    expect(await lookup.route("AFR1015 ")).toEqual({ status: "found", value: PARIS_NICE });
    expect(source.routeRequests).toEqual(["AFR1015"]);
  });

  it("keeps an unknown answer", async () => {
    const { source, lookup } = setup();
    expect(await lookup.route("TVF123")).toEqual({ status: "unknown" });
    await lookup.route("TVF123");
    expect(source.routeRequests).toEqual(["TVF123"]);
  });

  it("shares one request between simultaneous calls", async () => {
    const { source, lookup } = setup({ routes: { AFR1015: PARIS_NICE } });
    source.holdResponses();
    const first = lookup.route("AFR1015");
    const second = lookup.route("afr1015");
    source.releaseResponses();
    expect(await first).toEqual(await second);
    expect(source.routeRequests).toEqual(["AFR1015"]);
  });

  it("answers unknown without calling the source for a refused callsign", async () => {
    const { source, lookup } = setup();
    expect(await lookup.route(null)).toEqual({ status: "unknown" });
    expect(await lookup.route("AF R1")).toEqual({ status: "unknown" });
    expect(source.routeRequests).toEqual([]);
  });

  it("blocks the source for 10 000 ms after a failure, not 9 999", async () => {
    const { source, clock, lookup } = setup({ routes: { AFR1015: PARIS_NICE } });
    source.setUnavailable(true);
    expect(await lookup.route("AFR1015")).toEqual({ status: "unavailable" });
    source.setUnavailable(false);

    clock.advance(ROUTE_RETRY_AFTER_MS - 1);
    expect(await lookup.route("AFR1015")).toEqual({ status: "unavailable" });
    expect(source.routeRequests).toHaveLength(1);

    clock.advance(1);
    expect(await lookup.route("AFR1015")).toEqual({ status: "found", value: PARIS_NICE });
    expect(source.routeRequests).toHaveLength(2);

    // Une réponse obtenue est gardée.
    await lookup.route("AFR1015");
    expect(source.routeRequests).toHaveLength(2);
  });

  it("holds the retry delay per callsign", async () => {
    const { source, lookup } = setup({ routes: { AFR1015: PARIS_NICE } });
    source.setUnavailable(true);
    await lookup.route("BAW123");
    source.setUnavailable(false);
    expect(await lookup.route("AFR1015")).toEqual({ status: "found", value: PARIS_NICE });
  });
});

describe("createFlightLookup aircraftType", () => {
  it("keys on the lowercase hex and keeps the answer", async () => {
    const { source, lookup } = setup({ aircraftTypes: { "3944ef": "A319 111" } });
    expect(await lookup.aircraftType("3944EF")).toEqual({ status: "found", value: "A319 111" });
    await lookup.aircraftType("3944ef");
    expect(source.typeRequests).toEqual(["3944ef"]);
  });

  it("answers unknown without calling the source for a refused hex", async () => {
    const { source, lookup } = setup();
    expect(await lookup.aircraftType("zzz")).toEqual({ status: "unknown" });
    expect(source.typeRequests).toEqual([]);
  });

  it("applies the retry delay per hex", async () => {
    const { source, clock, lookup } = setup({ aircraftTypes: { "3944ef": "A319 111" } });
    source.setUnavailable(true);
    expect(await lookup.aircraftType("3944ef")).toEqual({ status: "unavailable" });
    source.setUnavailable(false);
    expect(await lookup.aircraftType("abcdef")).toEqual({ status: "unknown" });
    expect(await lookup.aircraftType("3944ef")).toEqual({ status: "unavailable" });
    clock.advance(ROUTE_RETRY_AFTER_MS);
    expect(await lookup.aircraftType("3944ef")).toEqual({ status: "found", value: "A319 111" });
  });
});
