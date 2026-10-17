import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0012 (Vitest) : couleurs des compagnies extraites des dérives de assets/tails/.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Pixels {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}
interface Colors {
  primary: string;
  secondary: string;
}
interface GenColorsModule {
  extractColors(image: Pixels): Colors | null;
}
interface Airline {
  code: string;
  name: string;
  iata: readonly string[];
  icao: readonly string[];
  primary: string;
  secondary: string;
  tail: unknown;
}
interface AirlinesModule {
  AIRLINES: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): { bg: string; big: string; small: string; track: string };
  contrastRatio(a: string, b: string): number;
}
interface ColorsGenModule {
  LIVERY_COLORS: Readonly<Record<string, Colors>>;
}

const HEX = /^#[0-9A-F]{6}$/;
const UNKNOWN_SECONDARY = "#F2E8D5";
const HANDOFF: Record<string, Colors> = {
  AFR: { primary: "#0B1F4B", secondary: "#F4F1EA" },
  EZY: { primary: "#FF6600", secondary: "#FFFFFF" },
  IBE: { primary: "#C8102E", secondary: "#F6C344" },
  KLM: { primary: "#00A1DE", secondary: "#003145" },
  DLH: { primary: "#0A1D3D", secondary: "#F9B000" },
  RYR: { primary: "#073590", secondary: "#F1C933" },
  TAP: { primary: "#1E6F4A", secondary: "#F4F1EA" },
  VLG: { primary: "#FFCC00", secondary: "#3C3C3B" },
};
const TAILS_DIR = path.resolve("assets/tails");
const GEN_FILE = path.resolve("src/shared/airlines/colors.gen.ts");
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");
const genColors = () => load<GenColorsModule>("scripts/gen-colors.mjs");

type Rgba = [number, number, number, number];
/** Image d'une rangée : `count` pixels de chaque couleur, dans l'ordre. */
function pixels(...runs: Array<[Rgba, number]>): Pixels {
  const data: number[] = [];
  for (const [color, count] of runs) for (let i = 0; i < count; i++) data.push(...color);
  return { width: data.length / 4, height: 1, data: new Uint8Array(data) };
}

function crc32Chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), body])));
  return Buffer.concat([head, Buffer.from(type), body, crc]);
}
/** PNG RGBA 8 bits minimal (sans filtre), pour fabriquer des images de test. */
function encodePng({ width, height, data }: Pixels): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rows.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    crc32Chunk("IHDR", ihdr),
    crc32Chunk("IDAT", zlib.deflateSync(rows)),
    crc32Chunk("IEND", Buffer.alloc(0)),
  ]);
}

function runGen(imagesDir: string, outDir: string) {
  return spawnSync(process.execPath, ["scripts/gen-colors.mjs", imagesDir, "--out-dir", outDir], { encoding: "utf8" });
}
function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec-0012-"));
}
function pngCodes(): string[] {
  return fs
    .readdirSync(TAILS_DIR)
    .filter((name) => name.endsWith(".png"))
    .map((name) => name.slice(0, -4));
}

describe.skip("SPEC-0012 Couleurs des compagnies (extraction)", () => {
  it("CA1 : returns primary and secondary as uppercase hex, and null without any opaque pixel", async () => {
    const { extractColors } = await genColors();
    expect(extractColors(pixels([[255, 0, 0, 255], 10]))).toEqual({ primary: "#FF0000", secondary: UNKNOWN_SECONDARY });
    expect(extractColors(pixels([[10, 20, 30, 0], 5], [[200, 0, 0, 127], 5]))).toBeNull();
    expect(extractColors({ width: 0, height: 0, data: new Uint8Array(0) })).toBeNull();
  });

  it("CA1 : ignores pixels below alpha 128 and counts alpha 128", async () => {
    const { extractColors } = await genColors();
    const result = extractColors(pixels([[0, 255, 0, 127], 50], [[0, 0, 255, 128], 1]));
    expect(result?.primary).toBe("#0000FF");
  });

  it("CA2 : a bucket colour is the rounded mean of its pixels", async () => {
    const { extractColors } = await genColors();
    const result = extractColors(pixels([[255, 0, 0, 255], 2], [[225, 0, 0, 255], 2]));
    expect(result?.primary).toBe("#F00000");
    const odd = extractColors(pixels([[224, 0, 0, 255], 1], [[225, 0, 0, 255], 2]));
    expect(odd?.primary).toBe("#E10000");
  });

  it("CA2 : on equal counts, the bucket with the lowest index wins", async () => {
    const { extractColors } = await genColors();
    const result = extractColors(pixels([[255, 0, 0, 255], 2], [[0, 0, 255, 255], 2]));
    expect(result).toEqual({ primary: "#0000FF", secondary: "#FF0000" });
  });

  it("CA3 : primary comes from coloured pixels only, chroma 40 being coloured and 39 not", async () => {
    const { extractColors } = await genColors();
    const result = extractColors(pixels([[100, 100, 139, 255], 10], [[100, 100, 140, 255], 1]));
    expect(result?.primary).toBe("#64648C");
    expect(result?.secondary).not.toBe("#64648C");
  });

  it("CA3 : a livery without any coloured pixel takes primary among all opaque pixels", async () => {
    const { extractColors } = await genColors();
    const result = extractColors(pixels([[128, 128, 128, 255], 4], [[30, 30, 30, 255], 2]));
    expect(result).toEqual({ primary: "#808080", secondary: "#1E1E1E" });
  });

  it("CA4 : white and grey count for secondary, and a single-colour livery falls back to the unknown secondary", async () => {
    const { extractColors } = await genColors();
    const result = extractColors(pixels([[255, 255, 255, 255], 20], [[200, 16, 46, 255], 5]));
    expect(result).toEqual({ primary: "#C8102E", secondary: "#FFFFFF" });
    const near = extractColors(pixels([[200, 16, 46, 255], 5], [[210, 30, 60, 255], 9]));
    expect(near?.secondary).toBe(UNKNOWN_SECONDARY);
  });

  it("CA4 : secondary keeps pixels at distance 120 and drops those just under", async () => {
    const { extractColors } = await genColors();
    // Distance 120 exactement (120, 0, 0) : retenue ; 119 : écartée au profit de la couleur suivante.
    const kept = extractColors(pixels([[0, 0, 200, 255], 10], [[120, 0, 200, 255], 3]));
    expect(kept).toEqual({ primary: "#0000C8", secondary: "#7800C8" });
    const dropped = extractColors(pixels([[0, 0, 200, 255], 10], [[119, 0, 200, 255], 3], [[255, 255, 255, 255], 1]));
    expect(dropped?.secondary).toBe("#FFFFFF");
  });

  it("CA5 : writes colors.gen.ts sorted by code, skips webp, and leaves an unchanged file alone", async () => {
    const images = tmpDir();
    const out = tmpDir();
    fs.writeFileSync(path.join(images, "ZZB.png"), encodePng(pixels([[0, 0, 200, 255], 4], [[255, 255, 255, 255], 2])));
    fs.writeFileSync(path.join(images, "AAA.png"), encodePng(pixels([[200, 16, 46, 255], 4])));
    fs.writeFileSync(path.join(images, "WWW.webp"), "not decoded");
    const first = runGen(images, out);
    expect(first.status).toBe(0);
    const text = fs.readFileSync(path.join(out, "colors.gen.ts"), "utf8");
    expect(text).toContain("LIVERY_COLORS");
    expect(text.indexOf("AAA")).toBeGreaterThan(-1);
    expect(text.indexOf("AAA")).toBeLessThan(text.indexOf("ZZB"));
    expect(text).toContain("#C8102E");
    expect(text).toContain("#0000C8");
    expect(text).not.toContain("WWW");
    const before = fs.statSync(path.join(out, "colors.gen.ts")).mtimeMs;
    expect(runGen(images, out).status).toBe(0);
    expect(fs.statSync(path.join(out, "colors.gen.ts")).mtimeMs).toBe(before);
    expect(fs.readFileSync(path.join(out, "colors.gen.ts"), "utf8")).toBe(text);
  });

  it("CA5 : fails with the file name when a PNG is unreadable", () => {
    const images = tmpDir();
    fs.writeFileSync(path.join(images, "BAD.png"), "not a png");
    const result = runGen(images, tmpDir());
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("BAD.png");
  });

  it("CA10 : the committed colors.gen.ts equals a fresh generation on assets/tails", () => {
    const out = tmpDir();
    expect(runGen(TAILS_DIR, out).status).toBe(0);
    expect(fs.readFileSync(GEN_FILE, "utf8")).toBe(fs.readFileSync(path.join(out, "colors.gen.ts"), "utf8"));
  });
});

describe.skip("SPEC-0012 Couleurs des compagnies (table)", () => {
  it("CA6 : an airline with a livery and no handoff colours takes the extracted colours, nothing else changes", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE, resolveAirline } = await airlines();
    const { LIVERY_COLORS } = await load<ColorsGenModule>("src/shared/airlines/colors.gen.ts");
    const extracted = pngCodes().filter((code) => !(code in HANDOFF));
    expect(extracted.length).toBeGreaterThanOrEqual(100);
    let different = 0;
    for (const code of extracted) {
      const airline = AIRLINES.find((candidate) => candidate.code === code);
      expect(airline, code).toBeDefined();
      if (airline === undefined) continue;
      expect(LIVERY_COLORS[code], code).toBeDefined();
      expect(airline.primary).toBe(LIVERY_COLORS[code]?.primary);
      expect(airline.secondary).toBe(LIVERY_COLORS[code]?.secondary);
      expect(airline.primary).toMatch(HEX);
      expect(airline.secondary).toMatch(HEX);
      expect(airline.tail).toEqual(UNKNOWN_AIRLINE.tail);
      expect(resolveAirline(`${code}123`).primary).toBe(airline.primary);
      if (airline.primary !== UNKNOWN_AIRLINE.primary) different++;
    }
    expect(different).toBeGreaterThanOrEqual(100);
  });

  it("CA7 : the 8 handoff airlines keep their colours and their tail palette", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE } = await airlines();
    for (const [code, colors] of Object.entries(HANDOFF)) {
      const airline = AIRLINES.find((candidate) => candidate.code === code);
      expect(airline?.primary, code).toBe(colors.primary);
      expect(airline?.secondary, code).toBe(colors.secondary);
      expect(airline?.tail, code).not.toEqual(UNKNOWN_AIRLINE.tail);
    }
  });

  it("CA8 : an airline without a PNG livery keeps the unknown colours, and the unknown airline is unchanged", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE } = await airlines();
    const withPng = new Set(pngCodes());
    const without = AIRLINES.filter((airline) => !withPng.has(airline.code) && !(airline.code in HANDOFF));
    expect(without.length).toBeGreaterThan(0);
    for (const airline of without) {
      expect(airline.primary, airline.code).toBe(UNKNOWN_AIRLINE.primary);
      expect(airline.secondary, airline.code).toBe(UNKNOWN_AIRLINE.secondary);
    }
    expect(UNKNOWN_AIRLINE.code).toBe("xx");
    expect(UNKNOWN_AIRLINE.primary).toBe("#1D1D1B");
    expect(UNKNOWN_AIRLINE.secondary).toBe(UNKNOWN_SECONDARY);
  });

  it("CA9 : every airline theme keeps big at 3:1 and small at 4.5:1 on its background", async () => {
    const { AIRLINES, airlineTheme, contrastRatio } = await airlines();
    for (const airline of AIRLINES) {
      const theme = airlineTheme(airline);
      expect(theme.bg).toBe(airline.primary);
      expect(contrastRatio(theme.big, theme.bg), airline.code).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.small, theme.bg), airline.code).toBeGreaterThanOrEqual(4.5);
    }
  });
});
