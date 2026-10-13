import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0002, partie logique (Vitest) : couleurs et résolution des compagnies. Le composant de dérive est
// dans SPEC-0002.native.test.tsx (Jest). Les valeurs attendues de mix() et fit() viennent de data.js du handoff.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Module posé par cette spec : chargé par chemin, avec les types du contrat d'interface recopiés ici.
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
  country: string | null;
  primary: string;
  secondary: string;
  iata: string | null;
  oaci: string | null;
  tail: TailColors;
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
  track: string;
}
type TailShape = { kind: "path"; d: string } | { kind: "circle"; cx: number; cy: number; r: number };
interface TailLayer {
  layer: "base" | "band1" | "band2" | "disc";
  fill: string;
  shape: TailShape;
}
interface AirlineThemeModule {
  mix(from: string, to: string, t: number): string;
  fit(foreground: string, background: string, target: number): string;
  airlines: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): AirlineTheme;
  tailLayers(colors: TailColors): TailLayer[];
  TAIL_VIEWBOX: string;
  TAIL_OUTLINE_PATH: string;
}
const theme = () => load<AirlineThemeModule>("src/shared/airline-theme/index.ts");

/** Contraste WCAG entre deux couleurs `#RRGGBB`, calculé ici pour ne pas dépendre du module testé. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const NONE = "none";
const OUTLINE = "M 36 14 Q 40 2 54 2 L 150 2 L 460 440 L 116 440 Z";
const BAND1: TailShape = { kind: "path", d: "M 0 300 L 320 160 L 320 236 L 0 376 Z" };
const BAND2: TailShape = { kind: "path", d: "M 0 394 L 320 254 L 320 286 L 0 426 Z" };
const DISC: TailShape = { kind: "circle", cx: 176, cy: 196, r: 66 };
const tail = (base: string, band1: string, band2: string, disc: string): TailColors => ({ base, band1, band2, disc });

const KNOWN_AIRLINES: Airline[] = [
  {
    code: "ib",
    name: "Iberia",
    country: "Espagne",
    primary: "#C8102E",
    secondary: "#F6C344",
    iata: "IB",
    oaci: "IBE",
    tail: tail("#F6C344", "#8E0A22", NONE, NONE),
  },
  {
    code: "af",
    name: "Air France",
    country: "France",
    primary: "#0B1F4B",
    secondary: "#F4F1EA",
    iata: "AF",
    oaci: "AFR",
    tail: tail("#F4F1EA", "#2B5BD6", "#E1251B", NONE),
  },
  {
    code: "u2",
    name: "easyJet",
    country: "Royaume-Uni",
    primary: "#FF6600",
    secondary: "#FFFFFF",
    iata: "U2",
    oaci: "EZY",
    tail: tail("#FFFFFF", "#FF6600", NONE, NONE),
  },
  {
    code: "lh",
    name: "Lufthansa",
    country: "Allemagne",
    primary: "#0A1D3D",
    secondary: "#F9B000",
    iata: "LH",
    oaci: "DLH",
    tail: tail("#1A3466", NONE, NONE, "#F9B000"),
  },
  {
    code: "kl",
    name: "KLM",
    country: "Pays-Bas",
    primary: "#00A1DE",
    secondary: "#003145",
    iata: "KL",
    oaci: "KLM",
    tail: tail("#FFFFFF", "#7FD3F2", NONE, NONE),
  },
  {
    code: "fr",
    name: "Ryanair",
    country: "Irlande",
    primary: "#073590",
    secondary: "#F1C933",
    iata: "FR",
    oaci: "RYR",
    tail: tail("#073590", "#F1C933", NONE, NONE),
  },
  {
    code: "vy",
    name: "Vueling",
    country: "Espagne",
    primary: "#FFCC00",
    secondary: "#3C3C3B",
    iata: "VY",
    oaci: "VLG",
    tail: tail("#FFCC00", "#3C3C3B", NONE, NONE),
  },
  {
    code: "tp",
    name: "TAP Air Portugal",
    country: "Portugal",
    primary: "#1E6F4A",
    secondary: "#F4F1EA",
    iata: "TP",
    oaci: "TAP",
    tail: tail("#E4252F", "#F4F1EA", NONE, NONE),
  },
];
const UNKNOWN: Airline = {
  code: "xx",
  name: "Inconnue",
  country: null,
  primary: "#1D1D1B",
  secondary: "#F2E8D5",
  iata: null,
  oaci: null,
  tail: tail("#CFC8BA", "#1D1D1B", NONE, NONE),
};

describe.skip("SPEC-0002 airline theme", () => {
  it("CA1 : interpolates channel by channel and returns an uppercase color", async () => {
    const { mix } = await theme();
    expect(mix("#C8102E", "#FFFFFF", 0.5)).toBe("#E48897");
    expect(mix("#0B1F4B", "#F4F1EA", 0.3)).toBe("#515E7B");
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("CA1 : returns the first color at 0 and the second at 1, accepting lowercase input", async () => {
    const { mix } = await theme();
    expect(mix("#c8102e", "#ffffff", 0)).toBe("#C8102E");
    expect(mix("#c8102e", "#ffffff", 1)).toBe("#FFFFFF");
    expect(mix("#f6c344", "#0b1f4b", 0.25)).toBe("#BB9A46");
  });

  it("CA2 : keeps the foreground when its contrast already reaches the target", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#F6C344", "#C8102E", 3)).toBe("#F6C344");
    expect(fitColor("#3C3C3B", "#FFCC00", 4.5)).toBe("#3C3C3B");
    expect(fitColor("#003145", "#00A1DE", 4.5)).toBe("#003145");
  });

  it("CA2 : keeps the foreground when its contrast equals the target exactly", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#F6C344", "#C8102E", contrast("#F6C344", "#C8102E"))).toBe("#F6C344");
    expect(fitColor("#FADF9A", "#C8102E", contrast("#FADF9A", "#C8102E"))).toBe("#FADF9A");
  });

  it("CA2 : returns the foreground unchanged, case included, when it is already readable", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#f6c344", "#C8102E", 3)).toBe("#f6c344");
    expect(fitColor("#abcdef", "#123456", 4.5)).toBe("#abcdef");
  });

  it("CA3 : blends toward white in steps of 2 % until the target is reached", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#F6C344", "#C8102E", 4.5)).toBe("#FADF9A");
    expect(fitColor("#123456", "#123456", 4.5)).toBe("#8D9EAE");
  });

  it("CA3 : blends toward black when white does not help", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#F6C344", "#FFFFFF", 3)).toBe("#B18C31");
    expect(fitColor("#FF0000", "#00FF00", 4.5)).toBe("#C20000");
    expect(fitColor("#808080", "#808080", 3)).toBe("#363636");
  });

  it("CA3 : accepts a blend reached only at the last step, 60 %", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#7A7A7A", "#707070", 3)).toBe("#CACACA");
  });

  it("CA4 : falls back to the ink when no blend reaches the target and the ink contrasts best", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#FFFFFF", "#FF6600", 3)).toBe("#1D1D1B");
    expect(fitColor("#FFFFFF", "#FF6600", 4.5)).toBe("#1D1D1B");
  });

  it("CA4 : falls back to the cream when it contrasts best", async () => {
    const { fit: fitColor } = await theme();
    expect(fitColor("#C8102E", "#C8102E", 3)).toBe("#F4F1EA");
  });

  it("CA5 : lists the eight handoff airlines in order with their codes and colors", async () => {
    const { airlines } = await theme();
    // toMatchObject : SPEC-0010 ajoute un champ `image` sans retirer ceux-ci (ordre et nombre d'entrées restent exigés).
    expect(airlines).toHaveLength(8);
    expect(airlines).toMatchObject(KNOWN_AIRLINES);
  });

  it("CA5 : exposes the unknown airline apart from the table", async () => {
    const { airlines, UNKNOWN_AIRLINE } = await theme();
    expect(UNKNOWN_AIRLINE).toMatchObject(UNKNOWN);
    expect(airlines.map((airline) => airline.code)).not.toContain("xx");
  });

  it("CA6 : computes the theme of an airline from its primary and secondary colors", async () => {
    const { airlines, airlineTheme } = await theme();
    const byCode = (code: string): Airline => {
      const found = airlines.find((airline) => airline.code === code);
      if (found === undefined) throw new TypeError(`missing airline ${code}`);
      return found;
    };
    expect(airlineTheme(byCode("ib"))).toEqual({ bg: "#C8102E", big: "#F6C344", small: "#FADF9A", track: "#D74E4E" });
    expect(airlineTheme(byCode("af"))).toEqual({ bg: "#0B1F4B", big: "#F4F1EA", small: "#F4F1EA", track: "#515E7B" });
    expect(airlineTheme(byCode("u2"))).toEqual({ bg: "#FF6600", big: "#1D1D1B", small: "#1D1D1B", track: "#BB5008" });
  });

  it("CA6 : keeps 3:1 for big text and 4.5:1 for small text on every airline background", async () => {
    const { airlines, UNKNOWN_AIRLINE, airlineTheme } = await theme();
    for (const airline of [...airlines, UNKNOWN_AIRLINE]) {
      const { bg, big, small } = airlineTheme(airline);
      expect(contrast(big, bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(small, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("CA7 : resolves the airline from the OACI prefix of the callsign", async () => {
    const { resolveAirline } = await theme();
    expect(resolveAirline("AFR1506").code).toBe("af");
    expect(resolveAirline("IBE3457").code).toBe("ib");
    expect(resolveAirline("EZY6103").code).toBe("u2");
    expect(resolveAirline("AFR12AB").code).toBe("af");
  });

  it("CA7 : accepts lowercase callsigns and trims surrounding spaces", async () => {
    const { resolveAirline } = await theme();
    expect(resolveAirline("ezy6103").code).toBe("u2");
    expect(resolveAirline("  RYR8312 ").code).toBe("fr");
    expect(resolveAirline("\tAFR1506\n").code).toBe("af");
    expect(resolveAirline("\u00A0VLG8013\u00A0").code).toBe("vy");
  });

  it("CA8 : falls back to the unknown airline when there is no usable callsign", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await theme();
    expect(resolveAirline(null)).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline("   ")).toBe(UNKNOWN_AIRLINE);
  });

  it("CA8 : falls back to the unknown airline for an IATA prefix, a registration or a malformed callsign", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await theme();
    for (const callsign of ["AF1506", "U24617", "F-HBXA", "AFR", "AFR15060", "AFR 1506", "AFR-1506"]) {
      expect(resolveAirline(callsign)).toBe(UNKNOWN_AIRLINE);
    }
  });

  it("CA8 : falls back to the unknown airline for an OACI prefix absent from the table", async () => {
    const { resolveAirline, UNKNOWN_AIRLINE } = await theme();
    expect(resolveAirline("XYZ123")).toBe(UNKNOWN_AIRLINE);
  });

  it("CA9 : lists the layers to paint in order, with their shape, and skips the colors set to none", async () => {
    const { tailLayers, TAIL_OUTLINE_PATH } = await theme();
    expect(TAIL_OUTLINE_PATH).toBe(OUTLINE);
    expect(tailLayers(tail("#F4F1EA", "#2B5BD6", "#E1251B", "#F9B000"))).toEqual([
      { layer: "base", fill: "#F4F1EA", shape: { kind: "path", d: OUTLINE } },
      { layer: "band1", fill: "#2B5BD6", shape: BAND1 },
      { layer: "band2", fill: "#E1251B", shape: BAND2 },
      { layer: "disc", fill: "#F9B000", shape: DISC },
    ]);
    expect(tailLayers(tail("#1A3466", NONE, NONE, "#F9B000"))).toEqual([
      { layer: "base", fill: "#1A3466", shape: { kind: "path", d: OUTLINE } },
      { layer: "disc", fill: "#F9B000", shape: DISC },
    ]);
  });

  it("CA9 : paints only the base layer when the bands and the disc are none", async () => {
    const { tailLayers } = await theme();
    expect(tailLayers(tail("#CFC8BA", NONE, NONE, NONE))).toEqual([
      { layer: "base", fill: "#CFC8BA", shape: { kind: "path", d: OUTLINE } },
    ]);
  });

  it("CA10 : draws in a 300 x 440 viewBox", async () => {
    const { TAIL_VIEWBOX } = await theme();
    expect(TAIL_VIEWBOX).toBe("0 0 300 440");
  });
});
