import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractColors } from "../../scripts/gen-colors.mjs";

// pngjs n'a pas de types : on déclare seulement la partie utilisée ici.
type PngImage = { data: Uint8Array };
const { PNG } = createRequire(import.meta.url)("pngjs") as {
  PNG: { new (options: { width: number; height: number }): PngImage; sync: { write(image: PngImage): Buffer } };
};

type Rgba = [number, number, number, number];
type Colors = { primary: string; secondary: string } | null;

const script = path.resolve("scripts/gen-colors.mjs");
let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Image RGBA : chaque entrée `[pixel, effectif]` est répétée `effectif` fois. */
function image(...groups: [Rgba, number][]) {
  const pixels = groups.flatMap(([pixel, count]) => Array.from({ length: count }, () => pixel));
  return { width: pixels.length, height: 1, data: Uint8ClampedArray.from(pixels.flat()) };
}

const extract = (...groups: [Rgba, number][]): Colors => extractColors(image(...groups));

describe("extractColors", () => {
  it("returns null when no pixel is opaque", () => {
    expect(extract([[200, 0, 0, 127], 4])).toBeNull();
  });

  it("ignores pixels below alpha 128 and keeps alpha 128", () => {
    expect(extract([[200, 0, 0, 128], 1], [[0, 0, 200, 127], 5])).toEqual({
      primary: "#C80000",
      secondary: "#F2E8D5",
    });
  });

  it("prefers colored pixels (chroma >= 40) even when grey pixels are more numerous", () => {
    const result = extract([[100, 100, 100, 255], 5], [[140, 100, 100, 255], 1]);
    expect(result?.primary).toBe("#8C6464");
  });

  it("treats chroma 39 as not colored and falls back to all opaque pixels", () => {
    const result = extract([[100, 100, 100, 255], 5], [[139, 100, 100, 255], 1]);
    expect(result?.primary).toBe("#646464");
  });

  it("averages inside a bin only the pixels kept by the secondary filter", () => {
    // (95, 0, 0) est dans la même case que (80, 0, 0) mais à distance 105 : il n'entre pas dans la moyenne.
    const result = extract([[200, 0, 0, 255], 4], [[80, 0, 0, 255], 1], [[95, 0, 0, 255], 2]);
    expect(result?.secondary).toBe("#500000");
  });

  it("rounds the bin average", () => {
    const result = extract([[200, 0, 0, 255], 1], [[201, 0, 0, 255], 1]);
    expect(result?.primary).toBe("#C90000");
  });

  it("picks the lowest bin index on equal counts", () => {
    const result = extract([[255, 0, 0, 255], 2], [[0, 0, 255, 255], 2]);
    expect(result?.primary).toBe("#0000FF");
  });

  it("picks a secondary at distance >= 120, including white, grey and black", () => {
    const result = extract([[200, 0, 0, 255], 3], [[255, 255, 255, 255], 2], [[0, 0, 0, 255], 1]);
    expect(result).toEqual({ primary: "#C80000", secondary: "#FFFFFF" });
  });

  it("accepts a secondary at distance exactly 120 and rejects 119", () => {
    expect(extract([[200, 0, 0, 255], 3], [[80, 0, 0, 255], 1])?.secondary).toBe("#500000");
    expect(extract([[200, 0, 0, 255], 3], [[81, 0, 0, 255], 1])?.secondary).toBe("#F2E8D5");
  });

  it("falls back to the unknown airline secondary when everything is close to primary", () => {
    expect(extract([[200, 0, 0, 255], 3])?.secondary).toBe("#F2E8D5");
  });
});

/** Dossier temporaire avec `tails/` (fichiers donnés) et `out/` pour le fichier généré. */
function tmpRoot(files: Record<string, Buffer | string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gen-colors-"));
  dirs.push(root);
  fs.mkdirSync(path.join(root, "tails"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(root, "tails", name), content);
  return root;
}

function png(r: number, g: number, b: number, a = 255): Buffer {
  const img = new PNG({ width: 2, height: 2 });
  for (let i = 0; i < 4; i += 1) img.data.set([r, g, b, a], i * 4);
  return PNG.sync.write(img);
}

const args = (root: string) => [script, path.join(root, "tails"), "--out-dir", path.join(root, "out")];
const gen = (root: string) => execFileSync("node", args(root), { encoding: "utf8", stdio: "pipe" });
const target = (root: string) => path.join(root, "out", "colors.gen.ts");

describe("scripts/gen-colors.mjs", () => {
  it("writes LIVERY_COLORS sorted by code and ignores .webp files", () => {
    const root = tmpRoot({ "BBB.png": png(0, 0, 200), "AAA.png": png(200, 0, 0), "CCC.webp": "" });
    gen(root);
    const content = fs.readFileSync(target(root), "utf8");
    expect(content).toContain('"AAA": { primary: "#C80000", secondary: "#F2E8D5" },');
    expect(content).toContain('"BBB": { primary: "#0000C8", secondary: "#F2E8D5" },');
    expect(content.indexOf('"AAA"')).toBeLessThan(content.indexOf('"BBB"'));
    expect(content).not.toContain("CCC");
  });

  it("omits an image without any opaque pixel", () => {
    const root = tmpRoot({ "AAA.png": png(200, 0, 0, 0) });
    gen(root);
    expect(fs.readFileSync(target(root), "utf8")).not.toContain("AAA");
  });

  it("produces an empty table when the images folder is missing", () => {
    const root = tmpRoot({});
    fs.rmdirSync(path.join(root, "tails"));
    gen(root);
    expect(fs.readFileSync(target(root), "utf8")).toContain("= {\n};");
  });

  it("does not rewrite an unchanged file", () => {
    const root = tmpRoot({ "AAA.png": png(200, 0, 0) });
    expect(gen(root)).toContain("generated");
    const before = fs.statSync(target(root)).mtimeMs;
    expect(gen(root)).toContain("unchanged");
    expect(fs.statSync(target(root)).mtimeMs).toBe(before);
  });

  it("fails with code 1 and the file name on an unreadable PNG", () => {
    const root = tmpRoot({ "BAD.png": "not a png" });
    const result = spawnSync("node", args(root), { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BAD.png");
  });
});
