import { describe, expect, it } from "vitest";
import { UNKNOWN_AIRLINE } from "../../shared/airlines";
import type { Passage, Scene, SceneState } from "../../shared/scene";
import {
  buildShownSky,
  buildSkyView,
  CIEL_METRICS,
  flightKeyOf,
  nextSkyState,
  SKY_ABSENT,
  type SkyState,
  sceneTimeOf,
  skyInputOf,
} from "./service";

function passage(hex: string, overrides: Partial<Passage> = {}): Passage {
  return {
    hex,
    callsign: "AFR1234",
    altitudeM: 10_668,
    groundSpeedKmh: 842.4,
    trackDeg: 90,
    trackCardinal: "E",
    passageTimeMs: 0,
    closestTimeMs: 0,
    windowEndMs: 0,
    closestDistanceKm: 1,
    latitude: 48.9,
    longitude: 2.4,
    groundDistanceKm: 10,
    arrivalBearingDeg: 270,
    arrivalCardinal: "O",
    ...overrides,
  };
}

const A = passage("aaaaaa");
const B = passage("bbbbbb");
const scene = (overhead: Passage | null, upcoming: Passage[] = []): Scene => ({ overhead, upcoming });
const held: SkyState = { presence: "retenu", passage: A };
const shown: SkyState = { presence: "survol", passage: A };

describe("CIEL_METRICS", () => {
  it("holds the handoff values", () => {
    expect(CIEL_METRICS.infoColumnTopPt).toBe(448);
    expect(CIEL_METRICS.tailLeftPt).toBe(-60);
  });
});

describe("buildSkyView", () => {
  it("shows the aircraft type when known and a dash otherwise", () => {
    const value = (type: string | null) => buildSkyView(A, type).rows.find((row) => row.key === "aircraft")?.value;
    expect(value("A319 111")).toBe("A319 111");
    expect(value(null)).toBe("—");
  });

  it("builds the six rows in order without units", () => {
    const view = buildSkyView(A);
    expect(view.hex).toBe("aaaaaa");
    expect(view.rows.map((row) => row.key)).toEqual(["speed", "altitude", "heading", "airline", "flight", "aircraft"]);
    expect(view.rows.map((row) => row.value)).toEqual(["842", "10\u00a0668", "E", view.airline.name, "AF1234", "—"]);
  });

  it("falls back to the unknown airline without callsign", () => {
    const view = buildSkyView(passage("cccccc", { callsign: null, altitudeM: null }));
    expect(view.airline).toBe(UNKNOWN_AIRLINE);
    expect(view.rows[1]?.value).toBe("—");
    expect(view.rows[4]?.value).toBe("—");
  });
});

describe("nextSkyState rules", () => {
  it("rule 1: denied clears everything", () => {
    const next = nextSkyState({ previous: shown, scene: scene(B), denied: true, displayedPage: "ciel" });
    expect(next).toEqual(SKY_ABSENT);
  });

  it("rule 2: overhead wins whatever the previous state and page", () => {
    const next = nextSkyState({ previous: held, scene: scene(B), denied: false, displayedPage: "passages" });
    expect(next).toEqual({ presence: "survol", passage: B });
  });

  it("rule 3: nothing held when nothing was shown", () => {
    const next = nextSkyState({ previous: SKY_ABSENT, scene: scene(null), denied: false, displayedPage: "ciel" });
    expect(next).toEqual(SKY_ABSENT);
  });

  it("rule 4: absent on the passages page", () => {
    const next = nextSkyState({ previous: held, scene: scene(null), denied: false, displayedPage: "passages" });
    expect(next).toEqual(SKY_ABSENT);
  });

  it("rule 5: absent when the plane is upcoming again", () => {
    const next = nextSkyState({ previous: held, scene: scene(null, [B, A]), denied: false, displayedPage: "ciel" });
    expect(next).toEqual(SKY_ABSENT);
  });

  it("rule 6: held on the same object", () => {
    const next = nextSkyState({ previous: shown, scene: scene(null, [B]), denied: false, displayedPage: "ciel" });
    expect(next.presence).toBe("retenu");
    expect(next.passage).toBe(A);
  });

  it("keeps a held plane with a null scene on the sky page", () => {
    const next = nextSkyState({ previous: held, scene: null, denied: false, displayedPage: "ciel" });
    expect(next).toEqual(held);
  });

  it("does not modify frozen inputs", () => {
    const previous = Object.freeze({ ...shown });
    const frozen = Object.freeze({ overhead: null, upcoming: Object.freeze([B]) as Passage[] });
    expect(() => nextSkyState({ previous, scene: frozen, denied: false, displayedPage: "ciel" })).not.toThrow();
    expect(previous).toEqual(shown);
  });
});

describe("skyInputOf", () => {
  const ready = scene(A);
  it("maps each scene status", () => {
    expect(skyInputOf({ status: "ready", scene: ready, snapshotAtMs: 0, nowMs: 0 })).toEqual({
      scene: ready,
      denied: false,
    });
    expect(skyInputOf({ status: "denied" })).toEqual({ scene: null, denied: true });
    expect(skyInputOf({ status: "unavailable" })).toEqual({ scene: null, denied: false });
    expect(skyInputOf({ status: "loading" })).toEqual({ scene: null, denied: false });
  });
});

describe("sceneTimeOf", () => {
  it("returns the scene time once ready and 0 before", () => {
    expect(sceneTimeOf({ status: "ready", scene: scene(null), snapshotAtMs: 1, nowMs: 5000 })).toBe(5000);
    expect(sceneTimeOf({ status: "denied" } as SceneState)).toBe(0);
  });
});

describe("buildShownSky", () => {
  it("returns null until a plane and its scene time are known", () => {
    expect(buildShownSky(null, null, null)).toBeNull();
    expect(buildShownSky(A, null, null)).toBeNull();
  });

  it("carries the plane, its scene time and the type into the view", () => {
    const sky = buildShownSky(A, 7000, "A319");
    expect(sky).toMatchObject({ passage: A, shownAtMs: 7000 });
    expect(sky?.view.rows.find((row) => row.key === "aircraft")?.value).toBe("A319");
  });
});

describe("flightKeyOf", () => {
  it("gives the hex and callsign of the shown plane, and nulls without one", () => {
    expect(flightKeyOf(A)).toEqual({ hex: A.hex, callsign: A.callsign });
    expect(flightKeyOf(null)).toEqual({ hex: null, callsign: null });
  });
});
