import { describe, expect, it } from "vitest";
import { arrowAngleDeg, bearingDeg, cardinalPoint, groundDistanceKm, normalizeDeg } from "./geo";

const ORIGIN = { latitude: 48, longitude: 2 };

describe("normalizeDeg", () => {
  it.each([
    [0, 0],
    [360, 0],
    [720, 0],
    [-10, 350],
    [-360, 0],
    [370, 10],
    [359.5, 359.5],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizeDeg(input)).toBe(expected);
  });

  it("never returns -0", () => {
    expect(Object.is(normalizeDeg(-0), 0)).toBe(true);
    expect(Object.is(normalizeDeg(-360), 0)).toBe(true);
  });

  it("never returns 360 for a tiny negative angle", () => {
    expect(normalizeDeg(-1e-15)).toBeLessThan(360);
  });
});

describe("cardinalPoint", () => {
  it.each([
    [0, "N"],
    [22.4999, "N"],
    [22.5, "NE"],
    [67.4999, "NE"],
    [67.5, "E"],
    [112.5, "SE"],
    [157.5, "S"],
    [202.5, "SO"],
    [247.5, "O"],
    [292.5, "NO"],
    [337.4999, "NO"],
    [337.5, "N"],
    [360, "N"],
    [-10, "N"],
    [720, "N"],
  ])("maps %s to %s", (deg, expected) => {
    expect(cardinalPoint(deg)).toBe(expected);
  });
});

describe("arrowAngleDeg", () => {
  it("returns null when the heading is unknown", () => {
    expect(arrowAngleDeg(90, null)).toBeNull();
  });

  it("subtracts the heading and wraps into [0, 360)", () => {
    expect(arrowAngleDeg(10, 350)).toBe(20);
    expect(arrowAngleDeg(350, 10)).toBe(340);
  });

  it("never returns -0 or 360", () => {
    expect(Object.is(arrowAngleDeg(90, 90), 0)).toBe(true);
    expect(arrowAngleDeg(0, 360)).toBe(0);
    expect(arrowAngleDeg(360, 0)).toBe(0);
  });
});

describe("groundDistanceKm", () => {
  it("is zero for identical positions", () => {
    expect(groundDistanceKm(ORIGIN, ORIGIN)).toBe(0);
  });

  it("is symmetric", () => {
    const other = { latitude: 48.5, longitude: 3 };
    expect(groundDistanceKm(ORIGIN, other)).toBeCloseTo(groundDistanceKm(other, ORIGIN), 9);
  });

  it("gives about 111.19 km per degree of latitude", () => {
    const north = { latitude: 49, longitude: 2 };
    expect(groundDistanceKm(ORIGIN, north)).toBeCloseTo(111.195, 2);
  });
});

describe("bearingDeg", () => {
  it.each([
    ["north", { latitude: 49, longitude: 2 }, 0],
    ["east", { latitude: 48, longitude: 3 }, 90],
    ["south", { latitude: 47, longitude: 2 }, 180],
    ["west", { latitude: 48, longitude: 1 }, 270],
  ])("gives the bearing to the %s", (_name, target, expected) => {
    expect(bearingDeg(ORIGIN, target)).toBeCloseTo(expected, 0);
  });

  it("stays within [0, 360)", () => {
    const value = bearingDeg(ORIGIN, { latitude: 48.0001, longitude: 1.99 });
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(360);
  });
});
