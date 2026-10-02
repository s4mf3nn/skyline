#!/usr/bin/env node
// Lance `pnpm verify` en silence : une ligne si tout est vert, sinon seulement les lignes utiles (erreurs).
// La sortie complète est conservée dans .context/verify.log (hors git) pour les cas où le filtre cache l'essentiel.
// Même code de sortie que `pnpm verify`, qui reste la commande de référence (CLAUDE.md).
// Usage : pnpm verify:quiet
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_LINES = 120;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Ligne du tableau de couverture v8 (colonnes séparées par `|`, pourcentages). */
const isCoverageRow = (l) =>
  /\|\s*%/.test(l) || ((l.match(/\|/g)?.length ?? 0) >= 2 && /(\d+(\.\d+)?|-+)\s*\|/.test(l) && !/error|fail/i.test(l));
/** Ligne de test réussi, de progression ou de bruit pnpm. */
const isNoise = (l) =>
  /^\s*(✓|√|·)/.test(l) ||
  /^\s*$/.test(l) ||
  /^(>|Progress:|Scope:|\.\.\.)/.test(l) ||
  /^\s*(RUN|Duration|Start at|Transform|Test Files)\b/.test(l) ||
  /^\s*% Coverage report/.test(l);

/** Garde les lignes d'erreur (et leur contexte proche), sans le tableau de couverture ni les tests réussis. */
export function filterOutput(output, maxLines = MAX_LINES) {
  const kept = output
    .split("\n")
    .map((l) => l.replace(ANSI, ""))
    .filter((l) => !isCoverageRow(l) && !isNoise(l));
  if (kept.length <= maxLines) return kept.join("\n");
  const head = Math.floor(maxLines / 3);
  const omitted = kept.length - maxLines;
  return [
    ...kept.slice(0, head),
    `[… ${omitted} lignes omises, voir le log complet …]`,
    ...kept.slice(-(maxLines - head)),
  ].join("\n");
}

function main() {
  const res = spawnSync("pnpm", ["verify"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const logFile = path.join(".context", "verify.log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, output);
  if (res.status === 0) {
    console.log(`verify OK (log complet : ${logFile})`);
    return 0;
  }
  console.error(filterOutput(output));
  console.error(`\nverify ÉCHEC (code ${res.status ?? res.error?.message ?? res.signal}). Log complet : ${logFile}`);
  return res.status ?? 1;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) process.exit(main());
