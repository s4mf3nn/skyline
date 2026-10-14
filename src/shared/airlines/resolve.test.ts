import { describe, expect, it } from "vitest";
import { resolveAirline } from "./resolve";
import { AIRLINES, UNKNOWN_AIRLINE } from "./table";

function byName(name: string) {
  const found = AIRLINES.find((airline) => airline.name === name);
  expect(found, name).toBeDefined();
  return found ?? UNKNOWN_AIRLINE;
}

describe("resolveAirline", () => {
  const airFrance = byName("Air France");

  it("resolves an ICAO prefix followed by digits", () => {
    expect(resolveAirline("AFR1506")).toBe(airFrance);
  });

  it("ignores everything after the first digit", () => {
    expect(resolveAirline("RUK7KM")).toBe(byName("Ryanair"));
  });

  it("falls back to the IATA form", () => {
    expect(resolveAirline("AF1506")).toBe(airFrance);
    expect(resolveAirline("U24617")).toBe(byName("easyJet"));
    expect(resolveAirline("RK44")).toBe(byName("Ryanair"));
  });

  it("trims and uppercases", () => {
    expect(resolveAirline("afr1506 ")).toBe(airFrance);
    expect(resolveAirline("\n AF1506\t")).toBe(airFrance);
  });

  it("returns the unknown airline for null and empty input", () => {
    expect(resolveAirline(null)).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("   ")).toBe(UNKNOWN_AIRLINE);
  });

  it("returns the unknown airline for a two-letter callsign without digits", () => {
    expect(resolveAirline("AF")).toBe(UNKNOWN_AIRLINE);
  });

  it("returns the unknown airline for a known ICAO prefix without digit", () => {
    expect(resolveAirline("AFR")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("AFRX")).toBe(UNKNOWN_AIRLINE);
  });

  it("does not confuse AC with ACI", () => {
    expect(resolveAirline("AC123")).toBe(byName("Air Canada"));
    expect(resolveAirline("ACI123")).not.toBe(byName("Air Canada"));
  });

  it("falls back to IATA when an unknown ICAO prefix starts with an IATA code", () => {
    expect(resolveAirline("AFZ123")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("ZZZ123")).toBe(UNKNOWN_AIRLINE);
  });

  it("rejects registrations and spaced callsigns", () => {
    for (const callsign of ["F-HBXA", "FHBXA", "N123AB", "N3456A", "AFR 1506"]) {
      expect(resolveAirline(callsign)).toBe(UNKNOWN_AIRLINE);
    }
  });

  it("rejects an IATA form with more than four digits", () => {
    expect(resolveAirline("AF15060")).toBe(UNKNOWN_AIRLINE);
  });

  it("does not match non-ASCII letters or digits", () => {
    expect(resolveAirline("ÀFR1506")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("AFR١٥٠٦")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("ÆF1506")).toBe(UNKNOWN_AIRLINE);
  });

  it("handles very long input without throwing", () => {
    const long = `${"A".repeat(100_000)}1`;
    expect(resolveAirline(long)).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline(`AFR1${"9".repeat(100_000)}`)).toBe(airFrance);
  });
});
