#!/usr/bin/env node
// Génère `colors.gen.ts` (`LIVERY_COLORS`) : pour chaque `assets/tails/<CODE>.png`, la couleur primaire et la
// couleur secondaire dominantes de la dérive, au format `#RRGGBB`. Les `.webp` sont ignorés.
// Usage : node scripts/gen-colors.mjs [dossier_images] [--out-dir <dossier>]
//   dossier_images  par défaut : assets/tails (absent : table vide)
//   --out-dir       dossier du fichier généré (défaut : src/shared/airlines)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { PNG } from "pngjs";

const ALPHA_MIN = 128; // un pixel dont l'alpha est inférieur est ignoré
const CHROMA_MIN = 40; // écart max − min des canaux d'un pixel « coloré »
const DISTANCE_MIN = 120; // distance RGB minimale entre secondaire et primaire
const FALLBACK_SECONDARY = "#F2E8D5"; // secondaire de UNKNOWN_AIRLINE
const PNG_NAME = /^([A-Z0-9]{3})\.png$/;
const HEADER = "// Fichier généré par scripts/gen-colors.mjs (`pnpm gen`). Ne pas éditer à la main.\n";

const toHex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Couleur de la case de 512 (canal >> 5) la plus peuplée parmi `pixels`, moyennée ; `null` si aucun pixel. */
function dominant(pixels) {
  const bins = new Map();
  for (const [r, g, b] of pixels) {
    const index = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bin = bins.get(index) ?? { index, count: 0, sum: [0, 0, 0] };
    bin.count += 1;
    bin.sum[0] += r;
    bin.sum[1] += g;
    bin.sum[2] += b;
    bins.set(index, bin);
  }
  let best = null;
  for (const bin of bins.values()) {
    // À effectif égal, l'indice de case le plus bas l'emporte.
    if (best === null || bin.count > best.count || (bin.count === best.count && bin.index < best.index)) best = bin;
  }
  return best === null ? null : best.sum.map((total) => Math.round(total / best.count));
}

/** Couleurs primaire et secondaire d'une image RGBA ; `null` si aucun pixel n'est opaque. */
export function extractColors({ width, height, data }) {
  const opaque = [];
  for (let i = 0; i < width * height * 4; i += 4) {
    if (data[i + 3] >= ALPHA_MIN) opaque.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (opaque.length === 0) return null;
  const colored = opaque.filter((p) => Math.max(...p) - Math.min(...p) >= CHROMA_MIN);
  const primary = dominant(colored.length > 0 ? colored : opaque);
  const far = opaque.filter((p) => Math.hypot(p[0] - primary[0], p[1] - primary[1], p[2] - primary[2]) >= DISTANCE_MIN);
  const secondary = dominant(far);
  return { primary: toHex(primary), secondary: secondary === null ? FALLBACK_SECONDARY : toHex(secondary) };
}

/** PNG du dossier, triés par code. */
function listPngs(imagesDir) {
  if (!fs.existsSync(imagesDir)) return [];
  return fs
    .readdirSync(imagesDir)
    .filter((name) => PNG_NAME.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function render(colors) {
  const lines = colors.map(
    ([code, c]) =>
      `  ${JSON.stringify(code)}: { primary: ${JSON.stringify(c.primary)}, secondary: ${JSON.stringify(c.secondary)} },\n`,
  );
  return `${HEADER}\nexport const LIVERY_COLORS: Readonly<Record<string, { primary: string; secondary: string }>> = {\n${lines.join("")}};\n`;
}

/** Écrit le fichier seulement s'il change ; renvoie le message de suivi. */
function write(target, content) {
  const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (previous !== content) fs.writeFileSync(target, content);
  return `${path.relative(process.cwd(), target)} : ${previous === content ? "unchanged" : "generated"}`;
}

function readColors(imagesDir) {
  const colors = [];
  for (const name of listPngs(imagesDir)) {
    const file = path.join(imagesDir, name);
    let image;
    try {
      image = PNG.sync.read(fs.readFileSync(file));
    } catch (error) {
      throw new Error(`Unreadable PNG ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const extracted = extractColors(image);
    if (extracted !== null) colors.push([PNG_NAME.exec(name)[1], extracted]);
  }
  return colors;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "out-dir": { type: "string" } },
  });
  const imagesDir = path.resolve(positionals[0] ?? "assets/tails");
  const outDir = path.resolve(values["out-dir"] ?? "src/shared/airlines");
  try {
    const content = render(readColors(imagesDir));
    fs.mkdirSync(outDir, { recursive: true });
    console.log(write(path.join(outDir, "colors.gen.ts"), content));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
