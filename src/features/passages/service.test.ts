import { describe, expect, it } from "vitest";
import type { Passage, SceneState } from "../../shared/scene";
import { buildCards, cardsOf, formatCountdown, formatLocalTime, gaugePercent } from "./service";

const NOW_MS = 1_800_000_000_000;

function passage(overrides: Partial<Passage> = {}): Passage {
  return {
    hex: "abc123",
    callsign: "AFR1506",
    altitudeM: 7850,
    groundSpeedKmh: 779.6,
    trackDeg: 90,
    trackCardinal: "E",
    passageTimeMs: NOW_MS + 134_000,
    closestTimeMs: NOW_MS + 150_000,
    windowEndMs: NOW_MS + 200_000,
    closestDistanceKm: 1,
    groundDistanceKm: 10,
    arrivalBearingDeg: 270,
    arrivalCardinal: "O",
    ...overrides,
  };
}

describe("formatCountdown", () => {
  it("rounds up to the next second", () => {
    expect(formatCountdown(134_000)).toBe("02:14");
    expect(formatCountdown(133_001)).toBe("02:14");
    expect(formatCountdown(133_000)).toBe("02:13");
    expect(formatCountdown(1)).toBe("00:01");
  });

  it("returns 00:00 for zero, negative zero and negative values", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-0)).toBe("00:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });

  it("rounds a sub-second remainder up to one second", () => {
    expect(formatCountdown(0.4)).toBe("00:01");
  });

  it("does not cap the minutes", () => {
    expect(formatCountdown(6_000_000)).toBe("100:00");
  });
});

describe("formatLocalTime", () => {
  it("formats in the given time zone", () => {
    expect(formatLocalTime(1_800_000_000_000, "Europe/Paris")).toBe("09:00");
    expect(formatLocalTime(1_800_000_000_000, "Pacific/Auckland")).toBe("21:00");
    expect(formatLocalTime(1_800_000_000_000, "Asia/Kolkata")).toBe("13:30");
  });

  it("truncates the seconds", () => {
    expect(formatLocalTime(1_800_000_059_999, "Europe/Paris")).toBe("09:00");
  });

  it("renders midnight as 00:xx, never 24:xx", () => {
    // 2026-12-31T23:30:00Z est 00:30 à Paris.
    expect(formatLocalTime(Date.UTC(2026, 11, 31, 23, 30), "Europe/Paris")).toBe("00:30");
  });
});

describe("gaugePercent", () => {
  it("rounds the progress to a whole percentage", () => {
    expect(gaugePercent(0)).toBe(0);
    expect(gaugePercent(0.005)).toBe(1);
    expect(gaugePercent(1)).toBe(100);
  });
});

describe("buildCards", () => {
  it("returns no card for an empty scene", () => {
    const scene = { overhead: null, upcoming: [] };
    expect(buildCards({ scene, nowMs: NOW_MS, headingDeg: null, timeZone: "Europe/Paris" })).toEqual([]);
  });

  it("puts the overhead card first, then the upcoming ones in order", () => {
    const scene = {
      overhead: passage({ hex: "over" }),
      upcoming: [passage({ hex: "up1" }), passage({ hex: "up2" })],
    };
    const cards = buildCards({ scene, nowMs: NOW_MS, headingDeg: null, timeZone: "Europe/Paris" });
    expect(cards.map((card) => [card.kind, card.hex])).toEqual([
      ["overhead", "over"],
      ["upcoming", "up1"],
      ["upcoming", "up2"],
    ]);
  });

  it("fills the upcoming card fields", () => {
    const scene = { overhead: null, upcoming: [passage()] };
    const [card] = buildCards({ scene, nowMs: NOW_MS, headingDeg: 0, timeZone: "Europe/Paris" });
    expect(card).toMatchObject({
      flightLabel: "AF1506",
      aircraftType: "—",
      altitude: "7 850",
      speed: "780",
      cardinal: "O",
      arrowAngleDeg: 270,
      countdown: "02:14",
      passTime: "09:02",
      visibility: null,
    });
  });

  it("fills the overhead card fields", () => {
    const scene = { overhead: passage({ passageTimeMs: NOW_MS - 50_000, windowEndMs: NOW_MS + 50_000 }), upcoming: [] };
    const [card] = buildCards({ scene, nowMs: NOW_MS, headingDeg: null, timeZone: "Europe/Paris" });
    expect(card).toMatchObject({
      kind: "overhead",
      cardinal: "E",
      arrowAngleDeg: null,
      countdown: null,
      passTime: null,
      visibility: { progress: 0.5, remaining: "00:50" },
    });
  });
});

describe("cardsOf", () => {
  const scene = { overhead: null, upcoming: [passage()] };
  const ready: SceneState = { status: "ready", scene, snapshotAtMs: NOW_MS, nowMs: NOW_MS };

  it("builds the cards of a ready scene", () => {
    expect(cardsOf({ state: ready, headingDeg: null }, "Europe/Paris")).toHaveLength(1);
  });

  it.each<SceneState>([{ status: "loading" }, { status: "denied" }, { status: "unavailable" }])(
    "returns no card for the $status status",
    (state) => {
      expect(cardsOf({ state, headingDeg: null }, "Europe/Paris")).toEqual([]);
    },
  );
});
