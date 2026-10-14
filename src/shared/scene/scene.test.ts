import { describe, expect, it } from "vitest";
import type { Aircraft } from "../adsb";
import { computeScene } from "./scene";

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER = { latitude: 0, longitude: 0 };
const T0 = 1_000_000;

// Avion à 720 km/h (0,2 km/s) cap est : fenêtre de 50 s autour du point le plus proche.
function plane(hex: string, eastKm: number, northKm = 0, overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex,
    callsign: hex.toUpperCase(),
    latitude: northKm / KM_PER_DEGREE,
    longitude: eastKm / KM_PER_DEGREE,
    altitudeM: 10_000,
    groundSpeedKmh: 720,
    trackDeg: 90,
    ...overrides,
  };
}

function compute(aircraft: Aircraft[], nowMs = T0, previousOverheadHex: string | null = null) {
  return computeScene({ snapshot: { aircraft, takenAtMs: T0 }, observer: OBSERVER, nowMs, previousOverheadHex });
}

describe("computeScene", () => {
  it("returns an empty scene for an empty snapshot", () => {
    expect(compute([])).toEqual({ overhead: null, upcoming: [] });
  });

  it("keeps a passage at exactly 4 km and drops one beyond", () => {
    const result = compute([plane("a1", -20, 4), plane("b2", -20, 4.01)]);
    expect(result.upcoming.map((p) => p.hex)).toEqual(["a1"]);
  });

  it("keeps an aircraft at exactly 80 km and drops one beyond", () => {
    const result = compute([plane("a1", -80), plane("b2", -80.01)]);
    expect(result.upcoming.map((p) => p.hex)).toEqual(["a1"]);
  });

  it("drops an aircraft whose window ends exactly now", () => {
    // Point le plus proche à T0 - 25 s : la fenêtre se termine à T0.
    const result = compute([plane("a1", 5)]);
    expect(result).toEqual({ overhead: null, upcoming: [] });
  });

  it("makes an aircraft overhead when its passage time equals now", () => {
    // Entrée dans la fenêtre à T0 : plane à 5 km à l'ouest du point le plus proche.
    const result = compute([plane("a1", -5)]);
    expect(result.overhead?.hex).toBe("a1");
    expect(result.upcoming).toEqual([]);
  });

  it("ignores usable-looking duplicates after the first occurrence, even if the first is unusable", () => {
    const result = compute([plane("a1", -20, 0, { groundSpeedKmh: 0 }), plane("a1", -20)]);
    expect(result.upcoming).toEqual([]);
  });

  it("keeps the first occurrence of a duplicated hex", () => {
    const result = compute([plane("a1", -20), plane("a1", -40)]);
    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]?.groundDistanceKm).toBeCloseTo(20, 6);
  });

  it("sorts equal passage times by hex", () => {
    const result = compute([plane("b2", -20), plane("a1", -20)]);
    expect(result.upcoming.map((p) => p.hex)).toEqual(["a1", "b2"]);
  });

  it("sorts by passage time first", () => {
    const result = compute([plane("a1", -40), plane("b2", -20)]);
    expect(result.upcoming.map((p) => p.hex)).toEqual(["b2", "a1"]);
  });

  it("keeps only 10 upcoming passages", () => {
    const aircraft = Array.from({ length: 12 }, (_, i) => plane(`h${String(i).padStart(2, "0")}`, -10 - i));
    const result = compute(aircraft);
    expect(result.upcoming).toHaveLength(10);
    expect(result.upcoming[0]?.hex).toBe("h00");
    expect(result.upcoming.map((p) => p.hex)).not.toContain("h11");
  });

  it("picks the closest aircraft as overhead, then the smallest hex on a tie", () => {
    // Fenêtres en cours, tous au point le plus proche à ≤ 4 km.
    const closer = compute([plane("a1", -3, 1), plane("b2", -1, 1)]);
    expect(closer.overhead?.hex).toBe("b2");
    const tie = compute([plane("b2", -2, 1), plane("a1", -2, 1)]);
    expect(tie.overhead?.hex).toBe("a1");
  });

  it("does not make overhead an aircraft in its window passing beyond 4 km", () => {
    const result = compute([plane("a1", -1, 4.5)]);
    expect(result).toEqual({ overhead: null, upcoming: [] });
  });

  it("keeps the previous overhead beyond 4 km while its window lasts", () => {
    // Fenêtre en cours, point le plus proche à 4,5 km.
    const result = compute([plane("a1", -1, 4.5), plane("b2", -1, 1)], T0, "a1");
    expect(result.overhead?.hex).toBe("a1");
    expect(result.upcoming).toEqual([]);
  });

  it("keeps the previous overhead beyond 80 km while its window lasts", () => {
    // Point le plus proche à 85 km, fenêtre en cours à T0 : distance au sol > 80 km.
    const far = plane("a1", -1, 85);
    expect(compute([far], T0, null).overhead).toBeNull();
    expect(compute([far], T0, "a1").overhead?.hex).toBe("a1");
  });

  it("falls back to entry rules when the previous overhead is absent", () => {
    const result = compute([plane("b2", -1, 1)], T0, "zz");
    expect(result.overhead?.hex).toBe("b2");
  });

  it("falls back to entry rules when the previous overhead became unusable", () => {
    const result = compute([plane("a1", -1, 1, { groundSpeedKmh: 0 }), plane("b2", -2, 2)], T0, "a1");
    expect(result.overhead?.hex).toBe("b2");
  });

  it("does not hold a previous overhead that has not entered its window yet", () => {
    const result = compute([plane("a1", -20), plane("b2", -1, 1)], T0, "a1");
    expect(result.overhead?.hex).toBe("b2");
    expect(result.upcoming.map((p) => p.hex)).toEqual(["a1"]);
  });
});
