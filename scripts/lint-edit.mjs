#!/usr/bin/env node
// Hook PostToolUse de Claude Code (Edit, Write, MultiEdit) : corrige et contrôle avec Biome le seul fichier édité,
// et renvoie à l'agent les erreurs qui restent.
// Usage : echo '{"tool_input":{"file_path":"src/a.ts"}}' | node scripts/lint-edit.mjs
//   Claude Code envoie un JSON sur l'entrée standard ; le chemin du fichier est dans `tool_input.file_path`.
//   Code 0 : rien à dire (fichier propre, ou hook sans objet). Code 2 : erreurs Biome sur stderr, que Claude Code
//   renvoie à l'agent. Un hook ne bloque jamais l'agent pour une raison étrangère au lint : entrée illisible, chemin
//   absent, fichier supprimé ou hors du dépôt, Biome non installé, tout cela donne 0.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Chemin du fichier édité dans l'entrée du hook ; null si l'entrée est illisible ou sans chemin. */
export function editedFilePath(input) {
  try {
    const filePath = JSON.parse(input)?.tool_input?.file_path;
    return typeof filePath === "string" && filePath !== "" ? filePath : null;
  } catch {
    return null;
  }
}

/** Le fichier est-il dans le dépôt (`root` inclus) ? Un chemin hors du dépôt n'est pas lié par sa configuration Biome. */
export function isInsideRoot(file, root) {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Décision de sortie d'après le résultat de Biome : code 2 et diagnostics s'il reste des erreurs, sinon silence. */
export function hookOutcome(biome) {
  // Biome interrompu (statut absent) : ce n'est pas une erreur de lint, l'agent n'a rien à corriger.
  if (biome.status === 0 || biome.status === null) return { code: 0, message: "" };
  const message = `${biome.stdout ?? ""}${biome.stderr ?? ""}`.trim();
  return { code: 2, message: `Biome signale des erreurs dans le fichier édité, corrige-les :\n${message}` };
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** Lance Biome sur le fichier ; null si Biome n'est pas installé ou ne démarre pas. */
function runBiome(file, root) {
  const bin = path.join(root, "node_modules", ".bin", "biome");
  if (!fs.existsSync(bin)) return null;
  const result = spawnSync(bin, ["check", "--write", "--no-errors-on-unmatched", "--colors=off", file], {
    cwd: root,
    encoding: "utf8",
  });
  return result.error ? null : result;
}

/** Point d'entrée du hook : renvoie `{ code, message }`. */
export function runHook(input, root) {
  const requested = editedFilePath(input);
  if (requested === null) return { code: 0, message: "" };
  const file = path.resolve(root, requested);
  if (!isInsideRoot(file, root) || !fs.existsSync(file)) return { code: 0, message: "" };
  const biome = runBiome(file, root);
  return biome === null ? { code: 0, message: "" } : hookOutcome(biome);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const { code, message } = runHook(readStdin(), root);
  if (message) console.error(message);
  process.exit(code);
}
