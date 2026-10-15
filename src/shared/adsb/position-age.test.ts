import { describe, expect, it } from "vitest";
import type { Aircraft } from "./index";
import { advanceBySeenPos } from "./position-age";

const base: Aircraft = {
  hex: "abc123",
  callsign: null,
  latitude: 48,
  longitude: 2,
  altitudeM: 10000,
  groundSpeedKmh: 360,
  trackDeg: 0,
};

describe("advanceBySeenPos", () => {
  it("moves a northbound aircraft north by speed times age", () => {
    // 360 km/h pendant 10 s = 1 km ≈ 0,008993° de latitude.
    const moved = advanceBySeenPos(base, 10);
    expect(moved?.latitude).toBeCloseTo(48 + 1 / 111.195, 5);
    expect(moved?.longitude).toBeCloseTo(2, 8);
  });

  it("corrects longitude by the cosine of the starting latitude", () => {
    const moved = advanceBySeenPos({ ...base, trackDeg: 90 }, 10);
    const expected = 1 / (111.195 * Math.cos((48 * Math.PI) / 180));
    expect(moved?.longitude).toBeCloseTo(2 + expected, 5);
    expect(moved?.latitude).toBeCloseTo(48, 6);
  });

  it("leaves the aircraft unchanged for zero age, zero speed or unknown track or speed", () => {
    expect(advanceBySeenPos(base, 0)).toEqual(base);
    expect(advanceBySeenPos({ ...base, groundSpeedKmh: 0 }, 10)).toEqual({ ...base, groundSpeedKmh: 0 });
    expect(advanceBySeenPos({ ...base, trackDeg: null }, 10)).toEqual({ ...base, trackDeg: null });
    expect(advanceBySeenPos({ ...base, groundSpeedKmh: null }, 10)).toEqual({ ...base, groundSpeedKmh: null });
  });

  it("wraps longitude across the antimeridian", () => {
    const moved = advanceBySeenPos({ ...base, latitude: 0, longitude: 179.99, trackDeg: 90 }, 100);
    expect(moved?.longitude).toBeLessThan(-179);
    expect(moved?.longitude).toBeGreaterThanOrEqual(-180);
  });

  it("keeps a longitude of exactly 180 when no displacement applies", () => {
    expect(advanceBySeenPos({ ...base, longitude: 180 }, 0)?.longitude).toBe(180);
  });

  it("discards an aircraft that moves away from a pole", () => {
    expect(advanceBySeenPos({ ...base, latitude: 90 }, 10)).toBeNull();
    expect(advanceBySeenPos({ ...base, latitude: -90, trackDeg: 180 }, 10)).toBeNull();
  });

  it("keeps an aircraft at a pole when it does not move", () => {
    const stopped = { ...base, latitude: 90, groundSpeedKmh: 0 };
    expect(advanceBySeenPos(stopped, 10)).toEqual(stopped);
    expect(advanceBySeenPos({ ...base, latitude: 90 }, 0)?.latitude).toBe(90);
  });

  it("discards an aircraft whose adjusted latitude leaves [-90, 90]", () => {
    expect(advanceBySeenPos({ ...base, latitude: 89.999, groundSpeedKmh: 3600 }, 10)).toBeNull();
  });
});
