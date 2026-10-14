import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";
import { AIRLINES, UNKNOWN_AIRLINE } from "./table";
import { airlineTheme } from "./theme";
import type { Airline } from "./types";

interface CatalogEntry {
  name: string;
  iata: string[];
  icao: string[];
}

const catalog: CatalogEntry[] = JSON.parse(readFileSync("tests/acceptance/SPEC-0002.catalogue.json", "utf8")).airlines;

const HANDOFF = ["IBE", "AFR", "EZY", "DLH", "KLM", "RYR", "VLG", "TAP"];

function byCode(code: string) {
  return AIRLINES.filter((airline) => airline.code === code)[0] as Airline;
}

describe("AIRLINES", () => {
  it("has 145 entries whose code is the main OACI code", () => {
    expect(AIRLINES).toHaveLength(145);
    for (const airline of AIRLINES) expect(airline.code).toBe(airline.icao[0]);
  });

  it("follows the catalog order, codes and names (handoff names aside)", () => {
    const names = AIRLINES.map((airline) => airline.name);
    expect(AIRLINES.map((a) => a.icao)).toEqual(catalog.map((e) => e.icao));
    expect(AIRLINES.map((a) => a.iata)).toEqual(catalog.map((e) => e.iata));
    expect(names).toContain("easyJet");
    expect(names).toContain("TAP Air Portugal");
  });

  it("has unique, well-formed IATA and OACI codes", () => {
    const icao = AIRLINES.flatMap((airline) => airline.icao);
    const iata = AIRLINES.flatMap((airline) => airline.iata);
    expect(new Set(icao).size).toBe(icao.length);
    expect(new Set(iata).size).toBe(iata.length);
    for (const code of icao) expect(code).toMatch(/^[A-Z]{3}$/);
    for (const code of iata) expect(code).toMatch(/^[A-Z0-9]{2}$/);
  });

  it("keeps the handoff palettes", () => {
    expect(byCode("IBE")).toEqual({
      code: "IBE",
      name: "Iberia",
      country: "Espagne",
      primary: "#C8102E",
      secondary: "#F6C344",
      iata: ["IB"],
      icao: ["IBE"],
      tail: { base: "#F6C344", stripe1: "#8E0A22", stripe2: null, disc: null },
    });
    expect(byCode("AFR").tail).toEqual({ base: "#F4F1EA", stripe1: "#2B5BD6", stripe2: "#E1251B", disc: null });
    expect(byCode("DLH").tail).toEqual({ base: "#1A3466", stripe1: null, stripe2: null, disc: "#F9B000" });
    expect(byCode("KLM")).toMatchObject({ country: "Pays-Bas", primary: "#00A1DE", secondary: "#003145" });
    expect(byCode("RYR")).toMatchObject({ iata: ["FR", "RK"], icao: ["RYR", "RUK"], primary: "#073590" });
    expect(byCode("VLG")).toMatchObject({ country: "Espagne", primary: "#FFCC00", secondary: "#3C3C3B" });
    expect(byCode("TAP")).toMatchObject({ name: "TAP Air Portugal", country: "Portugal", primary: "#1E6F4A" });
    expect(byCode("EZY")).toMatchObject({
      name: "easyJet",
      country: "Royaume-Uni",
      iata: ["U2", "EC", "DS"],
      icao: ["EZY", "EJU", "EZS"],
      primary: "#FF6600",
      secondary: "#FFFFFF",
    });
  });

  it("gives the other 137 airlines the unknown colors and no country", () => {
    const others = AIRLINES.filter((airline) => !HANDOFF.includes(airline.code));
    expect(others).toHaveLength(137);
    for (const airline of others) {
      expect(airline.primary).toBe(UNKNOWN_AIRLINE.primary);
      expect(airline.secondary).toBe(UNKNOWN_AIRLINE.secondary);
      expect(airline.tail).toEqual(UNKNOWN_AIRLINE.tail);
      expect(airline.country).toBeNull();
    }
  });

  it("keeps the unknown tail unmodifiable", () => {
    expect(Object.isFrozen(UNKNOWN_AIRLINE.tail)).toBe(true);
  });

  it("guarantees contrast 3:1 (big) and 4.5:1 (small) on every airline (INV5)", () => {
    for (const airline of [...AIRLINES, UNKNOWN_AIRLINE]) {
      const theme = airlineTheme(airline);
      expect(contrastRatio(theme.big, theme.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.small, theme.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("UNKNOWN_AIRLINE", () => {
  it("is the xx entry of the handoff, without codes", () => {
    expect(UNKNOWN_AIRLINE).toEqual({
      code: "xx",
      name: "Inconnue",
      country: "France",
      primary: "#1D1D1B",
      secondary: "#F2E8D5",
      iata: [],
      icao: [],
      tail: { base: "#CFC8BA", stripe1: "#1D1D1B", stripe2: null, disc: null },
    });
  });
});
