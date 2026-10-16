import { describe, expect, it } from "vitest";
import {
  estimateFlight,
  type FlightRoute,
  formatEstimatedArrival,
  formatRouteCities,
  formatRouteCodes,
  skyRouteView,
} from "./index";

const NOW = 1_800_000_000_000;
const KM_PER_DEGREE = (6371 * Math.PI) / 180;

// Tout sur un méridien : la distance vaut `Δlatitude × 111,195 km`.
const at = (northKm: number) => ({ latitude: 45 + northKm / KM_PER_DEGREE, longitude: 4.8 });
const route = (originKm: number, destinationKm: number): FlightRoute => ({
  origin: { iata: "LYS", city: "Lyon", ...at(originKm) },
  destination: { iata: "CDG", city: "Paris", ...at(destinationKm) },
});

describe("estimateFlight", () => {
  it("measures progress along the route, bounded to [0, 1]", () => {
    const base = { route: route(0, 480), groundSpeedKmh: 720, nowMs: NOW };
    expect(estimateFlight({ ...base, position: at(120) }).progress).toBeCloseTo(0.25, 3);
    expect(estimateFlight({ ...base, position: at(600) }).progress).toBe(1);
  });

  it("estimates the arrival from the remaining distance", () => {
    const { arrivalMs } = estimateFlight({ route: route(0, 484), position: at(121), groundSpeedKmh: 720, nowMs: NOW });
    expect(Math.abs((arrivalMs ?? 0) - (NOW + 1_815_000))).toBeLessThanOrEqual(1_000);
  });

  it("has no arrival without a usable speed and no progress for two close airports", () => {
    expect(
      estimateFlight({ route: route(0, 480), position: at(1), groundSpeedKmh: 0, nowMs: NOW }).arrivalMs,
    ).toBeNull();
    expect(
      estimateFlight({ route: route(0, 0.9), position: at(0.4), groundSpeedKmh: 720, nowMs: NOW }).progress,
    ).toBeNull();
  });

  it("has no estimate when the destination has no coordinates", () => {
    const lost: FlightRoute = {
      ...route(0, 480),
      destination: { iata: "CDG", city: "Paris", latitude: 49, longitude: null },
    };
    expect(estimateFlight({ route: lost, position: at(1), groundSpeedKmh: 720, nowMs: NOW })).toEqual({
      progress: null,
      arrivalMs: null,
    });
  });
});

describe("route formats", () => {
  it("formats codes and cities only when both ends are known", () => {
    const complete = route(0, 480);
    expect(formatRouteCodes(complete)).toEqual({ origin: "LYS", destination: "CDG" });
    expect(formatRouteCities(complete)).toBe("Lyon → Paris");
    const partial: FlightRoute = { ...complete, origin: { ...complete.origin, iata: null, city: null } };
    expect(formatRouteCodes(partial)).toBeNull();
    expect(formatRouteCities(partial)).toBeNull();
  });

  it("formats the estimated arrival in the given time zone", () => {
    expect(formatEstimatedArrival(1_800_000_000_000, "Europe/Paris")).toBe("~09:00");
    expect(formatEstimatedArrival(1_800_000_000_000, "Pacific/Auckland")).toBe("~21:00");
  });
});

describe("skyRouteView", () => {
  it("gathers codes, cities, arrival and rounded progress for the sky screen", () => {
    const view = skyRouteView({
      route: route(0, 484),
      position: at(121),
      groundSpeedKmh: 720,
      nowMs: NOW,
      timeZone: "UTC",
    });
    expect(view.codes).toEqual({ origin: "LYS", destination: "CDG" });
    expect(view.cities).toBe("Lyon → Paris");
    expect(view.progressPercent).toBe(25);
    expect(view.arrival).toMatch(/^~\d{2}:\d{2}$/);
  });

  it("nulls each line that cannot be known", () => {
    const view = skyRouteView({
      route: route(0, 484),
      position: at(121),
      groundSpeedKmh: null,
      nowMs: NOW,
      timeZone: "UTC",
    });
    expect(view.arrival).toBeNull();
    expect(view.progressPercent).toBe(25);
  });
});
