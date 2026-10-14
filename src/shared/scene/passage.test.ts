import { describe, expect, it } from "vitest";
import type { Aircraft } from "../adsb";
import { isUsable, predictPassage } from "./passage";

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER = { latitude: 0, longitude: 0 };
const T0 = 1_000_000;

// À l'équateur, 1 km vaut 1 / KM_PER_DEGREE degré dans les deux axes. 720 km/h = 0,2 km/s.
function plane(eastKm: number, northKm: number, trackDeg: number | null, speedKmh: number | null): Aircraft {
  return {
    hex: "abc123",
    callsign: "TST1",
    latitude: northKm / KM_PER_DEGREE,
    longitude: eastKm / KM_PER_DEGREE,
    altitudeM: 10_000,
    groundSpeedKmh: speedKmh,
    trackDeg,
  };
}

describe("isUsable", () => {
  it("accepts a moving aircraft with a known track", () => {
    expect(isUsable(plane(0, 0, 90, 720))).toBe(true);
  });

  it.each([
    ["null speed", null],
    ["zero speed", 0],
  ])("rejects %s", (_name, speed) => {
    expect(isUsable(plane(0, 0, 90, speed))).toBe(false);
  });

  it("rejects an unknown track", () => {
    expect(isUsable(plane(0, 0, null, 720))).toBe(false);
  });

  it.each([
    [0, false],
    [-5, false],
    [1, true],
    [null, true],
  ])("handles an altitude of %s", (altitudeM, expected) => {
    expect(isUsable({ ...plane(0, 0, 90, 720), altitudeM })).toBe(expected);
  });
});

describe("predictPassage", () => {
  it("computes the window of an aircraft flying over the observer", () => {
    const passage = predictPassage(plane(-20, 0, 90, 720), OBSERVER, T0, T0);
    expect(passage.closestDistanceKm).toBeCloseTo(0, 6);
    expect(passage.closestTimeMs).toBe(T0 + 100_000);
    expect(passage.passageTimeMs).toBe(T0 + 75_000);
    expect(passage.windowEndMs).toBe(T0 + 125_000);
    expect(passage.groundDistanceKm).toBeCloseTo(20, 6);
    expect(passage.arrivalBearingDeg).toBeCloseTo(270, 6);
    expect(passage.arrivalCardinal).toBe("O");
    expect(passage.trackCardinal).toBe("E");
  });

  it("measures the distance of an aircraft passing beside the observer", () => {
    const passage = predictPassage(plane(-20, 3, 90, 720), OBSERVER, T0, T0);
    expect(passage.closestDistanceKm).toBeCloseTo(3, 6);
  });

  it("moves away when the aircraft is leaving", () => {
    const passage = predictPassage(plane(20, 0, 90, 720), OBSERVER, T0, T0);
    expect(passage.closestTimeMs).toBe(T0 - 100_000);
    expect(passage.windowEndMs).toBe(T0 - 75_000);
  });

  it("extrapolates backwards when now is before the snapshot", () => {
    const passage = predictPassage(plane(-20, 0, 90, 720), OBSERVER, T0, T0 - 50_000);
    expect(passage.groundDistanceKm).toBeCloseTo(30, 6);
  });

  it("treats a track of 360 as 0", () => {
    const passage = predictPassage(plane(0, -30, 360, 720), OBSERVER, T0, T0);
    expect(passage.trackDeg).toBe(0);
    expect(passage.trackCardinal).toBe("N");
    expect(passage.arrivalBearingDeg).toBeCloseTo(180, 6);
  });

  it("rounds times to the millisecond", () => {
    // 20 km à 700 km/h : 102 857,14... ms.
    const passage = predictPassage(plane(-20, 0, 90, 700), OBSERVER, T0, T0);
    expect(passage.closestTimeMs).toBe(T0 + 102_857);
    expect(Number.isInteger(passage.passageTimeMs)).toBe(true);
    expect(Number.isInteger(passage.windowEndMs)).toBe(true);
  });

  it("keeps the fields taken from the aircraft", () => {
    const passage = predictPassage(plane(-20, 0, 90, 720), OBSERVER, T0, T0);
    expect(passage).toMatchObject({ hex: "abc123", callsign: "TST1", altitudeM: 10_000, groundSpeedKmh: 720 });
  });
});
