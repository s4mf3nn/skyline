import path from "node:path";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0002 : parcours de bout en bout par l'interface publique, avec d'autres données que
// le contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

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

const CREAM = "#F4F1EA";
const INK = "#1D1D1B";

describe("SPEC-0002 hidden scenarios", () => {
  it("themes a batch of ADS-B callsigns and stays readable and consistent with the public helpers", async () => {
    const { resolveAirline, airlineTheme, fit: fitColor, mix, contrastRatio } = await airlines();
    const callsigns = ["RUK90QX", "EZS15PH", "TAP1046", "KL1004", "VY1221", "IB3171"];

    const names = callsigns.map((callsign) => resolveAirline(callsign).name);
    expect(names).toEqual(["Ryanair", "easyJet", "TAP Air Portugal", "KLM", "Vueling", "Iberia"]);

    for (const callsign of callsigns) {
      const airline = resolveAirline(callsign);
      const theme = airlineTheme(airline);
      expect(theme.bg).toBe(airline.primary);
      expect(theme.big).toBe(fitColor(airline.secondary, airline.primary, 3));
      expect(theme.small).toBe(fitColor(airline.secondary, airline.primary, 4.5));
      expect(theme.track).toBe(mix(theme.bg, theme.small, 0.3));
      expect(contrastRatio(theme.big, theme.bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it("resolves a messy callsign list, falling back to the unknown airline without losing any entry", async () => {
    const { resolveAirline, airlineTheme, UNKNOWN_AIRLINE } = await airlines();
    const raw = ["eju52qr", "  ruk44 ", "FR1234", "XX1234", null, "GEZWX", "N3456", "Y4123B"];

    const resolved = raw.map((callsign) => resolveAirline(callsign));

    expect(resolved).toHaveLength(raw.length);
    expect(resolved.map((airline) => airline.name)).toEqual([
      "easyJet",
      "Ryanair",
      "Ryanair",
      "Inconnue",
      "Inconnue",
      "Inconnue",
      "Volaris Airlines",
      "Inconnue",
    ]);
    expect(resolved[0]?.icao).toContain("EJU");
    expect(resolved[1]).toBe(resolved[2]);
    expect(airlineTheme(resolved[3] as Airline)).toEqual(airlineTheme(UNKNOWN_AIRLINE));
    expect(airlineTheme(UNKNOWN_AIRLINE)).toEqual({
      bg: "#1D1D1B",
      big: "#F2E8D5",
      small: "#F2E8D5",
      track: "#5D5A53",
    });
  });

  it("fit always returns the input, a color that reaches the target, or cream or ink", async () => {
    const { fit: fitColor, contrastRatio, AIRLINES, UNKNOWN_AIRLINE } = await airlines();
    expect(fitColor("#19D12C", "#45FE9C", 4.5)).toBe("#0D7118");
    expect(fitColor("#1B836B", "#DC0894", 3)).toBe("#F4F1EA");
    const backgrounds = [...AIRLINES, UNKNOWN_AIRLINE].map((airline) => airline.primary);
    backgrounds.push("#000000", "#FFFFFF", "#7F7F7F", "#808080");
    const foregrounds = ["#000000", "#FFFFFF", "#7F7F7F", "#C8102E", "#FFCC00", "#00A1DE", "#336699", "#f6c344"];

    for (const bg of backgrounds) {
      for (const fg of foregrounds) {
        for (const target of [3, 4.5, 7]) {
          const result = fitColor(fg, bg, target);
          const unchanged = result === fg;
          const reached = contrastRatio(result, bg) >= target;
          const fallback = result === CREAM || result === INK;
          expect(unchanged || reached || fallback).toBe(true);
          if (unchanged) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(target);
        }
      }
    }
  });

  it("rejects an invalid custom palette and survives an unsolvable one", async () => {
    const { airlineTheme, UNKNOWN_AIRLINE } = await airlines();

    const broken = { ...UNKNOWN_AIRLINE, primary: "nope" };
    expect(() => airlineTheme(broken)).toThrow(expect.objectContaining({ code: "INVALID_COLOR" }));

    const flat = { ...UNKNOWN_AIRLINE, primary: "#7F7F7F", secondary: "#7F7F7F" };
    const theme = airlineTheme(flat);
    expect(theme).toEqual({ bg: "#7F7F7F", big: "#353535", small: INK, track: "#626261" });
  });
});
