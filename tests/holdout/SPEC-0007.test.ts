import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AdsbQuery, AdsbSource, Aircraft } from "../../src/shared/adsb";

// Scénarios cachés de SPEC-0007 (Vitest) : parcours de bout en bout du client, avec d'autres données que le contrat.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
type FetchLike = (
  url: string,
  init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal },
) => Promise<FetchResponse>;
interface AdsbLolModule {
  createAdsbLolSource(options: { fetch: FetchLike }): AdsbSource;
}
interface SceneModule {
  computeScene(input: {
    snapshot: { aircraft: readonly Aircraft[]; takenAtMs: number };
    observer: { latitude: number; longitude: number };
    nowMs: number;
    previousOverheadHex: string | null;
  }): { overhead: { hex: string } | null; upcoming: Array<{ hex: string; passageTimeMs: number }> };
}

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const NOW = 1_800_000_000_000;

describe("SPEC-0007 hidden scenarios", () => {
  it("builds a southern-hemisphere request and keeps the valid aircraft of a messy answer", async () => {
    const { createAdsbLolSource } = await load<AdsbLolModule>("src/shared/adsb/adsblol.ts");
    const urls: string[] = [];
    const fetch: FetchLike = async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ac: [
            {
              hex: "C0FFEE",
              flight: "QFA 12 ",
              alt_baro: 35000,
              gs: 450,
              track: 0,
              lat: -33.9,
              lon: 151.1,
              seen_pos: 2,
            },
            { hex: "~abcdef", flight: "TIS1", alt_baro: 3000, lat: -33.8, lon: 151.2 },
            { hex: "0a1b2c", flight: "VOZ9", alt_baro: "ground", gs: 5, lat: -33.95, lon: 151.18 },
            { hex: "0a1b2d", alt_baro: 500, gs: null, track: "n/a", lat: -33.85, lon: 151.25 },
            { hex: "0a1b2e", lat: null, lon: 151 },
            12,
          ],
          now: NOW,
          total: 6,
        }),
      };
    };
    const aircraft = await createAdsbLolSource({ fetch }).fetchAircraft({
      latitude: -33.86882,
      longitude: 151.20929,
      radiusKm: 55,
    } satisfies AdsbQuery);

    expect(urls).toEqual(["https://api.adsb.lol/v2/point/-33.869/151.209/30"]);
    expect(aircraft.map((plane) => plane.hex)).toEqual(["c0ffee", "0a1b2d"]);
    const [first, second] = aircraft as [Aircraft, Aircraft];
    expect(first.callsign).toBe("QFA 12");
    expect(first.altitudeM).toBeCloseTo(10668, 0);
    expect(first.groundSpeedKmh).toBeCloseTo(833.4, 1);
    // 450 nœuds pendant 2 s : environ 0,463 km vers le nord.
    expect((first.latitude + 33.9) * KM_PER_DEGREE).toBeGreaterThan(0.4);
    expect((first.latitude + 33.9) * KM_PER_DEGREE).toBeLessThan(0.53);
    expect(second.groundSpeedKmh).toBeNull();
    expect(second.trackDeg).toBeNull();
    expect(second.altitudeM).toBeCloseTo(152.4, 1);
  });

  it("feeds the scene computation: a recalibrated aircraft is forecast from where it really is", async () => {
    const { createAdsbLolSource } = await load<AdsbLolModule>("src/shared/adsb/adsblol.ts");
    const { computeScene } = await load<SceneModule>("src/shared/scene/index.ts");
    const observer = { latitude: 45.76449, longitude: 4.83571 };
    // Position annoncée 60 s plus tôt, 30 km à l'ouest, cap est à 720 km/h (388,8 nœuds) : réellement à 18 km.
    const fetch: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ac: [
          {
            hex: "3944ef",
            flight: "AFR1506 ",
            alt_baro: 36000,
            gs: 388.8,
            track: 90,
            lat: observer.latitude,
            lon: observer.longitude - 30 / (KM_PER_DEGREE * Math.cos((observer.latitude * Math.PI) / 180)),
            seen_pos: 60,
          },
        ],
      }),
    });
    const aircraft = await createAdsbLolSource({ fetch }).fetchAircraft({ ...observer, radiusKm: 80 });
    const scene = computeScene({
      snapshot: { aircraft, takenAtMs: NOW },
      observer,
      nowMs: NOW,
      previousOverheadHex: null,
    });
    expect(scene.overhead).toBeNull();
    const [passage] = scene.upcoming;
    // Entrée dans la fenêtre à 5 km de l'observateur, soit 13 km à 0,2 km/s : environ 65 s.
    expect(passage?.hex).toBe("3944ef");
    expect(Math.abs((passage?.passageTimeMs ?? 0) - (NOW + 65_000))).toBeLessThanOrEqual(2000);
  });

  it("recovers a source that fails with a bad status then a network error, one error code throughout", async () => {
    const { createAdsbLolSource } = await load<AdsbLolModule>("src/shared/adsb/adsblol.ts");
    let call = 0;
    const fetch: FetchLike = async () => {
      call += 1;
      if (call === 1) return { ok: false, status: 502, json: async () => ({ ac: [] }) };
      if (call === 2) throw new TypeError("offline");
      return { ok: true, status: 200, json: async () => ({ ac: [] }) };
    };
    const source = createAdsbLolSource({ fetch });
    const query = { latitude: 48.8566, longitude: 2.3522, radiusKm: 80 };
    await expect(source.fetchAircraft(query)).rejects.toMatchObject({ code: "ADSB_UNAVAILABLE" });
    await expect(source.fetchAircraft(query)).rejects.toMatchObject({ code: "ADSB_UNAVAILABLE" });
    await expect(source.fetchAircraft(query)).resolves.toEqual([]);
    expect(call).toBe(3);
  });
});
