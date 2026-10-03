#!/usr/bin/env node
// Génère `src/features.gen.ts` à partir des `src/features/*/index.ts` (ou `index.tsx`) : chaque feature exporte
// `feature` et est montée par l'application sans qu'aucun fichier central ne soit édité à la main.
// Ce qu'est une `feature` (routes HTTP, écrans, commandes de CLI…) est fixé par SPEC-0000, pas par ce script.
// Usage : node scripts/gen-features.mjs [dossier_src] [--entry <fichier>] [--out <fichier>] [--reexport]
//   dossier_src  par défaut : src
//   --entry      point d'entrée cherché dans chaque feature (défaut : index.ts ou index.tsx). Une feature servie par
//                plusieurs runtimes en a un par runtime (ex. server.ts et client.tsx) : un appel du script par entrée.
//   --out        fichier généré dans dossier_src (défaut : features.gen.ts ; doit finir par .gen.ts)
//   --reexport   génère `export * from` au lieu de la liste `features` : surface publique d'une bibliothèque
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ENTRY_NAME = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*\.tsx?$/;
const OUT_NAME = /^[a-z0-9]+([.-][a-z0-9]+)*\.gen\.ts$/;
const DEFAULT_ENTRIES = ["index.ts", "index.tsx"];
const HEADER = "// Fichier généré par scripts/gen-features.mjs (`pnpm gen`). Ne pas éditer à la main.\n";

/** Premier point d'entrée présent dans la feature, ou null. */
function entryOf(featureDir, entries) {
  return entries.find((file) => fs.existsSync(path.join(featureDir, file))) ?? null;
}

/** Features du dossier qui ont un point d'entrée : `{ name, entry }`, triées par nom. */
function listFeatures(featuresDir, entries) {
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, entry: entryOf(path.join(featuresDir, d.name), entries) }))
    .filter((f) => f.entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Chemin d'import d'une feature, sans extension (`./features/links/index`). */
const importPath = (f) => `./features/${f.name}/${f.entry.replace(/\.tsx?$/, "")}`;

function renderList(features) {
  const id = (f) => `${f.name.replaceAll("-", "_")}Feature`;
  const imports = features.map((f) => `import { feature as ${id(f)} } from "${importPath(f)}";\n`).join("");
  return [
    HEADER,
    imports,
    `${imports ? "\n" : ""}export const features = [${features.map(id).join(", ")}] as const;\n`,
  ];
}

function renderReexport(features) {
  // Un fichier sans export n'est pas un module : `export * from "./features.gen"` échouerait au typage.
  if (!features.length) return [HEADER, "export {};\n"];
  return [HEADER, ...features.map((f) => `export * from "${importPath(f)}";\n`)];
}

function render(features, reexport) {
  const invalid = features.filter((f) => !FEATURE_NAME.test(f.name)).map((f) => f.name);
  if (invalid.length) {
    throw new Error(`Nom de feature invalide (kebab-case attendu) : ${invalid.join(", ")}`);
  }
  return (reexport ? renderReexport(features) : renderList(features)).join("");
}

/** Arguments de la ligne de commande, validés. */
function readOptions() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { entry: { type: "string" }, out: { type: "string" }, reexport: { type: "boolean" } },
  });
  if (values.entry !== undefined && !ENTRY_NAME.test(values.entry))
    throw new Error(`--entry invalide : "${values.entry}" (nom de fichier .ts ou .tsx, sans dossier)`);
  if (values.out !== undefined && !OUT_NAME.test(values.out))
    throw new Error(`--out invalide : "${values.out}" (nom de fichier en .gen.ts, sans dossier)`);
  return {
    srcDir: path.resolve(positionals[0] ?? "src"),
    entries: values.entry === undefined ? DEFAULT_ENTRIES : [values.entry],
    out: values.out ?? "features.gen.ts",
    reexport: values.reexport === true,
  };
}

const { srcDir, entries, out, reexport } = readOptions();
const target = path.join(srcDir, out);
const content = render(listFeatures(path.join(srcDir, "features"), entries), reexport);
const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
if (previous !== content) {
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(target, content);
}
console.log(`${path.relative(process.cwd(), target)} : ${previous === content ? "inchangé" : "généré"}`);
