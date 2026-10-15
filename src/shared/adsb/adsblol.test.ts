import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./adsblol";
import { ADSB_REQUEST_TIMEOUT_MS, buildAdsbLolUrl, createAdsbLolSource } from "./adsblol";

const LYON = { latitude: 45.764, longitude: 4.836, radiusKm: 80 };

const okFetch =
  (body: unknown): FetchLike =>
  async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

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

describe("buildAdsbLolUrl", () => {
  it("rounds to 3 decimals without trailing zeros or negative zero", () => {
    expect(buildAdsbLolUrl({ latitude: 45.5, longitude: -0.0004, radiusKm: 80 })).toBe(
      "https://api.adsb.lol/v2/point/45.5/0/44",
    );
    expect(buildAdsbLolUrl({ latitude: 45.7644, longitude: 4.8357, radiusKm: 80 })).toBe(
      "https://api.adsb.lol/v2/point/45.764/4.836/44",
    );
  });

  it("converts the radius to nautical miles, rounded up and capped at 250", () => {
    expect(buildAdsbLolUrl({ ...LYON, radiusKm: 10 })).toMatch(/\/6$/);
    expect(buildAdsbLolUrl({ ...LYON, radiusKm: 80 })).toMatch(/\/44$/);
    expect(buildAdsbLolUrl({ ...LYON, radiusKm: 1000 })).toMatch(/\/250$/);
  });

  it("rejects an invalid query without coordinates in the message", () => {
    const invalid = [
      { ...LYON, latitude: Number.NaN },
      { ...LYON, latitude: 91 },
      { ...LYON, longitude: 181 },
      { ...LYON, radiusKm: 0 },
      { ...LYON, radiusKm: Number.POSITIVE_INFINITY },
    ];
    for (const query of invalid) {
      expect(() => buildAdsbLolUrl(query)).toThrow("ADS-B source unavailable");
    }
  });
});

describe("createAdsbLolSource", () => {
  it("returns the converted aircraft of a valid response", async () => {
    const source = createAdsbLolSource({
      fetch: okFetch({ ac: [{ hex: "7380C7", lat: 45.6, lon: 4.1, flight: "ELY018 " }] }),
    });
    const aircraft = await source.fetchAircraft(LYON);
    expect(aircraft.map((plane) => plane.hex)).toEqual(["7380c7"]);
    expect(aircraft[0]?.callsign).toBe("ELY018");
  });

  it("rejects without coordinates on a network error", async () => {
    const source = createAdsbLolSource({
      fetch: async () => {
        throw new Error("network down 45.764");
      },
    });
    const message = await messageOf(source.fetchAircraft(LYON));
    expect(message).toBe("ADS-B source unavailable");
  });

  it("rejects on a non-2xx status", async () => {
    const source = createAdsbLolSource({
      fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    });
    expect(await messageOf(source.fetchAircraft(LYON))).toBe("ADS-B source unavailable");
  });

  it("rejects on an unreadable body", async () => {
    const unreadable = createAdsbLolSource({
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("bad json 4.836");
        },
      }),
    });
    expect(await messageOf(unreadable.fetchAircraft(LYON))).toBe("ADS-B source unavailable");
    const wrongShape = createAdsbLolSource({ fetch: okFetch({ ac: "nope" }) });
    expect(await messageOf(wrongShape.fetchAircraft(LYON))).toBe("ADS-B source unavailable");
  });

  it("does not call fetch for an invalid query", async () => {
    const fetch = vi.fn<FetchLike>();
    const source = createAdsbLolSource({ fetch });
    const message = await messageOf(source.fetchAircraft({ ...LYON, latitude: 200 }));
    expect(message).toBe("ADS-B source unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects after the timeout and aborts the signal, even if fetch ignores it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const source = createAdsbLolSource({
      fetch: (_url, init) => {
        signal = init.signal;
        return new Promise(() => {});
      },
    });
    const pending = messageOf(source.fetchAircraft(LYON));
    await vi.advanceTimersByTimeAsync(ADSB_REQUEST_TIMEOUT_MS);
    expect(await pending).toBe("ADS-B source unavailable");
    expect(signal?.aborted).toBe(true);
  });

  it("clears the timer once the response is received", async () => {
    vi.useFakeTimers();
    const source = createAdsbLolSource({ fetch: okFetch({ ac: [] }) });
    await source.fetchAircraft(LYON);
    expect(vi.getTimerCount()).toBe(0);
  });
});
