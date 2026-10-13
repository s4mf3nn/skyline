import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AdsbSource, Aircraft } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import type { Position } from "../../src/shared/location";

// Scénarios cachés de SPEC-0006 (logique du carrousel) : parcours de bout en bout par l'interface publique, avec
// d'autres données que le contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
interface Passage {
  hex: string;
  passageTimeMs: number;
  windowEndMs: number;
  arrivalCardinal: CardinalPoint;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
interface Card {
  kind: "overhead" | "upcoming";
  hex: string;
  countdown: string | null;
  passTime: string | null;
  arrowAngleDeg: number | null;
  flightLabel: string;
  airlineName: string;
  altitude: string;
  visibility: { progress: number; remaining: string } | null;
}
interface PassagesModule {
  buildCards(input: { scene: Scene; nowMs: number; headingDeg: number | null; timeZone: string }): Card[];
}
interface SceneModule {
  computeScene(input: {
    snapshot: { aircraft: readonly Aircraft[]; takenAtMs: number };
    observer: Position;
    nowMs: number;
    previousOverheadHex: string | null;
  }): Scene;
}
interface DemoModule {
  createDemoAdsbSource(clock: { now(): number }): AdsbSource;
}
const passages = () => load<PassagesModule>("src/features/passages/service.ts");
const sceneModule = () => load<SceneModule>("src/shared/scene/index.ts");
const demoModule = () => load<DemoModule>("src/shared/adsb/demo.ts");

// Observateur à Sydney. Plan local en km (x est, y nord).
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
  callsign: string | null,
  east: number,
  north: number,
  track: number,
  speed: number,
): Aircraft {
  return { hex, callsign, ...at(east, north), altitudeM: 9000, groundSpeedKmh: speed, trackDeg: track };
}

describe("SPEC-0006 scénarios cachés : de la scène aux cartes", () => {
  it("follows an aircraft from its first countdown to the overhead card and to its removal", async () => {
    const { computeScene } = await sceneModule();
    const { buildCards } = await passages();
    // Vers le sud à 900 km/h (0,25 km/s) depuis 30,125 km au nord, décalé de 2 km à l'est : entrée dans la fenêtre à
    // 100,5 s, fin à 140,5 s (mi-seconde : la tolérance de SPEC-0004 ne peut rien faire basculer).
    const aircraft = [plane("e5", "QFA12", 2, 30.125, 180, 900), plane("e6", "VOZ401", -50, 0, 90, 900)];
    const snapshot = { aircraft, takenAtMs: T0 };
    let previous: string | null = null;
    const seen: Array<{ second: number; kinds: string[]; first: string | null }> = [];
    for (const second of [0, 99, 100, 101, 120, 140, 141]) {
      const nowMs = T0 + second * SECOND;
      const scene = computeScene({ snapshot, observer: OBSERVER, nowMs, previousOverheadHex: previous });
      previous = scene.overhead?.hex ?? null;
      const cards = buildCards({ scene, nowMs, headingDeg: null, timeZone: "Australia/Sydney" });
      seen.push({ second, kinds: cards.map((card) => `${card.kind}:${card.hex}`), first: cards[0]?.countdown ?? null });
      for (const card of cards) {
        if (card.kind === "upcoming") expect(card.countdown).toMatch(/^\d{2,}:\d{2}$/);
        if (card.kind === "upcoming") expect(card.countdown).not.toBe("00:00");
      }
    }
    expect(seen.map((entry) => entry.kinds)).toEqual([
      ["upcoming:e5", "upcoming:e6"],
      ["upcoming:e5", "upcoming:e6"],
      ["upcoming:e5", "upcoming:e6"],
      ["overhead:e5", "upcoming:e6"],
      ["overhead:e5", "upcoming:e6"],
      ["overhead:e5", "upcoming:e6"],
      ["upcoming:e6"],
    ]);
    expect(seen[0]?.first).toBe("01:41");
    expect(seen[1]?.first).toBe("00:02");
    expect(seen[2]?.first).toBe("00:01");
  });

  it("derives the overhead visibility from the window and keeps the arrow null without heading, then relative to it", async () => {
    const { computeScene } = await sceneModule();
    const { buildCards } = await passages();
    // Déjà dans la fenêtre : 2,9 km avant le point le plus proche, cap est, 720 km/h (0,2 km/s), 2 km au nord.
    const aircraft = [plane("w1", "AFR1506", -2.9, 2, 90, 720)];
    const nowMs = T0;
    const scene = computeScene({
      snapshot: { aircraft, takenAtMs: T0 },
      observer: OBSERVER,
      nowMs,
      previousOverheadHex: null,
    });
    const [blind] = buildCards({ scene, nowMs, headingDeg: null, timeZone: "UTC" });
    expect(blind?.kind).toBe("overhead");
    expect(blind?.arrowAngleDeg).toBeNull();
    expect(blind?.visibility?.progress).toBeCloseTo(0.21, 2);
    expect(blind?.visibility?.remaining).toBe("00:40");
    expect(blind?.countdown).toBeNull();
    const [aware] = buildCards({ scene, nowMs, headingDeg: 359, timeZone: "UTC" });
    expect(aware?.arrowAngleDeg).toBe(91);
  });

  it("builds well-formed cards from the demo source over time, whatever the airline", async () => {
    const { createDemoAdsbSource } = await demoModule();
    const { computeScene } = await sceneModule();
    const { buildCards } = await passages();
    const clock = createFakeClock(T0 + 777_000);
    const source = createDemoAdsbSource(clock);
    let previous: string | null = null;
    for (let step = 0; step < 90; step += 1) {
      const nowMs = clock.now();
      const aircraft = await source.fetchAircraft({ ...OBSERVER, radiusKm: 80 });
      const scene = computeScene({
        snapshot: { aircraft, takenAtMs: nowMs },
        observer: OBSERVER,
        nowMs,
        previousOverheadHex: previous,
      });
      previous = scene.overhead?.hex ?? null;
      const cards = buildCards({ scene, nowMs, headingDeg: 123, timeZone: "Australia/Sydney" });
      expect(cards.length).toBeLessThanOrEqual(11);
      expect(cards.filter((card) => card.kind === "overhead").length).toBeLessThanOrEqual(1);
      if (cards.some((card) => card.kind === "overhead")) expect(cards[0]?.kind).toBe("overhead");
      expect(new Set(cards.map((card) => card.hex)).size).toBe(cards.length);
      for (const card of cards) {
        expect(card.flightLabel.length).toBeGreaterThan(0);
        expect(card.airlineName.length).toBeGreaterThan(0);
        expect(card.arrowAngleDeg).toBeGreaterThanOrEqual(0);
        expect(card.arrowAngleDeg).toBeLessThan(360);
        if (card.kind === "upcoming") expect(card.passTime).toMatch(/^\d{2}:\d{2}$/);
      }
      clock.advance(10 * SECOND);
    }
  });

  it("keeps a slow aircraft countdown beyond 99 minutes readable", async () => {
    const { computeScene } = await sceneModule();
    const { buildCards } = await passages();
    // 30 km/h : 65 km de trajet jusqu'à la fenêtre, soit plus de deux heures (7 800,5 s).
    const aircraft = [plane("s1", "ZZZ9", -70.00417, 0, 90, 30)];
    const scene = computeScene({
      snapshot: { aircraft, takenAtMs: T0 },
      observer: OBSERVER,
      nowMs: T0,
      previousOverheadHex: null,
    });
    const [card] = buildCards({ scene, nowMs: T0, headingDeg: null, timeZone: "UTC" });
    expect(card?.countdown).toBe("130:01");
    expect(card?.altitude).toBe("9 000");
  });
});
