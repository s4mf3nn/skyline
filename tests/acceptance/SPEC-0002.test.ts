import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0002 (Vitest) : logique pure du thème et de la table des compagnies. Le composant AirlineTail
// (CA9) n'a pas de test de contrat : il est vérifié sur simulateur par SPEC-0005.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Module posé par cette spec : chargé par chemin, avec les types du contrat d'interface recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface TailPalette {
  base: string;
  stripe1: string | null;
  stripe2: string | null;
  disc: string | null;
}
interface Airline {
  code: string;
  name: string;
  country: string | null;
  primary: string;
  secondary: string;
  iata: readonly string[];
  icao: readonly string[];
  tail: TailPalette;
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
  track: string;
}
interface AirlinesModule {
  AIRLINES: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  mix(a: string, b: string, t: number): string;
  contrastRatio(a: string, b: string): number;
  fit(fg: string, bg: string, target: number): string;
  airlineTheme(airline: Airline): AirlineTheme;
  resolveAirline(callsign: string | null): Airline;
}
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");

describe.skip("SPEC-0002 airline theme and table", () => {
  it("CA1 : mixes two colors channel by channel and rounds to uppercase #RRGGBB", async () => {
    const { mix } = await airlines();
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#C8102E", "#FFFFFF", 0.25)).toBe("#D64C62");
    expect(mix("#FF6600", "#000000", 0.4)).toBe("#993D00");
  });

  it("CA1 : returns the first color at t = 0 and the second at t = 1, normalized to uppercase", async () => {
    const { mix } = await airlines();
    expect(mix("#c8102e", "#000000", 0)).toBe("#C8102E");
    expect(mix("#C8102E", "#00a1de", 1)).toBe("#00A1DE");
  });

  it("CA2 : computes the WCAG contrast ratio, symmetric, from 1 to 21", async () => {
    const { contrastRatio } = await airlines();
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.478, 3);
  });

  it("CA3 : keeps the foreground when it already reaches the target, including when it is exactly met", async () => {
    const { fit: fitColor } = await airlines();
    expect(fitColor("#F6C344", "#C8102E", 3)).toBe("#F6C344");
    expect(fitColor("#808080", "#FFFFFF", 3)).toBe("#808080");
    expect(fitColor("#000000", "#FFFFFF", 21)).toBe("#000000");
  });

  it("CA3 : moves the foreground toward white or black in steps of 0.02 until the target is reached", async () => {
    const { fit: fitColor } = await airlines();
    expect(fitColor("#808080", "#FFFFFF", 4.5)).toBe("#767676");
    expect(fitColor("#777777", "#FFFFFF", 4.5)).toBe("#757575");
    expect(fitColor("#336699", "#336699", 3)).toBe("#A5BCD2");
  });

  it("CA3 : falls back to cream or ink, the one with the best contrast, when no mix reaches the target", async () => {
    const { fit: fitColor } = await airlines();
    expect(fitColor("#101010", "#101010", 15)).toBe("#F4F1EA");
    expect(fitColor("#FFFFFF", "#FF6600", 3)).toBe("#1D1D1B");
    expect(fitColor("#808080", "#7F7F7F", 4.5)).toBe("#1D1D1B");
  });

  it("CA4 : computes bg, big, small and track from the airline colors", async () => {
    const { airlineTheme, resolveAirline } = await airlines();
    expect(airlineTheme(resolveAirline("IBE3457"))).toEqual({
      bg: "#C8102E",
      big: "#F6C344",
      small: "#FADF9A",
      track: "#D74E4E",
    });
    expect(airlineTheme(resolveAirline("AFR1506"))).toEqual({
      bg: "#0B1F4B",
      big: "#F4F1EA",
      small: "#F4F1EA",
      track: "#515E7B",
    });
  });

  it("CA4 : corrects the secondary color of a low-contrast airline (easyJet) to ink", async () => {
    const { airlineTheme, resolveAirline } = await airlines();
    expect(airlineTheme(resolveAirline("EZY4617"))).toEqual({
      bg: "#FF6600",
      big: "#1D1D1B",
      small: "#1D1D1B",
      track: "#BB5008",
    });
  });

  it("CA4 : guarantees 3:1 for big text and 4.5:1 for small text on every airline of the table", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE, airlineTheme, contrastRatio } = await airlines();
    for (const airline of [...AIRLINES, UNKNOWN_AIRLINE]) {
      const theme = airlineTheme(airline);
      expect(contrastRatio(theme.big, theme.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.small, theme.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("CA5 : lists the catalog airlines with unique, well-formed IATA and OACI codes", async () => {
    const { AIRLINES } = await airlines();
    expect(AIRLINES.length).toBeGreaterThanOrEqual(145);
    const icao = AIRLINES.flatMap((airline) => airline.icao);
    const iata = AIRLINES.flatMap((airline) => airline.iata);
    expect(new Set(icao).size).toBe(icao.length);
    expect(new Set(iata).size).toBe(iata.length);
    for (const airline of AIRLINES) {
      expect(airline.icao.length).toBeGreaterThan(0);
      expect(airline.iata.length).toBeGreaterThan(0);
      for (const code of airline.icao) expect(code).toMatch(/^[A-Z]{3}$/);
      for (const code of airline.iata) expect(code).toMatch(/^[A-Z0-9]{2}$/);
      expect(airline.primary).toMatch(/^#[0-9A-F]{6}$/);
      expect(airline.secondary).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("CA5 : gives the handoff colors, name, country and tail palette to Air France and Lufthansa", async () => {
    const { resolveAirline } = await airlines();
    expect(resolveAirline("AFR1506")).toEqual({
      code: "AFR",
      name: "Air France",
      country: "France",
      primary: "#0B1F4B",
      secondary: "#F4F1EA",
      iata: ["AF"],
      icao: ["AFR"],
      tail: { base: "#F4F1EA", stripe1: "#2B5BD6", stripe2: "#E1251B", disc: null },
    });
    expect(resolveAirline("DLH1033")).toEqual({
      code: "DLH",
      name: "Lufthansa",
      country: "Allemagne",
      primary: "#0A1D3D",
      secondary: "#F9B000",
      iata: ["LH"],
      icao: ["DLH"],
      tail: { base: "#1A3466", stripe1: null, stripe2: null, disc: "#F9B000" },
    });
  });

  it("CA5 : keeps every code of a multi-operator airline, main code first (easyJet)", async () => {
    const { resolveAirline } = await airlines();
    const easyjet = resolveAirline("EZY4617");
    expect(easyjet.name).toBe("easyJet");
    expect(easyjet.iata).toEqual(["U2", "EC", "DS"]);
    expect(easyjet.icao).toEqual(["EZY", "EJU", "EZS"]);
    expect(resolveAirline("EJU1234")).toBe(easyjet);
  });

  it("CA5 : gives a catalog airline without handoff colors its own name and the unknown-airline colors", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await airlines();
    const aegean = resolveAirline("AEE123");
    expect(aegean.name).toBe("Aegean Airlines");
    expect(aegean.iata).toEqual(["A3"]);
    expect(aegean.icao).toEqual(["AEE"]);
    expect(aegean.country).toBeNull();
    expect(aegean.primary).toBe(UNKNOWN_AIRLINE.primary);
    expect(aegean.secondary).toBe(UNKNOWN_AIRLINE.secondary);
    expect(aegean.tail).toEqual(UNKNOWN_AIRLINE.tail);
  });

  it("CA6 : defines the unknown airline as the xx entry of the handoff", async () => {
    const { UNKNOWN_AIRLINE } = await airlines();
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

  it("CA7 : resolves an airline from its OACI callsign prefix", async () => {
    const { resolveAirline } = await airlines();
    expect(resolveAirline("AFR1506").name).toBe("Air France");
    expect(resolveAirline("RYR8312").name).toBe("Ryanair");
    expect(resolveAirline("VLG8013").name).toBe("Vueling");
    expect(resolveAirline("KLM1234").name).toBe("KLM");
  });

  it("CA7 : falls back to the IATA prefix, and cleans the callsign first", async () => {
    const { resolveAirline } = await airlines();
    expect(resolveAirline("AF1506").name).toBe("Air France");
    expect(resolveAirline("U24617").name).toBe("easyJet");
    expect(resolveAirline("TP433").name).toBe("TAP Air Portugal");
    expect(resolveAirline("  afr1506 ").name).toBe("Air France");
  });

  it("CA8 : returns the unknown airline for a missing, empty or unmatched callsign", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await airlines();
    expect(resolveAirline(null)).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("   ")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("ZZZ123")).toBe(UNKNOWN_AIRLINE);
  });

  it("CA8 : returns the unknown airline when no digit follows the prefix, and for registrations", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await airlines();
    expect(resolveAirline("AFR")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("AFRX")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("AF")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("F-HBXA")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("N123AB")).toBe(UNKNOWN_AIRLINE);
  });

  it("CA8 : never throws on hostile callsign input", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await airlines();
    expect(resolveAirline("../../etc/passwd")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("<script>alert(1)</script>")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("é".repeat(10_000))).toBe(UNKNOWN_AIRLINE);
  });

  it("Edge : rejects a color that is not #RRGGBB with the typed error INVALID_COLOR", async () => {
    const { mix, contrastRatio, fit: fitColor } = await airlines();
    const invalidColor = expect.objectContaining({ code: "INVALID_COLOR" });
    expect(() => mix("rouge", "#000000", 0.5)).toThrow(invalidColor);
    expect(() => mix("#000000", "#FFF", 0.5)).toThrow(invalidColor);
    expect(() => contrastRatio("", "#000000")).toThrow(invalidColor);
    expect(() => fitColor("#12345G", "#000000", 3)).toThrow(invalidColor);
  });
});
