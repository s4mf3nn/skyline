import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0012 (Vitest) : extraction et table des compagnies avec d'autres données que le contrat.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Pixels {
  width: number;
  height: number;
  data: Uint8Array;
}
interface Airline {
  code: string;
  iata: readonly string[];
  primary: string;
  secondary: string;
}
interface AirlinesModule {
  AIRLINES: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): { bg: string; big: string; small: string };
  contrastRatio(a: string, b: string): number;
}
interface GenColorsModule {
  extractColors(image: Pixels): { primary: string; secondary: string } | null;
}
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), body])));
  return Buffer.concat([head, Buffer.from(type), body, crc]);
}
function png({ width, height, data }: Pixels): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) rows.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
/** Carré `size`×`size` : la couleur de chaque pixel vient de `paint(x, y)`. */
function square(size: number, paint: (x: number, y: number) => [number, number, number, number]): Pixels {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.set(paint(x, y), (y * size + x) * 4);
  return { width: size, height: size, data };
}
function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec-0012-holdout-"));
}

describe("SPEC-0012 holdout : couleurs des compagnies", () => {
  it("reads a tail on a transparent background: the stripes win, the white band is the secondary", async () => {
    const { extractColors } = await load<GenColorsModule>("scripts/gen-colors.mjs");
    // Fond transparent à gauche, aplat vert en haut, bande blanche en bas à droite, dégradé léger dans le vert.
    const tail = square(20, (x, y) => {
      if (x < 6) return [0, 0, 0, 0];
      if (y >= 16) return [255, 255, 255, 255];
      return [0, 128 + (x % 2), 64, 255];
    });
    const colors = extractColors(tail);
    expect(colors?.secondary).toBe("#FFFFFF");
    // Les deux nuances de vert tombent dans la même case : la moyenne arrondie est celle des 160 pixels.
    expect(colors?.primary).toMatch(/^#00(80|81)40$/);
    expect(extractColors(square(8, () => [255, 0, 0, 0]))).toBeNull();
  });

  it("generates the table from a folder: same result twice, null image left out, grey livery kept", () => {
    const images = tmp();
    const out = tmp();
    fs.writeFileSync(path.join(images, "QQA.png"), png(square(10, () => [30, 144, 255, 255])));
    fs.writeFileSync(path.join(images, "QQB.png"), png(square(10, () => [0, 0, 0, 0])));
    fs.writeFileSync(
      path.join(images, "QQC.png"),
      png(square(10, (x) => (x < 7 ? [90, 90, 90, 255] : [240, 240, 240, 255]))),
    );
    const run = () =>
      spawnSync(process.execPath, ["scripts/gen-colors.mjs", images, "--out-dir", out], { encoding: "utf8" });
    expect(run().status).toBe(0);
    const first = fs.readFileSync(path.join(out, "colors.gen.ts"), "utf8");
    expect(first).toContain("QQA");
    expect(first).toContain("#1E90FF");
    expect(first).not.toContain("QQB");
    expect(first).toContain("QQC");
    expect(first).toContain("#5A5A5A");
    expect(first).toContain("#F0F0F0");
    expect(run().status).toBe(0);
    expect(fs.readFileSync(path.join(out, "colors.gen.ts"), "utf8")).toBe(first);
  });

  it("gives the extracted colours whatever the callsign form, and the unknown ones to a stranger", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE, resolveAirline, airlineTheme, contrastRatio } = await airlines();
    const tails = fs.readdirSync(path.resolve("assets/tails")).filter((name) => name.endsWith(".png"));
    const picked = AIRLINES.filter(
      (airline) =>
        tails.includes(`${airline.code}.png`) &&
        airline.primary !== UNKNOWN_AIRLINE.primary &&
        airline.iata.length > 0 &&
        resolveAirline(`${airline.code}77`).code === airline.code,
    );
    expect(picked.length).toBeGreaterThanOrEqual(50);
    for (const airline of picked.slice(0, 40)) {
      const oaci = resolveAirline(` ${airline.code.toLowerCase()}77 `);
      expect(oaci.primary).toBe(airline.primary);
      expect(oaci.secondary).toBe(airline.secondary);
      const theme = airlineTheme(oaci);
      expect(theme.bg).toBe(airline.primary);
      expect(contrastRatio(theme.small, theme.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(resolveAirline("ZZZ9999")).toBe(UNKNOWN_AIRLINE);
    expect(resolveAirline(null).primary).toBe("#1D1D1B");
  });
});
