import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/gen-features.mjs");
let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Dossier `src` temporaire : chaque feature reçoit le fichier d'entrée donné, ou aucun si la valeur est `null`. */
function tmpSrc(features: Record<string, string | null>): string {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "gen-features-"));
  dirs.push(src);
  for (const [name, entry] of Object.entries(features)) {
    fs.mkdirSync(path.join(src, "features", name), { recursive: true });
    if (entry !== null) fs.writeFileSync(path.join(src, "features", name, entry), "");
  }
  return src;
}

const gen = (src: string) => execFileSync("node", [script, src], { encoding: "utf8", stdio: "pipe" });
const readGen = (src: string) => fs.readFileSync(path.join(src, "features.gen.ts"), "utf8");

describe("scripts/gen-features.mjs", () => {
  it("lists features alphabetically, accepts index.ts or index.tsx and skips folders without entry file", () => {
    const src = tmpSrc({ zeta: "index.tsx", alpha: "index.ts", "no-entry": null, "multi-word-name": "index.ts" });
    fs.writeFileSync(path.join(src, "features", "stray.ts"), "");
    gen(src);
    expect(readGen(src)).toBe(
      [
        "// Fichier généré par scripts/gen-features.mjs (`pnpm gen`). Ne pas éditer à la main.",
        'import { feature as alphaFeature } from "./features/alpha/index";',
        'import { feature as multi_word_nameFeature } from "./features/multi-word-name/index";',
        'import { feature as zetaFeature } from "./features/zeta/index";',
        "",
        "export const features = [alphaFeature, multi_word_nameFeature, zetaFeature] as const;",
        "",
      ].join("\n"),
    );
  });

  it("génère une liste vide sans dossier features", () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "gen-features-"));
    dirs.push(src);
    gen(src);
    expect(readGen(src)).toBe(
      "// Fichier généré par scripts/gen-features.mjs (`pnpm gen`). Ne pas éditer à la main.\nexport const features = [] as const;\n",
    );
  });

  it("ne réécrit pas un fichier inchangé", () => {
    const src = tmpSrc({ alpha: "index.ts" });
    expect(gen(src)).toContain("généré");
    const before = fs.statSync(path.join(src, "features.gen.ts")).mtimeMs;
    expect(gen(src)).toContain("inchangé");
    expect(fs.statSync(path.join(src, "features.gen.ts")).mtimeMs).toBe(before);
  });

  it.each(["Bad", "with_underscore", "1digit", "trailing-"])("refuse le nom de feature %s", (name) => {
    const src = tmpSrc({ [name]: "index.ts" });
    expect(() => gen(src)).toThrow(/Nom de feature invalide/);
    expect(fs.existsSync(path.join(src, "features.gen.ts"))).toBe(false);
  });
});
