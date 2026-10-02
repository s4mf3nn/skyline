import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/gen-routes.mjs");
let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function tmpSrc(features: Record<string, string | null>): string {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "gen-routes-"));
  dirs.push(src);
  for (const [name, body] of Object.entries(features)) {
    fs.mkdirSync(path.join(src, "features", name), { recursive: true });
    if (body !== null) fs.writeFileSync(path.join(src, "features", name, "routes.ts"), body);
  }
  return src;
}

const gen = (src: string) => execFileSync("node", [script, src], { encoding: "utf8", stdio: "pipe" });
const readGen = (src: string) => fs.readFileSync(path.join(src, "routes.gen.ts"), "utf8");

describe("scripts/gen-routes.mjs", () => {
  it("liste les features dans l'ordre alphabétique et ignore les dossiers sans routes.ts", () => {
    const src = tmpSrc({ zeta: "", alpha: "", "no-routes": null, "multi-word-name": "" });
    fs.writeFileSync(path.join(src, "features", "stray.ts"), "");
    gen(src);
    expect(readGen(src)).toBe(
      [
        "// Fichier généré par scripts/gen-routes.mjs (`pnpm gen`). Ne pas éditer à la main.",
        'import { routes as alphaRoutes } from "./features/alpha/routes";',
        'import { routes as multi_word_nameRoutes } from "./features/multi-word-name/routes";',
        'import { routes as zetaRoutes } from "./features/zeta/routes";',
        "",
        "export const routes = [alphaRoutes, multi_word_nameRoutes, zetaRoutes] as const;",
        "",
      ].join("\n"),
    );
  });

  it("génère une liste vide sans dossier features", () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "gen-routes-"));
    dirs.push(src);
    gen(src);
    expect(readGen(src)).toBe(
      "// Fichier généré par scripts/gen-routes.mjs (`pnpm gen`). Ne pas éditer à la main.\nexport const routes = [] as const;\n",
    );
  });

  it("ne réécrit pas un fichier inchangé", () => {
    const src = tmpSrc({ alpha: "" });
    expect(gen(src)).toContain("généré");
    const before = fs.statSync(path.join(src, "routes.gen.ts")).mtimeMs;
    expect(gen(src)).toContain("inchangé");
    expect(fs.statSync(path.join(src, "routes.gen.ts")).mtimeMs).toBe(before);
  });

  it.each(["Bad", "with_underscore", "1digit", "trailing-"])("refuse le nom de feature %s", (name) => {
    const src = tmpSrc({ [name]: "" });
    expect(() => gen(src)).toThrow(/Nom de feature invalide/);
    expect(fs.existsSync(path.join(src, "routes.gen.ts"))).toBe(false);
  });
});
