import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Aircraft } from "../../src/shared/adsb";
import type { Position } from "../../src/shared/location";

// Scénarios cachés de SPEC-0004 (calcul de la scène) : parcours de bout en bout par l'interface publique, avec
// d'autres données que le contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
interface Passage {
  hex: string;
  passageTimeMs: number;
  windowEndMs: number;
  closestDistanceKm: number;
  groundDistanceKm: number;
  arrivalBearingDeg: number;
  arrivalCardinal: CardinalPoint;
  trackCardinal: CardinalPoint;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
interface SceneModule {
  arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null;
  computeScene(input: {
    snapshot: { aircraft: readonly Aircraft[]; takenAtMs: number };
    observer: Position;
    nowMs: number;
    previousOverheadHex: string | null;
  }): Scene;
}
const sceneModule = () => load<SceneModule>("src/shared/scene/index.ts");

// Observateur dans l'hémisphère sud et à l'est : Sydney. Plan local en km (x est, y nord).
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: -33.8688, longitude: 151.2093 };
const T0 = 1_790_000_000_000;
const SECOND = 1000;

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
  altitudeM: number | null = 9_000,
): Aircraft {
  return { hex, callsign: null, ...at(eastKm, northKm), altitudeM, groundSpeedKmh, trackDeg };
}

function expectNear(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

/** Rejoue la scène comme le crochet : le survol de l'étape précédente est passé à l'étape suivante. */
async function replay(aircraft: Aircraft[], offsetsSeconds: number[], takenAtMs = T0) {
  const { computeScene } = await sceneModule();
  const scenes: Scene[] = [];
  let previousOverheadHex: string | null = null;
  for (const offset of offsetsSeconds) {
    const next: Scene = computeScene({
      snapshot: { aircraft, takenAtMs },
      observer: OBSERVER,
      nowMs: T0 + offset * SECOND,
      previousOverheadHex,
    });
    scenes.push(next);
    previousOverheadHex = next.overhead?.hex ?? null;
  }
  return scenes;
}

describe("SPEC-0004 hidden scenarios (scene computation)", () => {
  it("follows a sky from the first overhead to the last passage, with the arrows", async () => {
    const aircraft = [
      plane("s5", -1.5, 0.5, 90, 900), // survole : fenêtre de -14 s à +26 s
      plane("s1", 3, 45, 180, 900), // du nord, à 3 km à l'est : entre à +160 s, sort à +200 s
      plane("s2", 36, -1, 270, 600), // de l'est, à 1 km au sud : entre à +186 s, sort à +246 s
      plane("s3", 0, 0.2, 90, 900, 0), // au sol, à côté de l'observateur
      plane("s4", 0, 10, 0, 800), // s'éloigne vers le nord
    ];
    const [start, gap, first, second, handover, end] = await replay(aircraft, [0, 30, 165, 190, 205, 250]);
    const { arrowAngleDeg } = await sceneModule();

    expect(start?.overhead?.hex).toBe("s5");
    expectNear(start?.overhead?.closestDistanceKm ?? -1, 0.5, 0.1);
    expect(start?.upcoming.map((passage) => passage.hex)).toEqual(["s1", "s2"]);
    const s1 = start?.upcoming[0] as Passage;
    expectNear(s1.passageTimeMs, T0 + 160 * SECOND, SECOND);
    expectNear(s1.arrivalBearingDeg, 31, 1);
    expect(s1.arrivalCardinal).toBe("NE");
    expect(s1.trackCardinal).toBe("S");
    const s2 = start?.upcoming[1] as Passage;
    expectNear(s2.passageTimeMs, T0 + 186 * SECOND, SECOND);
    expectNear(s2.arrivalBearingDeg, 101, 1);
    expect(s2.arrivalCardinal).toBe("E");
    expect(s2.trackCardinal).toBe("O");

    // Le téléphone vise le nord-nord-ouest (350°) : la flèche de s1 tourne vers la droite, celle du survol vers la gauche.
    expectNear(arrowAngleDeg(s1.arrivalBearingDeg, 350) ?? -1, 41, 1);
    expect(arrowAngleDeg(90, 100)).toBe(350);

    expect(gap?.overhead).toBeNull();
    expect(gap?.upcoming.map((passage) => passage.hex)).toEqual(["s1", "s2"]);
    expect(first?.overhead?.hex).toBe("s1");
    expect(first?.upcoming.map((passage) => passage.hex)).toEqual(["s2"]);
    expect(second?.overhead?.hex).toBe("s1");
    expect(second?.upcoming).toEqual([]);
    expect(handover?.overhead?.hex).toBe("s2");
    expect(handover?.upcoming).toEqual([]);
    expect(end).toEqual({ overhead: null, upcoming: [] });
  });

  it("ranks a crowded sky: invalid aircraft out, the ten earliest entries kept, in order", async () => {
    // Entrées dans la fenêtre : w0..w5 à 125, 150, 175, 200, 225, 250 s ; n0..n5 à 270, 330, 390, 450, 510, 570 s.
    const westbound = Array.from({ length: 6 }, (_, i) => plane(`w${i}`, -(30 + 5 * i), i % 2, 90, 720));
    const southbound = Array.from({ length: 6 }, (_, i) => plane(`n${i}`, i % 3, 32 + 6 * i, 180, 360));
    const noise = [
      plane("g1", -20, 0, 90, 720, 0), // au sol
      plane("z1", -25, 0, 90, null), // vitesse inconnue
      plane("z2", -25, 1, null, 700), // cap inconnu
      plane("f1", -85, 0, 90, 900), // hors du rayon de 80 km
      plane("m1", 40, 8, 90, 720), // passe à 8 km
    ];
    const crowd = [...southbound.slice().reverse(), ...noise, ...westbound.slice().reverse()];
    const [scene] = await replay(crowd, [0]);

    expect(scene?.overhead).toBeNull();
    expect(scene?.upcoming.map((passage) => passage.hex)).toEqual([
      "w0",
      "w1",
      "w2",
      "w3",
      "w4",
      "w5",
      "n0",
      "n1",
      "n2",
      "n3",
    ]);
    const times = (scene?.upcoming ?? []).map((passage) => passage.passageTimeMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expectNear(times[0] ?? 0, T0 + 125 * SECOND, SECOND);
    expectNear(times[9] ?? 0, T0 + 450 * SECOND, SECOND);
  });

  it("keeps an overhead through a turn and lets it go at the end of its recomputed window", async () => {
    const { computeScene } = await sceneModule();
    const observer = OBSERVER;
    const before = computeScene({
      snapshot: { aircraft: [plane("t1", -1, 3, 90, 720)], takenAtMs: T0 },
      observer,
      nowMs: T0,
      previousOverheadHex: null,
    });
    expect(before.overhead?.hex).toBe("t1");

    // Dix secondes plus tard l'avion a viré : il s'éloigne et son point de passage recalculé est à 5,3 km.
    const turned = [plane("t1", -1, 6.5, 45, 720)];
    const snapshot = { aircraft: turned, takenAtMs: T0 + 10 * SECOND };
    const kept = computeScene({ snapshot, observer, nowMs: T0 + 10 * SECOND, previousOverheadHex: "t1" });
    expect(kept.overhead?.hex).toBe("t1");
    expectNear(kept.overhead?.closestDistanceKm ?? -1, 5.3, 0.1);
    expect(kept.upcoming).toEqual([]);

    const entry = computeScene({ snapshot, observer, nowMs: T0 + 10 * SECOND, previousOverheadHex: null });
    expect(entry).toEqual({ overhead: null, upcoming: [] });

    const gone = computeScene({ snapshot, observer, nowMs: T0 + 20 * SECOND, previousOverheadHex: "t1" });
    expect(gone).toEqual({ overhead: null, upcoming: [] });
  });
});
