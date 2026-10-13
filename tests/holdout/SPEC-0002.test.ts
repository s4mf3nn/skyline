import path from "node:path";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0002 : parcours « indicatif d'un avion vers thème et dérive », sur d'autres données que le
// contrat. Sans `.skip` : ils s'activent seuls quand le contrat de la spec n'a plus de `.skip`.

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface TailColors {
  base: string;
  band1: string;
  band2: string;
  disc: string;
}
interface Airline {
  code: string;
  name: string;
  primary: string;
  secondary: string;
  tail: TailColors;
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
  track: string;
}
interface TailLayer {
  layer: string;
  fill: string;
  shape: unknown;
}
interface AirlineThemeModule {
  mix(from: string, to: string, t: number): string;
  fit(foreground: string, background: string, target: number): string;
  airlines: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): AirlineTheme;
  tailLayers(colors: TailColors): TailLayer[];
}
const theme = () => load<AirlineThemeModule>("src/shared/airline-theme/index.ts");

function contrast(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((i) => {
      const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  };
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const OUTLINE = { kind: "path", d: "M 36 14 Q 40 2 54 2 L 150 2 L 460 440 L 116 440 Z" };
const DISC = { kind: "circle", cx: 176, cy: 196, r: 66 };

describe("SPEC-0002 holdout : from callsign to theme and tail", () => {
  it("shows the Lufthansa theme and tail for a lowercase callsign with trailing blanks", async () => {
    const { resolveAirline, airlineTheme, tailLayers } = await theme();
    const airline = resolveAirline("dlh1033 \t");
    expect(airline.name).toBe("Lufthansa");
    expect(airlineTheme(airline)).toEqual({ bg: "#0A1D3D", big: "#F9B000", small: "#F9B000", track: "#52492B" });
    expect(tailLayers(airline.tail)).toEqual([
      { layer: "base", fill: "#1A3466", shape: OUTLINE },
      { layer: "disc", fill: "#F9B000", shape: DISC },
    ]);
  });

  it("themes the remaining handoff airlines from their callsigns, readable on their background", async () => {
    const { resolveAirline, airlineTheme } = await theme();
    const expected: Record<string, AirlineTheme> = {
      KLM1234: { bg: "#00A1DE", big: "#003145", small: "#003145", track: "#007FB0" },
      RYR8312: { bg: "#073590", big: "#F1C933", small: "#F1C933", track: "#4D6174" },
      VLG8013: { bg: "#FFCC00", big: "#3C3C3B", small: "#3C3C3B", track: "#C5A112" },
      TAP433: { bg: "#1E6F4A", big: "#F4F1EA", small: "#F4F1EA", track: "#5E967A" },
    };
    for (const [callsign, wanted] of Object.entries(expected)) {
      const result = airlineTheme(resolveAirline(callsign));
      expect(result).toEqual(wanted);
      expect(contrast(result.big, result.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(result.small, result.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never invents a color for an aircraft without a known airline", async () => {
    const { resolveAirline, airlineTheme, tailLayers, UNKNOWN_AIRLINE } = await theme();
    for (const callsign of [null, "", "FHBXA", "F-HBXA", "N123AB", "XYZ4567", "AF1506"]) {
      const airline = resolveAirline(callsign);
      expect(airline).toBe(UNKNOWN_AIRLINE);
      expect(airlineTheme(airline)).toEqual({ bg: "#1D1D1B", big: "#F2E8D5", small: "#F2E8D5", track: "#5D5A53" });
      expect(tailLayers(airline.tail).map((layer) => layer.fill)).toEqual(["#CFC8BA", "#1D1D1B"]);
    }
  });

  it("recomputes the handoff color functions on other colors, up to the 60 % limit and the fallbacks", async () => {
    const { mix, fit: fitColor } = await theme();
    expect(fitColor("#B3B3B3", "#808080", 3)).toBe("#E1E1E1");
    expect(fitColor("#A0A0A0", "#8A8A8A", 3)).toBe("#404040");
    expect(fitColor("#777777", "#808080", 3)).toBe("#373737");
    expect(fitColor("#777777", "#808080", 4.5)).toBe("#1D1D1B");
    expect(fitColor("#F4F1EA", "#F4F1EA", 4.5)).toBe("#6B6A67");
    expect(mix("#FF6600", "#073590", 0.3)).toBe("#B5572B");
    expect(mix("#123456", "#654321", 0.33)).toBe("#2D3945");
  });
});
