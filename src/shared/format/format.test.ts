import { describe, expect, it } from "vitest";
import { type Airline, UNKNOWN_AIRLINE } from "../airlines";
import { flightLabel, formatMetric } from "./index";

const NBSP = " ";
const airFrance = { ...UNKNOWN_AIRLINE, code: "AFR", iata: ["AF"] } satisfies Airline;

describe("formatMetric", () => {
  it("returns a dash for null", () => {
    expect(formatMetric(null)).toBe("—");
  });

  it("groups thousands with a no-break space", () => {
    expect(formatMetric(7850)).toBe(`7${NBSP}850`);
    expect(formatMetric(1_234_567)).toBe(`1${NBSP}234${NBSP}567`);
  });

  it("rounds to the nearest integer", () => {
    expect(formatMetric(779.6)).toBe("780");
    expect(formatMetric(0.5)).toBe("1");
    expect(formatMetric(0)).toBe("0");
  });

  it("carries over to the next group when rounding", () => {
    expect(formatMetric(999.5)).toBe(`1${NBSP}000`);
  });

  it("keeps the sign of negative values", () => {
    expect(formatMetric(-1234)).toBe(`-1${NBSP}234`);
  });
});

describe("flightLabel", () => {
  it("returns a dash for null and empty callsigns", () => {
    expect(flightLabel(null, airFrance)).toBe("—");
    expect(flightLabel("   ", airFrance)).toBe("—");
  });

  it("replaces the ICAO prefix with the first IATA code", () => {
    expect(flightLabel("AFR1506", airFrance)).toBe("AF1506");
  });

  it("cleans and upper-cases the callsign", () => {
    expect(flightLabel("  afr1506 ", airFrance)).toBe("AF1506");
  });

  it("keeps a callsign shorter than four characters", () => {
    expect(flightLabel("AFR", airFrance)).toBe("AFR");
    expect(flightLabel("AF1", airFrance)).toBe("AF1");
  });

  it("keeps the callsign when the airline has no IATA code", () => {
    expect(flightLabel("ZZZ123", UNKNOWN_AIRLINE)).toBe("ZZZ123");
  });

  it("keeps non-ICAO callsigns as they are", () => {
    expect(flightLabel("AF1506", airFrance)).toBe("AF1506");
    expect(flightLabel("F-HBXA", airFrance)).toBe("F-HBXA");
  });
});
