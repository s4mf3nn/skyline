import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Aircraft } from "../../src/shared/adsb";
import { AppError } from "../../src/shared/errors";
import { createFakeLocation, type LocationService, type Position } from "../../src/shared/location";

// Contrat de SPEC-0004 (Vitest) : calcul de la scène, acquisition de la position, service de premier plan.
// Le crochet useScene est joué par SPEC-0004.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec : chargés par chemin, avec les types du contrat d'interface recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
interface Passage {
  hex: string;
  callsign: string | null;
  altitudeM: number | null;
  groundSpeedKmh: number;
  trackDeg: number;
  trackCardinal: CardinalPoint;
  passageTimeMs: number;
  closestTimeMs: number;
  windowEndMs: number;
  closestDistanceKm: number;
  groundDistanceKm: number;
  arrivalBearingDeg: number;
  arrivalCardinal: CardinalPoint;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
interface SceneModule {
  groundDistanceKm(a: Position, b: Position): number;
  bearingDeg(from: Position, to: Position): number;
  cardinalPoint(deg: number): CardinalPoint;
  arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null;
  OVERHEAD_THRESHOLD_KM: number;
  FORECAST_RADIUS_KM: number;
  MAX_UPCOMING: number;
  WINDOW_HALF_LENGTH_KM: number;
  REFRESH_INTERVAL_MS: number;
  computeScene(input: {
    snapshot: { aircraft: readonly Aircraft[]; takenAtMs: number };
    observer: Position;
    nowMs: number;
    previousOverheadHex: string | null;
  }): Scene;
}
type ObserverFix = { status: "granted"; position: Position } | { status: "denied" };
interface LocationModule {
  acquireObserver(location: LocationService): Promise<ObserverFix>;
}
interface AppLifecycle {
  onForeground(listener: () => void): () => void;
}
interface LifecycleModule {
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void };
}
const scene = () => load<SceneModule>("src/shared/scene/index.ts");
const locationModule = () => load<LocationModule>("src/shared/location/index.ts");
const lifecycleModule = () => load<LifecycleModule>("src/shared/lifecycle/index.ts");

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km). 720 km/h = 0,2 km/s,
// donc la fenêtre de ±5 km dure 50 s autour du point le plus proche.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 48, longitude: 2 };
const T0 = 1_800_000_000_000;

function at(eastKm: number, northKm: number): Position {
  return {
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  };
}

function plane(
  hex: string,
  eastKm: number,
  northKm: number,
  trackDeg: number | null,
  groundSpeedKmh: number | null,
  altitudeM: number | null = 10_000,
): Aircraft {
  return { hex, callsign: hex.toUpperCase(), ...at(eastKm, northKm), altitudeM, groundSpeedKmh, trackDeg };
}

async function computeAt(aircraft: Aircraft[], nowMs = T0, previousOverheadHex: string | null = null, takenAtMs = T0) {
  const { computeScene } = await scene();
  return computeScene({ snapshot: { aircraft, takenAtMs }, observer: OBSERVER, nowMs, previousOverheadHex });
}

const hexes = (passages: Passage[]) => passages.map((passage) => passage.hex);

/** Vérifie une valeur à une tolérance absolue (la méthode de projection est libre, CA : tolérances). */
function expectNear(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}
const SECOND = 1000;

describe("SPEC-0004 scene computation", () => {
  it("CA1 : measures the ground distance in km, symmetric and zero for the same position", async () => {
    const { groundDistanceKm } = await scene();
    expectNear(groundDistanceKm(OBSERVER, at(30, 40)), 50, 0.1);
    expectNear(groundDistanceKm(at(30, 40), OBSERVER), 50, 0.1);
    expect(groundDistanceKm(OBSERVER, OBSERVER)).toBe(0);
  });

  it("CA1 : gives the bearing of the second position, 0 at north and clockwise", async () => {
    const { bearingDeg } = await scene();
    expectNear(bearingDeg(OBSERVER, at(0, 10)), 0, 1);
    expectNear(bearingDeg(OBSERVER, at(10, 0)), 90, 1);
    expectNear(bearingDeg(OBSERVER, at(0, -10)), 180, 1);
    expectNear(bearingDeg(OBSERVER, at(-10, 0)), 270, 1);
    expectNear(bearingDeg(OBSERVER, at(10, 10)), 45, 1);
    expectNear(bearingDeg(OBSERVER, at(-10, -10)), 225, 1);
  });

  it.each([
    [0, "N"],
    [22.4, "N"],
    [22.5, "NE"],
    [45, "NE"],
    [67.4, "NE"],
    [67.5, "E"],
    [90, "E"],
    [112.5, "SE"],
    [157.5, "S"],
    [180, "S"],
    [202.5, "SO"],
    [247.5, "O"],
    [270, "O"],
    [292.5, "NO"],
    [337.4, "NO"],
    [337.5, "N"],
    [360, "N"],
    [-10, "N"],
    [-90, "O"],
    [405, "NE"],
  ] as const)("CA2 : maps %s degrees to %s", async (deg, expected) => {
    const { cardinalPoint } = await scene();
    expect(cardinalPoint(deg)).toBe(expected);
  });

  it.each([
    [90, 0, 90],
    [90, 90, 0],
    [0, 90, 270],
    [10, 350, 20],
    [350, 10, 340],
    [0, 360, 0],
    [45, -90, 135],
    [0, 0, 0],
  ])("CA3 : points the arrow at %s degrees for a phone heading of %s, giving %s", async (target, heading, expected) => {
    const { arrowAngleDeg } = await scene();
    expect(arrowAngleDeg(target, heading)).toBe(expected);
  });

  it("CA3 : never gives 360 or -0, and gives null when the heading is unknown", async () => {
    const { arrowAngleDeg } = await scene();
    expect(Object.is(arrowAngleDeg(0, 0), 0)).toBe(true);
    expect(Object.is(arrowAngleDeg(360, 0), 0)).toBe(true);
    expect(arrowAngleDeg(359.9999, 0)).toBeLessThan(360);
    expect(arrowAngleDeg(45, null)).toBeNull();
  });

  it("CA4 : exports the constants of the brief", async () => {
    const constants = await scene();
    expect(constants.OVERHEAD_THRESHOLD_KM).toBe(4);
    expect(constants.FORECAST_RADIUS_KM).toBe(80);
    expect(constants.MAX_UPCOMING).toBe(10);
    expect(constants.WINDOW_HALF_LENGTH_KM).toBe(5);
    expect(constants.REFRESH_INTERVAL_MS).toBe(10_000);
  });

  it("CA4 : computes the passage of an aircraft flying straight over the observer", async () => {
    const result = await computeAt([plane("a1", -40, 0, 90, 720)]);
    expect(result.overhead).toBeNull();
    expect(result.upcoming).toHaveLength(1);
    const passage = result.upcoming[0] as Passage;
    expect(passage.hex).toBe("a1");
    expect(passage.callsign).toBe("A1");
    expect(passage.altitudeM).toBe(10_000);
    expect(passage.groundSpeedKmh).toBe(720);
    expect(passage.trackDeg).toBe(90);
    expect(passage.trackCardinal).toBe("E");
    expectNear(passage.closestDistanceKm, 0, 0.1);
    expectNear(passage.groundDistanceKm, 40, 0.1);
    expectNear(passage.closestTimeMs, T0 + 200 * SECOND, SECOND);
    expectNear(passage.passageTimeMs, T0 + 175 * SECOND, SECOND);
    expectNear(passage.windowEndMs, T0 + 225 * SECOND, SECOND);
    expectNear(passage.arrivalBearingDeg, 270, 1);
    expect(passage.arrivalCardinal).toBe("O");
  });

  it("CA4 : computes the passage of an aircraft that goes by on the side", async () => {
    const result = await computeAt([plane("b2", 30, -3, 270, 720)]);
    const passage = result.upcoming[0] as Passage;
    expectNear(passage.closestDistanceKm, 3, 0.1);
    expectNear(passage.groundDistanceKm, Math.hypot(30, 3), 0.1);
    expectNear(passage.closestTimeMs, T0 + 150 * SECOND, SECOND);
    expectNear(passage.passageTimeMs, T0 + 125 * SECOND, SECOND);
    expectNear(passage.windowEndMs, T0 + 175 * SECOND, SECOND);
    expectNear(passage.arrivalBearingDeg, 121, 1);
    expect(passage.arrivalCardinal).toBe("SE");
    expect(passage.trackCardinal).toBe("O");
  });

  it("CA4 : converts the 5 km window into a duration with the ground speed of the aircraft", async () => {
    const result = await computeAt([plane("c3", -20, 0, 90, 360)]);
    const passage = result.upcoming[0] as Passage;
    expectNear(passage.closestTimeMs, T0 + 200 * SECOND, SECOND);
    expectNear(passage.passageTimeMs, T0 + 150 * SECOND, SECOND);
    expectNear(passage.windowEndMs, T0 + 250 * SECOND, SECOND);
  });

  it("CA4 : gives the arrival bearing and the cardinal of an aircraft coming from the south", async () => {
    const result = await computeAt([plane("d4", 0, -30, 0, 720)]);
    const passage = result.upcoming[0] as Passage;
    expectNear(passage.arrivalBearingDeg, 180, 1);
    expect(passage.arrivalCardinal).toBe("S");
    expect(passage.trackCardinal).toBe("N");
    expectNear(passage.passageTimeMs, T0 + 125 * SECOND, SECOND);
  });

  it("CA4 : treats a track of 360 degrees as 0", async () => {
    const north = (await computeAt([plane("n0", 0, -30, 0, 720)])).upcoming[0] as Passage;
    const wrapped = (await computeAt([plane("n0", 0, -30, 360, 720)])).upcoming[0] as Passage;
    expect(wrapped.trackCardinal).toBe("N");
    expect(wrapped.passageTimeMs).toBe(north.passageTimeMs);
    expect(wrapped.arrivalCardinal).toBe("S");
  });

  it("CA4 : rounds the times to the millisecond", async () => {
    const result = await computeAt([plane("e5", -33.3, -1.7, 87, 683)]);
    expect(result.upcoming).toHaveLength(1);
    const passage = result.upcoming[0] as Passage;
    expect(Number.isInteger(passage.passageTimeMs)).toBe(true);
    expect(Number.isInteger(passage.closestTimeMs)).toBe(true);
    expect(Number.isInteger(passage.windowEndMs)).toBe(true);
  });

  it.each([
    ["no ground speed", plane("x1", -40, 0, 90, null)],
    ["a zero ground speed", plane("x2", -40, 0, 90, 0)],
    ["no track", plane("x3", -40, 0, null, 720)],
    ["an altitude of 0 m (on the ground)", plane("x4", -40, 0, 90, 720, 0)],
    ["a negative altitude", plane("x5", -40, 0, 90, 720, -30)],
    ["a closest point more than 4 km away", plane("x6", -30, 4.1, 90, 720)],
    ["a distance of more than 80 km", plane("x7", -81, 0, 90, 720)],
    ["a closest point behind it, out of its window", plane("x8", 10, 0, 90, 720)],
  ])("CA5 : forecasts no passage for an aircraft with %s", async (_label, aircraft) => {
    const result = await computeAt([aircraft]);
    expect(result.upcoming).toEqual([]);
    expect(result.overhead).toBeNull();
  });

  it("CA5 : never makes an aircraft without speed or track the overhead, even a few hundred meters away", async () => {
    const result = await computeAt([plane("hover", 0.3, 0.2, null, 0), plane("noTrack", 0.2, 0.1, null, 500)]);
    expect(result.overhead).toBeNull();
    expect(result.upcoming).toEqual([]);
  });

  it("CA5 : keeps an aircraft whose altitude is unknown, and the limits of 4 km and 80 km", async () => {
    const result = await computeAt([
      plane("unknown", -40, 0, 90, 720, null),
      plane("near", -30, 3.9, 90, 720),
      plane("edge", -79, 0, 90, 720),
    ]);
    expect(hexes(result.upcoming).sort()).toEqual(["edge", "near", "unknown"]);
  });

  it("CA5 : drops an aircraft once its window is over, the end of the window being excluded", async () => {
    const aircraft = [plane("a1", -40, 0, 90, 720)];
    expect((await computeAt(aircraft, T0 + 220 * SECOND, "a1")).overhead?.hex).toBe("a1");
    expect((await computeAt(aircraft, T0 + 230 * SECOND, "a1")).overhead).toBeNull();
    expect((await computeAt(aircraft, T0 + 230 * SECOND)).upcoming).toEqual([]);
  });

  it("CA6 : sorts the passages by entry time, whatever the order of the snapshot", async () => {
    const result = await computeAt([plane("a1", -40, 0, 90, 720), plane("b2", 30, -3, 270, 720)]);
    expect(hexes(result.upcoming)).toEqual(["b2", "a1"]);
    const reversed = await computeAt([plane("b2", 30, -3, 270, 720), plane("a1", -40, 0, 90, 720)]);
    expect(hexes(reversed.upcoming)).toEqual(["b2", "a1"]);
  });

  it("CA6 : sorts on the entry in the window, not on the closest point", async () => {
    // Le lent entre dans sa fenêtre à 150 s mais atteint son point le plus proche à 200 s ; le rapide entre à
    // 155 s et atteint le sien à 180 s : le tri sur l'entrée met le lent en premier, un tri sur le point le plus proche non.
    const result = await computeAt([plane("fast", -36, 0, 90, 720), plane("slow", -20, 0, 90, 360)]);
    expect(hexes(result.upcoming)).toEqual(["slow", "fast"]);
  });

  it("CA6 : keeps the 10 first passages out of 12", async () => {
    const aircraft = Array.from({ length: 12 }, (_, index) =>
      plane(`p${String(index).padStart(2, "0")}`, -(20 + index * 3), 0, 90, 720),
    ).reverse();
    const result = await computeAt(aircraft);
    expect(hexes(result.upcoming)).toEqual(Array.from({ length: 10 }, (_, i) => `p${String(i).padStart(2, "0")}`));
  });

  it("CA6 : breaks a tie on the entry time with the hex, and keeps one passage per hex", async () => {
    const tie = await computeAt([plane("ab", -40, 0, 90, 720), plane("aa", -40, 0, 90, 720)]);
    expect(hexes(tie.upcoming)).toEqual(["aa", "ab"]);
    const duplicate = await computeAt([plane("dd", -40, 0, 90, 720), plane("dd", -30, 0, 90, 720)]);
    expect(duplicate.upcoming).toHaveLength(1);
    expectNear((duplicate.upcoming[0] as Passage).passageTimeMs, T0 + 175 * SECOND, SECOND);
  });

  it("CA6 : considers only the first occurrence of a hex, even when it is unusable", async () => {
    const result = await computeAt([plane("dd", -40, 0, 90, null), plane("dd", -30, 0, 90, 720)]);
    expect(result).toEqual({ overhead: null, upcoming: [] });
  });

  it("CA6 : never lists a passage whose window has started, and shows no negative countdown", async () => {
    const aircraft = [plane("a1", -40, 0, 90, 720), plane("b2", 30, -3, 270, 720), plane("c3", -20, 0, 90, 360)];
    for (const offset of [0, 60, 120, 130, 160, 180, 300]) {
      const nowMs = T0 + offset * SECOND;
      const result = await computeAt(aircraft, nowMs);
      for (const passage of result.upcoming) expect(passage.passageTimeMs).toBeGreaterThan(nowMs);
    }
  });

  it("CA7 : picks as overhead the nearest aircraft among those inside their window with a pass within 4 km", async () => {
    // h1 : dans sa fenêtre [-20 s ; +30 s], à 2,2 km ; i1 : dans la sienne, à 3,0 km.
    const result = await computeAt([plane("i1", 0.5, -3, 270, 720), plane("h1", -1, 2, 90, 720)]);
    const overhead = result.overhead as Passage;
    expect(overhead.hex).toBe("h1");
    expectNear(overhead.closestDistanceKm, 2, 0.1);
    expectNear(overhead.groundDistanceKm, Math.hypot(1, 2), 0.1);
    expect(overhead.passageTimeMs).toBeLessThanOrEqual(T0);
    expect(overhead.windowEndMs).toBeGreaterThan(T0);
  });

  it("CA7 : hides the other aircraft in their window instead of listing them (INV3)", async () => {
    const result = await computeAt([plane("h1", -1, 2, 90, 720), plane("i1", 0.5, -3, 270, 720)]);
    expect(result.overhead?.hex).toBe("h1");
    expect(hexes(result.upcoming)).not.toContain("i1");
    expect(result.upcoming).toEqual([]);
  });

  it("CA7 : breaks a tie on the distance with the hex", async () => {
    const result = await computeAt([plane("t2", -1, 2, 90, 720), plane("t1", -1, 2, 90, 720)]);
    expect(result.overhead?.hex).toBe("t1");
  });

  it("CA7 : makes overhead an aircraft already past its closest point, in the middle of its window", async () => {
    // Point le plus proche 10 s derrière (à 3 km), fenêtre de -35 s à +15 s : l'avion s'éloigne mais est encore éligible.
    const result = await computeAt([plane("r1", 2, 3, 90, 720)]);
    const overhead = result.overhead as Passage;
    expect(overhead.hex).toBe("r1");
    expect(overhead.closestTimeMs).toBeLessThan(T0);
    expectNear(overhead.closestDistanceKm, 3, 0.1);
    expectNear(overhead.windowEndMs, T0 + 15 * SECOND, SECOND);
    expect(result.upcoming).toEqual([]);
  });

  it("CA7 : has no overhead for an empty snapshot", async () => {
    expect(await computeAt([])).toEqual({ overhead: null, upcoming: [] });
  });

  it("CA7 : keeps an aircraft already inside its window out of the upcoming list and out of the overhead beyond 4 km", async () => {
    const result = await computeAt([plane("j1", -2, 4.5, 90, 720)]);
    expect(result).toEqual({ overhead: null, upcoming: [] });
  });

  it("CA8 : keeps the previous overhead while its window contains the current time, even if another is nearer", async () => {
    // À +20 s, h1 est à 3,6 km et k à 2,2 km, tous deux dans leur fenêtre : h1 reste le survol (fin de fenêtre à +30 s).
    const aircraft = [plane("h1", -1, 2, 90, 720), plane("k1", 6, -1, 270, 720)];
    expect((await computeAt(aircraft, T0)).overhead?.hex).toBe("h1");
    expect((await computeAt(aircraft, T0 + 20 * SECOND)).overhead?.hex).toBe("k1");
    expect((await computeAt(aircraft, T0 + 20 * SECOND, "h1")).overhead?.hex).toBe("h1");
  });

  it("CA8 : hands over to the nearest candidate when the previous overhead has left its window", async () => {
    const aircraft = [plane("h1", -1, 2, 90, 720), plane("k1", 6, -1, 270, 720)];
    const result = await computeAt(aircraft, T0 + 35 * SECOND, "h1");
    expect(result.overhead?.hex).toBe("k1");
  });

  it("CA8 : evaluates the 4 km threshold at the entry only", async () => {
    const aircraft = [plane("j1", -2, 4.5, 90, 720)];
    expect((await computeAt(aircraft, T0, null)).overhead).toBeNull();
    const kept = await computeAt(aircraft, T0, "j1");
    expect(kept.overhead?.hex).toBe("j1");
    expectNear((kept.overhead as Passage).closestDistanceKm, 4.5, 0.1);
  });

  it("CA8 : falls back to the entry rule when the previous overhead is absent, unusable or not started", async () => {
    const aircraft = [plane("h1", -1, 2, 90, 720), plane("a1", -40, 0, 90, 720)];
    expect((await computeAt(aircraft, T0, "gone")).overhead?.hex).toBe("h1");
    expect((await computeAt(aircraft, T0, "a1")).overhead?.hex).toBe("h1");
    const stalled = [plane("h1", -1, 2, 90, null)];
    expect((await computeAt(stalled, T0, "h1")).overhead).toBeNull();
    expect((await computeAt([plane("a1", -40, 0, 90, 720)], T0, "a1")).overhead).toBeNull();
  });

  it("CA9 : gives the same entry time at any hour, the countdown being the entry time minus the clock", async () => {
    const aircraft = [plane("a1", -40, 0, 90, 720)];
    const early = (await computeAt(aircraft, T0)).upcoming[0] as Passage;
    const later = (await computeAt(aircraft, T0 + 100 * SECOND)).upcoming[0] as Passage;
    expect(later.passageTimeMs).toBe(early.passageTimeMs);
    expectNear(later.passageTimeMs - (T0 + 100 * SECOND), 75 * SECOND, SECOND);
  });

  it("CA9 : extrapolates from the time of the snapshot, not from the current time", async () => {
    // Instantané pris 60 s après T0 avec l'avion 12 km plus loin sur sa route : c'est le même vol que a1 de T0.
    const snapshotLater = await computeAt([plane("a1", -28, 0, 90, 720)], T0, null, T0 + 60 * SECOND);
    expectNear((snapshotLater.upcoming[0] as Passage).passageTimeMs, T0 + 175 * SECOND, SECOND);
  });

  it("CA9 : turns an upcoming passage into the overhead at the entry in the window, then drops it at the end", async () => {
    const aircraft = [plane("a1", -40, 0, 90, 720)];
    const before = await computeAt(aircraft, T0 + 170 * SECOND);
    expect(hexes(before.upcoming)).toEqual(["a1"]);
    expect(before.overhead).toBeNull();
    const during = await computeAt(aircraft, T0 + 180 * SECOND);
    expect(during.overhead?.hex).toBe("a1");
    expect(during.upcoming).toEqual([]);
    const after = await computeAt(aircraft, T0 + 230 * SECOND);
    expect(after).toEqual({ overhead: null, upcoming: [] });
  });

  it("CA9 : extrapolates backward without error when the current time precedes the snapshot", async () => {
    const result = await computeAt([plane("a1", -40, 0, 90, 720)], T0 - 10 * SECOND);
    expectNear((result.upcoming[0] as Passage).passageTimeMs, T0 + 175 * SECOND, SECOND);
  });
});

describe("SPEC-0004 observer acquisition and foreground", () => {
  const position: Position = { latitude: 45.764, longitude: 4.8357 };

  function stub(overrides: Partial<LocationService>): LocationService & { positionReads: number } {
    const service = {
      positionReads: 0,
      requestPermission: async () => "granted" as const,
      async getPosition() {
        service.positionReads += 1;
        return { ...position };
      },
      watchHeading: () => () => undefined,
      ...overrides,
    };
    return service;
  }

  it("CA10 : requests the permission then reads the position when it is granted", async () => {
    const { acquireObserver } = await locationModule();
    const fix = await acquireObserver(createFakeLocation({ permission: "granted", position }));
    expect(fix).toEqual({ status: "granted", position });
  });

  it("CA10 : reports a denied permission without reading the position", async () => {
    const { acquireObserver } = await locationModule();
    const service = stub({ requestPermission: async () => "denied" as const });
    expect(await acquireObserver(service)).toEqual({ status: "denied" });
    expect(service.positionReads).toBe(0);
    expect(await acquireObserver(createFakeLocation({ permission: "denied", position }))).toEqual({
      status: "denied",
    });
  });

  it("CA10 : reports denied when the permission is removed between the request and the read", async () => {
    const { acquireObserver } = await locationModule();
    const service = stub({
      async getPosition() {
        throw new AppError("LOCATION_DENIED", "Location permission denied");
      },
    });
    expect(await acquireObserver(service)).toEqual({ status: "denied" });
  });

  it("CA10 : propagates any other error as it is", async () => {
    const { acquireObserver } = await locationModule();
    const failure = new RangeError("position unavailable");
    const service = stub({
      async getPosition() {
        throw failure;
      },
    });
    await expect(acquireObserver(service)).rejects.toBe(failure);
  });

  it("CA10 : reads the position again at each call", async () => {
    const { acquireObserver } = await locationModule();
    const service = stub({});
    await acquireObserver(service);
    await acquireObserver(service);
    expect(service.positionReads).toBe(2);
  });

  it("CA11 : calls every listener at each return to the foreground, until it unsubscribes", async () => {
    const { createFakeLifecycle } = await lifecycleModule();
    const lifecycle = createFakeLifecycle();
    const first: string[] = [];
    const second: string[] = [];
    const stopFirst = lifecycle.onForeground(() => first.push("first"));
    lifecycle.onForeground(() => second.push("second"));
    lifecycle.enterForeground();
    lifecycle.enterForeground();
    expect(first).toEqual(["first", "first"]);
    stopFirst();
    lifecycle.enterForeground();
    expect(first).toEqual(["first", "first"]);
    expect(second).toEqual(["second", "second", "second"]);
  });

  it("CA11 : does nothing before any return to the foreground", async () => {
    const { createFakeLifecycle } = await lifecycleModule();
    const lifecycle = createFakeLifecycle();
    let calls = 0;
    lifecycle.onForeground(() => {
      calls += 1;
    });
    expect(calls).toBe(0);
  });
});
