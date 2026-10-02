#!/usr/bin/env node
// Génère `src/routes.gen.ts` à partir des `src/features/*/routes.ts` : chaque feature exporte `routes`
// et est montée par `createApp` sans qu'aucun fichier central ne soit édité à la main.
// Usage : node scripts/gen-routes.mjs [dossier_src]   (par défaut : src)
import fs from "node:fs";
import path from "node:path";

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function listFeatures(featuresDir) {
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(featuresDir, d.name, "routes.ts")))
    .map((d) => d.name)
    .sort();
}

function render(features) {
  const invalid = features.filter((f) => !FEATURE_NAME.test(f));
  if (invalid.length) {
    throw new Error(`Nom de feature invalide (kebab-case attendu) : ${invalid.join(", ")}`);
  }
  const id = (f) => `${f.replaceAll("-", "_")}Routes`;
  const imports = features.map((f) => `import { routes as ${id(f)} } from "./features/${f}/routes";\n`).join("");
  return [
    "// Fichier généré par scripts/gen-routes.mjs (`pnpm gen`). Ne pas éditer à la main.\n",
    imports,
    `${imports ? "\n" : ""}export const routes = [${features.map(id).join(", ")}] as const;\n`,
  ].join("");
}

const srcDir = path.resolve(process.argv[2] ?? "src");
const target = path.join(srcDir, "routes.gen.ts");
const content = render(listFeatures(path.join(srcDir, "features")));
const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
if (previous !== content) {
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(target, content);
}
console.log(`${path.relative(process.cwd(), target)} : ${previous === content ? "inchangé" : "généré"}`);
