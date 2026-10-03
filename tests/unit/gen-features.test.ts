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

const gen = (src: string, ...options: string[]) =>
  execFileSync("node", [script, src, ...options], { encoding: "utf8", stdio: "pipe" });
const readGen = (src: string, file = "features.gen.ts") => fs.readFileSync(path.join(src, file), "utf8");
const HEADER = "// Fichier généré par scripts/gen-features.mjs (`pnpm gen`). Ne pas éditer à la main.";

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

  it("generates one registry per runtime entry, in its own output file", () => {
    const src = tmpSrc({ links: null, auth: null, stats: null });
    for (const [feature, file] of [
      ["links", "server.ts"],
      ["links", "client.tsx"],
      ["auth", "server.ts"],
      ["stats", "client.tsx"],
    ] as const)
      fs.writeFileSync(path.join(src, "features", feature, file), "");
    gen(src, "--entry", "server.ts", "--out", "features.server.gen.ts");
    gen(src, "--entry", "client.tsx", "--out", "features.client.gen.ts");
    expect(readGen(src, "features.server.gen.ts")).toBe(
      [
        HEADER,
        'import { feature as authFeature } from "./features/auth/server";',
        'import { feature as linksFeature } from "./features/links/server";',
        "",
        "export const features = [authFeature, linksFeature] as const;",
        "",
      ].join("\n"),
    );
    expect(readGen(src, "features.client.gen.ts")).toContain('from "./features/stats/client";');
    expect(readGen(src, "features.client.gen.ts")).not.toContain("auth");
    expect(fs.existsSync(path.join(src, "features.gen.ts"))).toBe(false);
  });

  it("re-exports the features for a library public surface", () => {
    const src = tmpSrc({ parse: "index.ts", validate: "index.ts" });
    gen(src, "--reexport");
    expect(readGen(src)).toBe(
      [HEADER, 'export * from "./features/parse/index";', 'export * from "./features/validate/index";', ""].join("\n"),
    );
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "gen-features-"));
    dirs.push(empty);
    gen(empty, "--reexport");
    expect(readGen(empty)).toBe(`${HEADER}\nexport {};\n`);
  });

  it.each([
    ["--entry", "sub/server.ts"],
    ["--entry", "server.js"],
    ["--out", "features.ts"],
    ["--out", "../features.gen.ts"],
  ])("refuse l'option %s %s", (option, value) => {
    const src = tmpSrc({ alpha: "index.ts" });
    expect(() => gen(src, option, value)).toThrow(/invalide/);
  });

  it.each(["Bad", "with_underscore", "1digit", "trailing-"])("refuse le nom de feature %s", (name) => {
    const src = tmpSrc({ [name]: "index.ts" });
    expect(() => gen(src)).toThrow(/Nom de feature invalide/);
    expect(fs.existsSync(path.join(src, "features.gen.ts"))).toBe(false);
  });
});
