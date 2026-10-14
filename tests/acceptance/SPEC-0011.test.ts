import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Aircraft } from "../../src/shared/adsb";
import type { Clock } from "../../src/shared/clock";
import type { Position } from "../../src/shared/location";

// Contrat de SPEC-0011 (Vitest) : rejeu d'une trace ADS-B enregistrée contre le calcul de la scène (H3, mesure a),
// puis contrôle de la fiche de preuve sur iPhone réel. Le rejeu n'utilise que l'interface publique de SPEC-0004.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

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
interface ClockModule {
  createFakeClock(startMs: number): Clock & { advance(ms: number): void };
}
interface Sample {
  atMs: number;
  aircraft: Aircraft[];
}
interface RecordedTrace {
  kind: string;
  description: string;
  observer: Position;
  trackedHex: string;
  stepMs: number;
  samples: Sample[];
}

const trace: RecordedTrace = JSON.parse(fs.readFileSync(path.resolve("tests/acceptance/SPEC-0011.trace.json"), "utf8"));
const PROOF_FILE = path.resolve("specs/SPEC-0011-parcours-critique/preuve.md");

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const WINDOW_HALF_LENGTH_KM = 5;
const TOLERANCE_MS = 10_000;

interface PlanePoint {
  timeMs: number;
  x: number;
  y: number;
}

// Positions de l'avion suivi dans un plan local en km autour de l'observateur (x est, y nord).
function trackedPoints(): PlanePoint[] {
  const cosLat = Math.cos((trace.observer.latitude * Math.PI) / 180);
  return trace.samples.map((sample) => {
    const plane = sample.aircraft.find((aircraft) => aircraft.hex === trace.trackedHex);
    if (!plane) throw new Error(`tracked aircraft missing at ${sample.atMs}`);
    return {
      timeMs: sample.atMs,
      x: (plane.longitude - trace.observer.longitude) * cosLat * KM_PER_DEGREE,
      y: (plane.latitude - trace.observer.latitude) * KM_PER_DEGREE,
    };
  });
}

const at = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
};

// Vérité terrain, sans le calcul de la scène : point de la trace le plus proche de l'observateur, puis instant où
// l'avion était à 5 km (le long de la trace) avant ce point.
function groundTruth(): { closestTimeMs: number; closestDistanceKm: number; entryMs: number } {
  const points = trackedPoints();
  const arc: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const from = at(points, i - 1);
    const to = at(points, i);
    arc.push(at(arc, i - 1) + Math.hypot(to.x - from.x, to.y - from.y));
  }
  let best = { distance: Number.POSITIVE_INFINITY, segment: 0, fraction: 0 };
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = at(points, i);
    const to = at(points, i + 1);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const fraction = Math.min(1, Math.max(0, -(from.x * dx + from.y * dy) / (dx * dx + dy * dy)));
    const distance = Math.hypot(from.x + fraction * dx, from.y + fraction * dy);
    if (distance < best.distance) best = { distance, segment: i, fraction };
  }
  const bestFrom = at(points, best.segment);
  const bestTo = at(points, best.segment + 1);
  const closestArc = at(arc, best.segment) + best.fraction * (at(arc, best.segment + 1) - at(arc, best.segment));
  const closestTimeMs = bestFrom.timeMs + best.fraction * (bestTo.timeMs - bestFrom.timeMs);
  const entryArc = closestArc - WINDOW_HALF_LENGTH_KM;
  let index = 0;
  while (index < arc.length - 2 && at(arc, index + 1) < entryArc) index += 1;
  const part = (entryArc - at(arc, index)) / (at(arc, index + 1) - at(arc, index));
  const from = at(points, index);
  const entryMs = from.timeMs + part * (at(points, index + 1).timeMs - from.timeMs);
  return { closestTimeMs, closestDistanceKm: best.distance, entryMs };
}

function lastSampleAtOrBefore(timeMs: number): Sample {
  return at(
    trace.samples.filter((sample) => sample.atMs <= timeMs),
    trace.samples.filter((sample) => sample.atMs <= timeMs).length - 1,
  );
}

interface ReplayStep {
  nowMs: number;
  scene: Scene;
}

// Rejeu à la seconde : l'horloge factice avance, l'instantané est rafraîchi à chaque échantillon.
async function replay(fromMs: number, toMs: number): Promise<ReplayStep[]> {
  const { computeScene } = await load<SceneModule>("src/shared/scene/index.ts");
  const { createFakeClock } = await load<ClockModule>("src/shared/clock/fake.ts");
  const clock = createFakeClock(fromMs);
  const steps: ReplayStep[] = [];
  let previousOverheadHex: string | null = null;
  while (clock.now() <= toMs) {
    const sample = lastSampleAtOrBefore(clock.now());
    const scene = computeScene({
      snapshot: { aircraft: sample.aircraft, takenAtMs: sample.atMs },
      observer: trace.observer,
      nowMs: clock.now(),
      previousOverheadHex,
    });
    steps.push({ nowMs: clock.now(), scene });
    previousOverheadHex = scene.overhead?.hex ?? null;
    clock.advance(1000);
  }
  return steps;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skip("SPEC-0011 Parcours critique : rejeu de trace enregistrée", () => {
  it("CA1 : uses a recorded cruise trace without turn, tracked aircraft present in every sample", () => {
    expect(trace.kind).toBe("recorded");
    expect(trace.description.length).toBeGreaterThan(0);
    expect(trace.stepMs).toBe(10_000);
    expect(trace.samples.length).toBeGreaterThanOrEqual(121);
    const durationMs = at(trace.samples, trace.samples.length - 1).atMs - at(trace.samples, 0).atMs;
    expect(durationMs).toBeGreaterThanOrEqual(20 * 60 * 1000);
    for (let i = 1; i < trace.samples.length; i += 1) {
      expect(Math.abs(at(trace.samples, i).atMs - at(trace.samples, i - 1).atMs - trace.stepMs)).toBeLessThanOrEqual(
        1000,
      );
    }
    const tracked = trace.samples.map((sample) => {
      const plane = sample.aircraft.find((aircraft) => aircraft.hex === trace.trackedHex);
      expect(plane).toBeDefined();
      return plane as Aircraft;
    });
    const tracks = tracked.map((plane) => plane.trackDeg as number);
    const speeds = tracked.map((plane) => plane.groundSpeedKmh as number);
    expect(tracks.every((value) => typeof value === "number")).toBe(true);
    expect(speeds.every((value) => typeof value === "number" && value > 0)).toBe(true);
    // Écart de cap pris sur le cercle (359° et 1° sont à 2°).
    const spread = Math.max(
      ...tracks.map((a) => Math.max(...tracks.map((b) => Math.abs(((a - b + 540) % 360) - 180)))),
    );
    expect(spread).toBeLessThanOrEqual(3);
    expect(Math.max(...speeds) / Math.min(...speeds) - 1).toBeLessThanOrEqual(0.1);
    for (const plane of tracked) expect(plane.altitudeM as number).toBeGreaterThanOrEqual(6000);
  });

  it("CA2 : computes the ground truth from the trace alone, closest point within 4 km and 300 s of lead", () => {
    const truth = groundTruth();
    expect(truth.closestDistanceKm).toBeLessThanOrEqual(4);
    expect(truth.entryMs).toBeLessThan(truth.closestTimeMs);
    expect(truth.entryMs - at(trace.samples, 0).atMs).toBeGreaterThanOrEqual(300_000);
    expect(at(trace.samples, trace.samples.length - 1).atMs).toBeGreaterThan(truth.closestTimeMs);
  });

  it("CA3 : forecasts the window entry within 10 s at 60 s, 120 s and 300 s ahead", async () => {
    const { computeScene } = await load<SceneModule>("src/shared/scene/index.ts");
    const { createFakeClock } = await load<ClockModule>("src/shared/clock/fake.ts");
    const { entryMs } = groundTruth();
    for (const aheadMs of [60_000, 120_000, 300_000]) {
      const sample = lastSampleAtOrBefore(entryMs - aheadMs);
      const clock = createFakeClock(sample.atMs);
      const scene = computeScene({
        snapshot: { aircraft: sample.aircraft, takenAtMs: sample.atMs },
        observer: trace.observer,
        nowMs: clock.now(),
        previousOverheadHex: null,
      });
      const passage = scene.upcoming.find((entry) => entry.hex === trace.trackedHex);
      expect(passage).toBeDefined();
      expect(Math.abs((passage as Passage).passageTimeMs - entryMs)).toBeLessThanOrEqual(TOLERANCE_MS);
    }
  });

  it("CA4 : the tracked aircraft becomes the overhead within 10 s of the real entry, with no negative countdown", async () => {
    const { entryMs } = groundTruth();
    const steps = await replay(entryMs - 300_000, entryMs + 60_000);
    const firstOverhead = steps.find((step) => step.scene.overhead?.hex === trace.trackedHex);
    expect(firstOverhead).toBeDefined();
    const firstMs = (firstOverhead as ReplayStep).nowMs;
    expect(Math.abs(firstMs - entryMs)).toBeLessThanOrEqual(TOLERANCE_MS);
    for (const step of steps) {
      const upcoming = step.scene.upcoming.find((entry) => entry.hex === trace.trackedHex);
      if (upcoming) expect(upcoming.passageTimeMs - step.nowMs).toBeGreaterThan(0);
      if (step.nowMs >= firstMs) expect(step.scene.overhead?.hex).toBe(trace.trackedHex);
    }
  });

  it("CA5 : is deterministic and never reads the real clock", async () => {
    const { entryMs } = groundTruth();
    const dateNow = vi.spyOn(Date, "now");
    const first = await replay(entryMs - 120_000, entryMs + 30_000);
    const second = await replay(entryMs - 120_000, entryMs + 30_000);
    expect(second).toEqual(first);
    expect(dateNow).not.toHaveBeenCalled();
  });
});

describe.skip("SPEC-0011 Parcours critique : fiche de preuve sur iPhone réel", () => {
  const field = (text: string, name: string): string | undefined => {
    const line = text.split("\n").find((entry) => entry.startsWith(`- **${name}** :`));
    return line?.slice(line.indexOf(":") + 1).trim();
  };

  it("CA6 : the proof sheet is filled with a measure b within 15 s and every check at yes", () => {
    const text = fs.readFileSync(PROOF_FILE, "utf8");
    const names = [
      "Date",
      "Appareil",
      "Release",
      "Mesure b (s)",
      "Flèche qui suit le téléphone",
      "Défilement fluide des comptes à rebours",
      "Session visible dans Sentry pour la release",
      "Lien Sentry",
      "Mentions du propriétaire présentes",
      "Écarts au handoff",
    ];
    for (const name of names) {
      const value = field(text, name);
      expect(value, name).toBeDefined();
      expect(value, name).not.toBe("");
      expect(value, name).not.toContain("À REMPLIR");
    }
    const measureB = Number((field(text, "Mesure b (s)") as string).replace(",", "."));
    expect(Number.isFinite(measureB)).toBe(true);
    expect(measureB).toBeGreaterThanOrEqual(0);
    expect(measureB).toBeLessThanOrEqual(15);
    for (const name of [
      "Flèche qui suit le téléphone",
      "Défilement fluide des comptes à rebours",
      "Session visible dans Sentry pour la release",
      "Mentions du propriétaire présentes",
    ]) {
      expect(field(text, name), name).toBe("oui");
    }
  });
});
