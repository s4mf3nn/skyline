#!/usr/bin/env node
// Génère les deux tables des livrées à partir de `assets/tails/<CODE>.<png|webp>` :
//   - `livery-codes.gen.ts` : `LIVERY_CODES`, liste pure des codes (lisible sous Vitest) ;
//   - `liveries.gen.ts`     : `LIVERY_SOURCES`, un `require()` littéral par image (exigé par Metro).
// Règle unique : un dossier d'images donne une table ; ajouter ou retirer un fichier ne demande aucun autre changement.
// Usage : node scripts/gen-liveries.mjs [dossier_images] [--out-dir <dossier>]
//   dossier_images  par défaut : assets/tails (absent : tables vides)
//   --out-dir       dossier des fichiers générés (défaut : src/shared/airlines)
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const IMAGE_NAME = /^([A-Z0-9]{3})\.(png|webp)$/;
const HEADER = "// Fichier généré par scripts/gen-liveries.mjs (`pnpm gen`). Ne pas éditer à la main.\n";

/** Images du dossier : `{ code, file }` triées par code. Refuse un sous-dossier ou un nom hors format. */
function listImages(imagesDir) {
  if (!fs.existsSync(imagesDir)) return [];
  const entries = fs.readdirSync(imagesDir, { withFileTypes: true });
  const invalid = entries.filter((e) => !e.isFile() || !IMAGE_NAME.test(e.name)).map((e) => e.name);
  if (invalid.length) {
    throw new Error(`Invalid file in ${imagesDir} (expected <CODE>.png or <CODE>.webp): ${invalid.join(", ")}`);
  }
  return entries
    .map((e) => ({ code: IMAGE_NAME.exec(e.name)[1], file: e.name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function renderCodes(images) {
  const codes = images.map((i) => `  ${JSON.stringify(i.code)},\n`).join("");
  return `${HEADER}\nexport const LIVERY_CODES: readonly string[] = [\n${codes}];\n`;
}

function renderSources(images, imagesDir, outDir) {
  const toImport = (file) => {
    const relative = path.relative(outDir, path.join(imagesDir, file)).replaceAll(path.sep, "/");
    return relative.startsWith(".") ? relative : `./${relative}`;
  };
  const lines = images.map((i) => `  ${JSON.stringify(i.code)}: require(${JSON.stringify(toImport(i.file))}),\n`);
  return [
    HEADER,
    '\nimport type { ImageSourcePropType } from "react-native";\n\n',
    `export const LIVERY_SOURCES: Readonly<Record<string, ImageSourcePropType>> = {\n${lines.join("")}};\n`,
  ].join("");
}

/** Écrit le fichier seulement s'il change ; renvoie le message de suivi. */
function write(target, content) {
  const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (previous !== content) fs.writeFileSync(target, content);
  return `${path.relative(process.cwd(), target)} : ${previous === content ? "unchanged" : "generated"}`;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "out-dir": { type: "string" } },
});
const imagesDir = path.resolve(positionals[0] ?? "assets/tails");
const outDir = path.resolve(values["out-dir"] ?? "src/shared/airlines");
const images = listImages(imagesDir);
fs.mkdirSync(outDir, { recursive: true });
console.log(write(path.join(outDir, "livery-codes.gen.ts"), renderCodes(images)));
console.log(write(path.join(outDir, "liveries.gen.ts"), renderSources(images, imagesDir, outDir)));
