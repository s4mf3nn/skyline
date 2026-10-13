import { describe, expect, it } from "vitest";
import { createFakeClock } from "./index";
import { createSystemClock } from "./system";

describe("fake clock", () => {
  it("returns the start time until it is advanced", () => {
    const clock = createFakeClock(1_000);
    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_000);
  });

  it("moves by the advanced duration, cumulatively", () => {
    const clock = createFakeClock(1_000);
    clock.advance(500);
    clock.advance(250);
    expect(clock.now()).toBe(1_750);
  });
});

describe("system clock", () => {
  it("returns a time between two readings of the real clock", () => {
    const before = Date.now();
    const now = createSystemClock().now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
