#!/usr/bin/env node
// Génère `src/features.gen.ts` à partir des `src/features/*/index.ts` (ou `index.tsx`) : chaque feature exporte
// `feature` et est montée par l'application sans qu'aucun fichier central ne soit édité à la main.
// Ce qu'est une `feature` (routes HTTP, écrans, commandes de CLI…) est fixé par SPEC-0000, pas par ce script.
// Usage : node scripts/gen-features.mjs [dossier_src]   (par défaut : src)
import fs from "node:fs";
import path from "node:path";

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const ENTRY_FILES = ["index.ts", "index.tsx"];

function hasEntry(featureDir) {
  return ENTRY_FILES.some((file) => fs.existsSync(path.join(featureDir, file)));
}

function listFeatures(featuresDir) {
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && hasEntry(path.join(featuresDir, d.name)))
    .map((d) => d.name)
    .sort();
}

function render(features) {
  const invalid = features.filter((f) => !FEATURE_NAME.test(f));
  if (invalid.length) {
    throw new Error(`Nom de feature invalide (kebab-case attendu) : ${invalid.join(", ")}`);
  }
  const id = (f) => `${f.replaceAll("-", "_")}Feature`;
  const imports = features.map((f) => `import { feature as ${id(f)} } from "./features/${f}/index";\n`).join("");
  return [
    "// Fichier généré par scripts/gen-features.mjs (`pnpm gen`). Ne pas éditer à la main.\n",
    imports,
    `${imports ? "\n" : ""}export const features = [${features.map(id).join(", ")}] as const;\n`,
  ].join("");
}

const srcDir = path.resolve(process.argv[2] ?? "src");
const target = path.join(srcDir, "features.gen.ts");
const content = render(listFeatures(path.join(srcDir, "features")));
const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
if (previous !== content) {
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(target, content);
}
console.log(`${path.relative(process.cwd(), target)} : ${previous === content ? "inchangé" : "généré"}`);
