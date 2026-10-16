import { describe, expect, it } from "vitest";
import { createFakeClock, formatClockTime } from "./index";
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

describe("formatClockTime", () => {
  it("formats the local time on 24 hours in the given time zone", () => {
    expect(formatClockTime(1_800_000_000_000, "Europe/Paris")).toBe("09:00");
    expect(formatClockTime(1_800_000_000_000, "Pacific/Auckland")).toBe("21:00");
  });

  it("keeps the leading zeros and truncates the seconds", () => {
    expect(formatClockTime(Date.UTC(2027, 0, 1, 0, 5, 59), "UTC")).toBe("00:05");
  });
});
