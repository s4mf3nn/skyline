import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/gen-liveries.mjs");
let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Racine temporaire avec `tails/` (fichiers donnés, ou absent si `null`) et `out/` pour les fichiers générés. */
function tmpRoot(files: string[] | null): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gen-liveries-"));
  dirs.push(root);
  if (files !== null) {
    fs.mkdirSync(path.join(root, "tails"));
    for (const file of files) fs.writeFileSync(path.join(root, "tails", file), "");
  }
  return root;
}

const gen = (root: string) =>
  execFileSync("node", [script, path.join(root, "tails"), "--out-dir", path.join(root, "out")], {
    encoding: "utf8",
    stdio: "pipe",
  });
const read = (root: string, file: string) => fs.readFileSync(path.join(root, "out", file), "utf8");

describe("scripts/gen-liveries.mjs", () => {
  it("produces empty tables when the images folder is missing", () => {
    const root = tmpRoot(null);
    gen(root);
    expect(read(root, "livery-codes.gen.ts")).toContain("LIVERY_CODES: readonly string[] = [\n];");
    expect(read(root, "liveries.gen.ts")).toContain(
      "LIVERY_SOURCES: Readonly<Record<string, ImageSourcePropType>> = {\n};",
    );
  });

  it("sorts codes and accepts png and webp", () => {
    const root = tmpRoot(["VLG.webp", "AFR.png", "IBE.png"]);
    gen(root);
    expect(read(root, "livery-codes.gen.ts")).toContain('  "AFR",\n  "IBE",\n  "VLG",\n];');
    const sources = read(root, "liveries.gen.ts");
    expect(sources).toContain('"AFR": require("../tails/AFR.png"),');
    expect(sources).toContain('"VLG": require("../tails/VLG.webp"),');
    expect(sources.indexOf('"AFR"')).toBeLessThan(sources.indexOf('"IBE"'));
  });

  it("is idempotent", () => {
    const root = tmpRoot(["AFR.png"]);
    gen(root);
    expect(gen(root)).toContain("inchangé");
  });

  it.each(["afr.png", "AFRA.png", "AF.png", "AFR.jpg", "AFR.png.bak"])("refuses the file name %s", (name) => {
    expect(() => gen(tmpRoot([name]))).toThrow(/Fichier invalide/);
  });

  it("refuses a sub-folder", () => {
    const root = tmpRoot(["AFR.png"]);
    fs.mkdirSync(path.join(root, "tails", "ABC.png"));
    expect(() => gen(root)).toThrow(/Fichier invalide/);
  });
});
