import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Aircraft } from "../../src/shared/adsb";
import type { Position } from "../../src/shared/location";

// Scénarios cachés de SPEC-0011 (rejeu de trace) : traces construites ici, avec d'autres données que le contrat.
// Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Passage {
  hex: string;
  passageTimeMs: number;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
interface SceneModule {
  computeScene(input: {
    snapshot: { aircraft: readonly Aircraft[]; takenAtMs: number };
    observer: Position;
    nowMs: number;
    previousOverheadHex: string | null;
  }): Scene;
}
const sceneModule = () => load<SceneModule>("src/shared/scene/index.ts");

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: -33.8688, longitude: 151.2093 };
const T0 = 1_790_000_000_000;

function toPosition(x: number, y: number): Position {
  const cosLat = Math.cos((OBSERVER.latitude * Math.PI) / 180);
  return {
    latitude: OBSERVER.latitude + y / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + x / (KM_PER_DEGREE * cosLat),
  };
}

// Avion en ligne droite : à `closestSeconds` il est au point le plus proche, à `offsetKm` de l'observateur.
function flightAt(hex: string, trackDeg: number, speedKmh: number, offsetKm: number, closestSeconds: number) {
  const radians = (trackDeg * Math.PI) / 180;
  const direction = { x: Math.sin(radians), y: Math.cos(radians) };
  const closest = { x: -direction.y * offsetKm, y: direction.x * offsetKm };
  return (seconds: number): Aircraft => {
    const travelled = (speedKmh / 3600) * (seconds - closestSeconds);
    const position = toPosition(closest.x + direction.x * travelled, closest.y + direction.y * travelled);
    return {
      hex,
      callsign: hex.toUpperCase(),
      ...position,
      altitudeM: 9000,
      groundSpeedKmh: speedKmh,
      trackDeg,
    };
  };
}

const entrySeconds = (speedKmh: number, closestSeconds: number) => closestSeconds - (5 / speedKmh) * 3600;

function sceneFor(aircraft: Aircraft[], seconds: number, previousOverheadHex: string | null, takenAtSeconds = seconds) {
  return sceneModule().then(({ computeScene }) =>
    computeScene({
      snapshot: { aircraft, takenAtMs: T0 + takenAtSeconds * 1000 },
      observer: OBSERVER,
      nowMs: T0 + seconds * 1000,
      previousOverheadHex,
    }),
  );
}

describe("SPEC-0011 scénarios cachés : parcours critique", () => {
  it("replays a fast cruise flight at other leads and chains upcoming, countdown and overhead", async () => {
    const flight = flightAt("7c6b2d", 250, 880, 3.1, 900);
    const entry = entrySeconds(880, 900);
    let previous: string | null = null;
    let firstOverheadSeconds: number | null = null;
    for (let seconds = Math.floor(entry) - 240; seconds <= entry + 40; seconds += 1) {
      const snapshotSeconds = seconds - (seconds % 10);
      const scene = await sceneFor([flight(snapshotSeconds)], seconds, previous, snapshotSeconds);
      const upcoming = scene.upcoming.find((passage) => passage.hex === "7c6b2d");
      if (upcoming) {
        expect(upcoming.passageTimeMs).toBeGreaterThan(T0 + seconds * 1000);
        expect(Math.abs(upcoming.passageTimeMs - (T0 + entry * 1000))).toBeLessThanOrEqual(10_000);
      }
      if (scene.overhead && firstOverheadSeconds === null) firstOverheadSeconds = seconds;
      previous = scene.overhead?.hex ?? null;
    }
    expect(firstOverheadSeconds).not.toBeNull();
    expect(Math.abs((firstOverheadSeconds as number) - entry)).toBeLessThanOrEqual(10);
  });

  it("forecasts a slow turboprop within 10 s even when a snapshot is missed", async () => {
    const flight = flightAt("4b1a02", 40, 450, 2, 700);
    const entry = entrySeconds(450, 700);
    // Échantillons aux multiples de 10 s sauf un trou de 20 s juste avant l'avance de 60 s.
    const lastSeconds = Math.floor((entry - 60) / 10) * 10 - 10;
    const scene = await sceneFor([flight(lastSeconds)], lastSeconds, null);
    const passage = scene.upcoming.find((entry2) => entry2.hex === "4b1a02");
    expect(passage).toBeDefined();
    expect(Math.abs((passage as Passage).passageTimeMs - (T0 + entry * 1000))).toBeLessThanOrEqual(10_000);
  });

  it("drops the forecast once the aircraft turns away, and never shows a negative countdown", async () => {
    const straight = flightAt("a1b2c3", 120, 800, 1.5, 600);
    const turned = flightAt("a1b2c3", 120, 800, 60, 600);
    const entry = entrySeconds(800, 600);
    const before = await sceneFor([straight(Math.floor(entry) - 90)], Math.floor(entry) - 90, null);
    expect(before.upcoming.map((passage) => passage.hex)).toContain("a1b2c3");
    const after = await sceneFor([turned(Math.floor(entry) - 80)], Math.floor(entry) - 80, null);
    expect(after.upcoming.map((passage) => passage.hex)).not.toContain("a1b2c3");
    expect(after.overhead).toBeNull();
    for (const passage of before.upcoming) {
      expect(passage.passageTimeMs - (T0 + (Math.floor(entry) - 90) * 1000)).toBeGreaterThan(0);
    }
  });
});
