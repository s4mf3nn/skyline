import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeClock } from "../clock";
import { groundDistanceKm } from "../scene/geo";
import { createDemoAdsbSource } from "./demo";

const QUERY = { latitude: 45.764, longitude: 4.836, radiusKm: 10 };
const START_MS = 1_700_000_000_000;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDemoAdsbSource", () => {
  it("gives lowercase hexadecimal hex values", async () => {
    const source = createDemoAdsbSource(createFakeClock(START_MS));
    const aircraft = await source.fetchAircraft(QUERY);
    expect(aircraft.length).toBeGreaterThan(0);
    for (const plane of aircraft) {
      expect(plane.hex).toMatch(/^[0-9a-f]{6}$/);
    }
  });

  it("keeps every aircraft inside a 10 km radius", async () => {
    const clock = createFakeClock(START_MS);
    const source = createDemoAdsbSource(clock);
    for (let step = 0; step < 100; step += 1) {
      for (const plane of await source.fetchAircraft(QUERY)) {
        expect(groundDistanceKm(QUERY, plane)).toBeLessThanOrEqual(QUERY.radiusKm);
      }
      clock.advance(7_000);
    }
  });

  it("answers the same list for two sources created at the same time", async () => {
    const first = createDemoAdsbSource(createFakeClock(START_MS));
    const second = createDemoAdsbSource(createFakeClock(START_MS));
    expect(await second.fetchAircraft(QUERY)).toEqual(await first.fetchAircraft(QUERY));
  });

  it("moves when the clock advances", async () => {
    const clock = createFakeClock(START_MS);
    const source = createDemoAdsbSource(clock);
    const before = await source.fetchAircraft(QUERY);
    clock.advance(30_000);
    expect(await source.fetchAircraft(QUERY)).not.toEqual(before);
  });

  it("makes no network call and writes no log", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    await createDemoAdsbSource(createFakeClock(START_MS)).fetchAircraft(QUERY);
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
    vi.unstubAllGlobals();
  });
});
