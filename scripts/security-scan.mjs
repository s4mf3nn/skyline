#!/usr/bin/env node
// Lance en local les mêmes scans de sécurité que la CI (Semgrep et gitleaks), avant l'ouverture de la PR.
// Usage :
//   node scripts/security-scan.mjs [semgrep|gitleaks|all]   (défaut : all)
// Outil absent : avertissement et code 0 en local ; échec (code 1) quand `CI` est défini.
// Une détection fait échouer le script (code 1) dans tous les cas.
// Variables : BASE_REF (défaut origin/main) borne le scan gitleaks aux commits de la branche.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const base = process.env.BASE_REF ?? "origin/main";

/** Mêmes arguments que le job `security` de `.github/workflows/ci.yml` (Semgrep). */
export const TOOLS = {
  semgrep: {
    args: ["scan", "--config", "auto", "--error", "--exclude", "tests"],
    install: "pipx install semgrep==1.179.0",
  },
  gitleaks: {
    // La config `.gitleaks.toml` à la racine est lue automatiquement.
    args: ["git", `--log-opts=${base}..HEAD`, "--redact", "--no-banner", "--no-color"],
    install: "brew install gitleaks",
  },
};

/** `bin` est-il exécutable dans l'un des dossiers de `pathVar` ? (sans shell, sans `which`) */
export function isInstalled(bin, pathVar = process.env.PATH ?? "") {
  return pathVar.split(path.delimiter).some((dir) => {
    if (!dir) return false;
    try {
      fs.accessSync(path.join(dir, bin), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/** Renvoie `{ code, message? }` pour un outil : 0 passé ou ignoré (avertissement), 1 détection ou échec. */
export function scan(tool, { env = process.env, run = defaultRun } = {}) {
  const spec = TOOLS[tool];
  if (!spec) return { code: 1, message: `Outil inconnu : "${tool}" (semgrep, gitleaks ou all attendu)` };
  if (!isInstalled(tool, env.PATH)) {
    const message = `${tool} n'est pas installé (${spec.install}) : scan non fait en local, la CI le fera.`;
    return env.CI
      ? { code: 1, message: `${message} En CI c'est une erreur.` }
      : { code: 0, message: `Avertissement : ${message}` };
  }
  const status = run(tool, spec.args);
  return status === 0 ? { code: 0 } : { code: 1, message: `${tool} a signalé des constats (code ${status}).` };
}

function defaultRun(bin, args) {
  return spawnSync(bin, args, { stdio: "inherit" }).status ?? 1;
}

function main() {
  const arg = process.argv[2] ?? "all";
  const tools = arg === "all" ? Object.keys(TOOLS) : [arg];
  let code = 0;
  for (const tool of tools) {
    const res = scan(tool);
    if (res.message) (res.code === 0 ? console.warn : console.error)(res.message);
    code = Math.max(code, res.code);
  }
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
