import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AdsbSource, Aircraft } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import type { Position } from "../../src/shared/location";

// Contrat de SPEC-0006 (Vitest) : logique pure du carrousel Prochains passages et source de démonstration.
// L'écran est joué par SPEC-0006.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés par chemin, avec les types du contrat recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
interface Passage {
  hex: string;
  callsign: string | null;
  altitudeM: number | null;
  groundSpeedKmh: number;
  trackDeg: number;
  trackCardinal: CardinalPoint;
  passageTimeMs: number;
  closestTimeMs: number;
  windowEndMs: number;
  closestDistanceKm: number;
  groundDistanceKm: number;
  arrivalBearingDeg: number;
  arrivalCardinal: CardinalPoint;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
interface Airline {
  code: string;
  name: string;
  iata: readonly string[];
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
  track: string;
}
interface PassageCard {
  kind: "overhead" | "upcoming";
  hex: string;
  airline: Airline;
  theme: AirlineTheme;
  airlineName: string;
  flightLabel: string;
  aircraftType: string;
  altitude: string;
  speed: string;
  cardinal: CardinalPoint;
  arrowAngleDeg: number | null;
  countdown: string | null;
  passTime: string | null;
  visibility: { progress: number; remaining: string } | null;
}
interface PassagesModule {
  PASSAGES_METRICS: {
    cardHeightPt: number;
    gapPt: number;
    snapIntervalPt: number;
    marginHorizontalPt: number;
    cardRadiusPt: number;
    paddingTopPt: number;
    paddingBottomPt: number;
  };
  formatCountdown(remainingMs: number): string;
  formatLocalTime(timestampMs: number, timeZone: string): string;
  visibilityProgress(passage: Pick<Passage, "passageTimeMs" | "windowEndMs">, nowMs: number): number;
  visibilityRemainingMs(passage: Pick<Passage, "passageTimeMs" | "windowEndMs">, nowMs: number): number;
  formatMetric(value: number | null): string;
  flightLabel(callsign: string | null, airline: Airline): string;
  buildCards(input: { scene: Scene; nowMs: number; headingDeg: number | null; timeZone: string }): PassageCard[];
}
interface AirlinesModule {
  UNKNOWN_AIRLINE: Airline;
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): AirlineTheme;
}
interface SceneModule {
  computeScene(input: {
    snapshot: { aircraft: readonly Aircraft[]; takenAtMs: number };
    observer: Position;
    nowMs: number;
    previousOverheadHex: string | null;
  }): Scene;
  groundDistanceKm(a: Position, b: Position): number;
}
interface DemoModule {
  createDemoAdsbSource(clock: { now(): number }): AdsbSource;
}
const passages = () => load<PassagesModule>("src/features/passages/service.ts");
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");
const sceneModule = () => load<SceneModule>("src/shared/scene/index.ts");
const demoModule = () => load<DemoModule>("src/shared/adsb/demo.ts");

const NOW = 1_800_000_000_000; // 2027-01-15T08:00:00Z, soit 09:00:00 à Paris
const SECOND = 1000;
const NBSP = " ";

function passage(hex: string, callsign: string | null, overrides: Partial<Passage> = {}): Passage {
  return {
    hex,
    callsign,
    altitudeM: 10_000,
    groundSpeedKmh: 720,
    trackDeg: 90,
    trackCardinal: "E",
    passageTimeMs: NOW + 175 * SECOND,
    closestTimeMs: NOW + 200 * SECOND,
    windowEndMs: NOW + 225 * SECOND,
    closestDistanceKm: 1,
    groundDistanceKm: 40,
    arrivalBearingDeg: 270,
    arrivalCardinal: "O",
    ...overrides,
  };
}

describe.skip("SPEC-0006 logique du carrousel Prochains passages", () => {
  it("CA1 : exposes the handoff measures", async () => {
    const { PASSAGES_METRICS } = await passages();
    expect(PASSAGES_METRICS).toEqual({
      cardHeightPt: 650,
      gapPt: 12,
      snapIntervalPt: 662,
      marginHorizontalPt: 12,
      cardRadiusPt: 36,
      paddingTopPt: 100,
      paddingBottomPt: 200,
    });
  });

  it("CA2 : formats the countdown as MM:SS, rounded up to the next second", async () => {
    const { formatCountdown } = await passages();
    expect(formatCountdown(134_000)).toBe("02:14");
    expect(formatCountdown(133_001)).toBe("02:14");
    expect(formatCountdown(133_000)).toBe("02:13");
    expect(formatCountdown(1)).toBe("00:01");
    expect(formatCountdown(59_000)).toBe("00:59");
    expect(formatCountdown(60_000)).toBe("01:00");
    expect(formatCountdown(3_599_000)).toBe("59:59");
  });

  it("CA2 : never shows a negative countdown and does not cap the minutes", async () => {
    const { formatCountdown } = await passages();
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-500)).toBe("00:00");
    expect(formatCountdown(-3_600_000)).toBe("00:00");
    expect(formatCountdown(6_000_000)).toBe("100:00");
  });

  it("CA3 : formats the local time as HH:MM on 24 hours, in the given time zone", async () => {
    const { formatLocalTime } = await passages();
    expect(formatLocalTime(NOW, "Europe/Paris")).toBe("09:00");
    expect(formatLocalTime(NOW, "Pacific/Auckland")).toBe("21:00");
    expect(formatLocalTime(NOW, "Asia/Kolkata")).toBe("13:30");
    expect(formatLocalTime(NOW, "UTC")).toBe("08:00");
  });

  it("CA3 : truncates the seconds and keeps the leading zeros", async () => {
    const { formatLocalTime } = await passages();
    expect(formatLocalTime(NOW + 59_999, "Europe/Paris")).toBe("09:00");
    expect(formatLocalTime(NOW + 60_000, "Europe/Paris")).toBe("09:01");
    expect(formatLocalTime(NOW - 8 * 3_600_000 + 5 * 60_000, "UTC")).toBe("00:05");
  });

  it("CA4 : computes the visibility progress between the window entry and its end, bounded to [0, 1]", async () => {
    const { visibilityProgress } = await passages();
    const window = { passageTimeMs: NOW, windowEndMs: NOW + 50 * SECOND };
    expect(visibilityProgress(window, NOW)).toBe(0);
    expect(visibilityProgress(window, NOW + 10 * SECOND)).toBeCloseTo(0.2, 10);
    expect(visibilityProgress(window, NOW + 25 * SECOND)).toBeCloseTo(0.5, 10);
    expect(visibilityProgress(window, NOW + 50 * SECOND)).toBe(1);
    expect(visibilityProgress(window, NOW + 80 * SECOND)).toBe(1);
    expect(visibilityProgress(window, NOW - 5 * SECOND)).toBe(0);
  });

  it("CA4 : a window of zero length is complete once it has started, and not started before", async () => {
    const { visibilityProgress } = await passages();
    const empty = { passageTimeMs: NOW, windowEndMs: NOW };
    expect(visibilityProgress(empty, NOW - 1)).toBe(0);
    expect(visibilityProgress(empty, NOW)).toBe(1);
    expect(visibilityProgress(empty, NOW + 1)).toBe(1);
  });

  it("CA4 : computes the remaining visibility, never below zero", async () => {
    const { visibilityRemainingMs } = await passages();
    const window = { passageTimeMs: NOW, windowEndMs: NOW + 50 * SECOND };
    expect(visibilityRemainingMs(window, NOW + 10 * SECOND)).toBe(40 * SECOND);
    expect(visibilityRemainingMs(window, NOW + 50 * SECOND)).toBe(0);
    expect(visibilityRemainingMs(window, NOW + 70 * SECOND)).toBe(0);
  });

  it("CA5 : formats the metrics as rounded integers with a no-break space for thousands", async () => {
    const { formatMetric } = await passages();
    expect(formatMetric(7850)).toBe(`7${NBSP}850`);
    expect(formatMetric(779.6)).toBe("780");
    expect(formatMetric(0)).toBe("0");
    expect(formatMetric(999)).toBe("999");
    expect(formatMetric(1234567)).toBe(`1${NBSP}234${NBSP}567`);
  });

  it("CA5 : shows a dash when the value is unknown", async () => {
    const { formatMetric } = await passages();
    expect(formatMetric(null)).toBe("—");
  });

  it("CA6 : writes the flight in IATA form by replacing the ICAO prefix", async () => {
    const { flightLabel } = await passages();
    const { resolveAirline } = await airlines();
    expect(flightLabel("AFR1506", resolveAirline("AFR1506"))).toBe("AF1506");
    expect(flightLabel(" afr1506 ", resolveAirline("AFR1506"))).toBe("AF1506");
    expect(flightLabel("RUK7KM", resolveAirline("RUK7KM"))).toBe("FR7KM");
    expect(flightLabel("IBE3457", resolveAirline("IBE3457"))).toBe("IB3457");
  });

  it("CA6 : keeps any other callsign as is, and shows a dash when there is none", async () => {
    const { flightLabel } = await passages();
    const { resolveAirline, UNKNOWN_AIRLINE } = await airlines();
    expect(flightLabel("AF1506", resolveAirline("AF1506"))).toBe("AF1506");
    expect(flightLabel("ZZZ123", UNKNOWN_AIRLINE)).toBe("ZZZ123");
    expect(flightLabel("F-HBXA", UNKNOWN_AIRLINE)).toBe("F-HBXA");
    // Seuls les blancs de début et de fin sont retirés : `AFR 1506` reste inconnu (SPEC-0002 CA8).
    expect(flightLabel("AFR 1506", UNKNOWN_AIRLINE)).toBe("AFR 1506");
    expect(flightLabel(null, UNKNOWN_AIRLINE)).toBe("—");
    expect(flightLabel("", UNKNOWN_AIRLINE)).toBe("—");
  });

  it("CA7 : puts the overhead card first, then one upcoming card per passage in the scene order", async () => {
    const { buildCards } = await passages();
    const scene: Scene = {
      overhead: passage("h1", "IBE3457", { passageTimeMs: NOW - 10 * SECOND, windowEndMs: NOW + 40 * SECOND }),
      upcoming: [
        passage("b2", "AFR1506", { passageTimeMs: NOW + 134 * SECOND }),
        passage("a1", "RYR9", { passageTimeMs: NOW + 134 * SECOND }),
        passage("c3", null, { passageTimeMs: NOW + 300 * SECOND }),
      ],
    };
    const cards = buildCards({ scene, nowMs: NOW, headingDeg: null, timeZone: "Europe/Paris" });
    expect(cards.map((card) => [card.kind, card.hex])).toEqual([
      ["overhead", "h1"],
      ["upcoming", "b2"],
      ["upcoming", "a1"],
      ["upcoming", "c3"],
    ]);
  });

  it("CA7 : without overhead the first card is the first upcoming one, and an empty scene gives no card", async () => {
    const { buildCards } = await passages();
    const upcoming = [passage("a1", "AFR1506")];
    expect(
      buildCards({ scene: { overhead: null, upcoming }, nowMs: NOW, headingDeg: null, timeZone: "UTC" }).map(
        (card) => card.kind,
      ),
    ).toEqual(["upcoming"]);
    expect(
      buildCards({ scene: { overhead: null, upcoming: [] }, nowMs: NOW, headingDeg: 12, timeZone: "UTC" }),
    ).toEqual([]);
  });

  it("CA7 : carries the airline, its theme, the labels and the formatted metrics on every card", async () => {
    const { buildCards } = await passages();
    const { resolveAirline, airlineTheme, UNKNOWN_AIRLINE } = await airlines();
    const scene: Scene = {
      overhead: null,
      upcoming: [
        passage("a1", "AFR1506", { altitudeM: 7850, groundSpeedKmh: 779.6 }),
        passage("c3", null, { altitudeM: null, groundSpeedKmh: 720 }),
      ],
    };
    const [first, second] = buildCards({ scene, nowMs: NOW, headingDeg: null, timeZone: "Europe/Paris" });
    const airFrance = resolveAirline("AFR1506");
    expect(first?.airline).toBe(airFrance);
    expect(first?.theme).toEqual(airlineTheme(airFrance));
    expect(first?.airlineName).toBe(airFrance.name);
    expect(first?.flightLabel).toBe("AF1506");
    expect(first?.aircraftType).toBe("—");
    expect(first?.altitude).toBe(`7${NBSP}850`);
    expect(first?.speed).toBe("780");
    expect(second?.airline).toBe(UNKNOWN_AIRLINE);
    expect(second?.airlineName).toBe(UNKNOWN_AIRLINE.name);
    expect(second?.flightLabel).toBe("—");
    expect(second?.altitude).toBe("—");
    expect(second?.speed).toBe("720");
  });

  it("CA8 : an upcoming card carries the countdown, the local passage time, the arrival direction and the arrow angle", async () => {
    const { buildCards } = await passages();
    const scene: Scene = {
      overhead: null,
      upcoming: [
        passage("a1", "AFR1506", {
          passageTimeMs: NOW + 134 * SECOND,
          arrivalBearingDeg: 200,
          arrivalCardinal: "S",
        }),
      ],
    };
    const [card] = buildCards({ scene, nowMs: NOW, headingDeg: 30, timeZone: "Europe/Paris" });
    expect(card?.kind).toBe("upcoming");
    expect(card?.countdown).toBe("02:14");
    expect(card?.passTime).toBe("09:02");
    expect(card?.cardinal).toBe("S");
    expect(card?.arrowAngleDeg).toBe(170);
    expect(card?.visibility).toBeNull();
  });

  it("CA8 : the arrow angle wraps into [0, 360) and is null when the phone heading is unknown", async () => {
    const { buildCards } = await passages();
    const scene: Scene = { overhead: null, upcoming: [passage("a1", "AFR1506", { arrivalBearingDeg: 20 })] };
    const wrapped = buildCards({ scene, nowMs: NOW, headingDeg: 50, timeZone: "UTC" });
    expect(wrapped[0]?.arrowAngleDeg).toBe(330);
    const unknown = buildCards({ scene, nowMs: NOW, headingDeg: null, timeZone: "UTC" });
    expect(unknown[0]?.arrowAngleDeg).toBeNull();
    expect(unknown[0]?.cardinal).toBe("O");
  });

  it("CA8 : the overhead card carries the heading cardinal, the arrow toward the track and the visibility, without countdown", async () => {
    const { buildCards } = await passages();
    const scene: Scene = {
      overhead: passage("h1", "IBE3457", {
        trackDeg: 150,
        trackCardinal: "SE",
        passageTimeMs: NOW - 10 * SECOND,
        windowEndMs: NOW + 40 * SECOND,
        arrivalBearingDeg: 10,
        arrivalCardinal: "N",
      }),
      upcoming: [],
    };
    const [card] = buildCards({ scene, nowMs: NOW, headingDeg: 30, timeZone: "UTC" });
    expect(card?.kind).toBe("overhead");
    expect(card?.cardinal).toBe("SE");
    expect(card?.arrowAngleDeg).toBe(120);
    expect(card?.countdown).toBeNull();
    expect(card?.passTime).toBeNull();
    expect(card?.visibility?.progress).toBeCloseTo(0.2, 10);
    expect(card?.visibility?.remaining).toBe("00:40");
  });
});

describe.skip("SPEC-0006 source de démonstration", () => {
  const POSITION: Position = { latitude: 45.764, longitude: 4.836 };
  const QUERY = { ...POSITION, radiusKm: 80 };

  it("CA9 : is not exported by the public adsb entry point, so it stays out of delivered builds", async () => {
    const entry = await load<Record<string, unknown>>("src/shared/adsb/index.ts");
    expect(entry).not.toHaveProperty("createDemoAdsbSource");
  });

  it("CA9 : answers the same list at the same time and a different one when the clock advances", async () => {
    const { createDemoAdsbSource } = await demoModule();
    const clock = createFakeClock(NOW);
    const source = createDemoAdsbSource(clock);
    const first = await source.fetchAircraft(QUERY);
    const again = await source.fetchAircraft(QUERY);
    expect(again).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    clock.advance(30 * SECOND);
    const later = await source.fetchAircraft(QUERY);
    expect(later).not.toEqual(first);
  });

  it("CA9 : only returns moving aircraft with distinct hex, inside the radius", async () => {
    const { createDemoAdsbSource } = await demoModule();
    const { groundDistanceKm } = await sceneModule();
    const clock = createFakeClock(NOW);
    const source = createDemoAdsbSource(clock);
    for (let step = 0; step < 30; step += 1) {
      const aircraft = await source.fetchAircraft(QUERY);
      expect(new Set(aircraft.map((plane) => plane.hex)).size).toBe(aircraft.length);
      for (const plane of aircraft) {
        expect(groundDistanceKm(POSITION, plane)).toBeLessThanOrEqual(QUERY.radiusKm);
        expect(plane.groundSpeedKmh).not.toBeNull();
        expect(plane.groundSpeedKmh as number).toBeGreaterThan(0);
        expect(plane.trackDeg).not.toBeNull();
        expect(plane.altitudeM).not.toBeNull();
        expect(plane.altitudeM as number).toBeGreaterThan(0);
      }
      clock.advance(10 * SECOND);
    }
  });

  it("CA9 : always forecasts at least 3 passages and has an overhead aircraft at some point in 20 minutes", async () => {
    const { createDemoAdsbSource } = await demoModule();
    const { computeScene } = await sceneModule();
    const clock = createFakeClock(NOW + 123_456);
    const source = createDemoAdsbSource(clock);
    let overheadSeen = 0;
    let previousOverheadHex: string | null = null;
    for (let step = 0; step < 120; step += 1) {
      const nowMs = clock.now();
      const aircraft = await source.fetchAircraft(QUERY);
      const scene = computeScene({
        snapshot: { aircraft, takenAtMs: nowMs },
        observer: POSITION,
        nowMs,
        previousOverheadHex,
      });
      expect(scene.upcoming.length).toBeGreaterThanOrEqual(3);
      if (scene.overhead !== null) overheadSeen += 1;
      previousOverheadHex = scene.overhead?.hex ?? null;
      clock.advance(10 * SECOND);
    }
    expect(overheadSeen).toBeGreaterThan(0);
  });

  it("CA9 : uses callsigns of at least three known airlines and at least one unknown airline", async () => {
    const { createDemoAdsbSource } = await demoModule();
    const { resolveAirline, UNKNOWN_AIRLINE } = await airlines();
    const clock = createFakeClock(NOW);
    const source = createDemoAdsbSource(clock);
    const seen = new Set<string>();
    let unknownSeen = false;
    for (let step = 0; step < 60; step += 1) {
      for (const plane of await source.fetchAircraft(QUERY)) {
        const airline = resolveAirline(plane.callsign);
        if (airline === UNKNOWN_AIRLINE) unknownSeen = true;
        else seen.add(airline.code);
      }
      clock.advance(10 * SECOND);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(unknownSeen).toBe(true);
  });
});
