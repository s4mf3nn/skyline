#!/usr/bin/env node
// Contrôle que le plan d'une spec est fusionné sur la base (origin/main) avant d'implémenter ses tâches, et que les
// specs dont elle dépend sont livrées.
// Les nouveaux workspaces Conductor partent de origin/main : un plan.md seulement local y est invisible.
// Usage :
//   node scripts/plan-gate.mjs check <SPEC-XXXX> [T#]   plan PRÊT (et tâche) sur la base, dépendances livrées
//   node scripts/plan-gate.mjs deps <SPEC-XXXX>         dépendances livrées seulement (au début de /plan)
// Dépendances : ligne `Dépend de : SPEC-XXXX, SPEC-YYYY` (ou `aucune`) de spec.md sur la base ; sans cette ligne, aucune.
// Une spec est livrée quand elle a un contrat sur la base et qu'aucun de ses fichiers n'a plus de `.skip` : c'est la
// fusion de sa tâche de clôture, le même signal que celui qui active ses scénarios cachés (scripts/holdout.mjs).
// Le contrôle ne vérifie pas que les tâches listées dans « Dépend de » d'un plan sont fusionnées (ordre des groupes).
// Variables : BASE_REF (défaut origin/main), PLAN_GATE_NO_FETCH=1 pour sauter le `git fetch` (tests).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { ACCEPTANCE_DIR, specOf } from "./contract-files.mjs";
import { isActive } from "./holdout.mjs";

const base = process.env.BASE_REF ?? "origin/main";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const SPEC_ID = /^SPEC-\d{4}$/;

/** `specs/<spec>-<slug>/<name>`, sans RegExp construite depuis l'argument (ReDoS, semgrep). */
function isSpecFile(p, spec, name) {
  const [dir, folder, file, ...rest] = p.split("/");
  return (
    rest.length === 0 &&
    dir === "specs" &&
    file === name &&
    folder?.startsWith(`${spec}-`) &&
    folder.length > spec.length + 1
  );
}

/** Chemins `specs/<spec>-<slug>/<name>` sur la base. */
function specFilesOnBase(spec, name) {
  return git("ls-tree", "-r", "--name-only", base, "--", "specs/")
    .split("\n")
    .filter((p) => isSpecFile(p, spec, name));
}

/**
 * Dépendances déclarées par le texte d'une spec : `{ deps }`, ou `{ error }` si la ligne `Dépend de` est illisible
 * (ex. laissée au texte du modèle). Sans ligne `Dépend de`, aucune dépendance.
 */
export function parseDependencies(specText) {
  const value = /^Dépend de\s*:\s*(.*?)\s*$/m.exec(specText)?.[1];
  if (value === undefined || value === "aucune") return { deps: [] };
  const deps = value.split(/[\s,]+/).filter(Boolean);
  if (!deps.length || !deps.every((d) => SPEC_ID.test(d)))
    return { error: `ligne « Dépend de » illisible : "${value}" (attendu : aucune, ou SPEC-XXXX, SPEC-YYYY)` };
  return { deps };
}

/** La spec est-elle livrée sur la base : un contrat, et aucun de ses fichiers ne garde de `.skip` ? */
function isDelivered(spec) {
  const texts = git("ls-tree", "--name-only", base, "--", `${ACCEPTANCE_DIR}/`)
    .split("\n")
    .filter((p) => p && specOf(p) === spec)
    .map((p) => git("show", `${base}:${p}`));
  return isActive(texts);
}

/** Renvoie `{ ok, message }` : les specs dont dépend `spec` sont-elles livrées sur `base` ? */
export function checkDependencies(spec, { requireSpec = false } = {}) {
  if (!SPEC_ID.test(spec ?? ""))
    return { ok: false, message: `Identifiant de spec invalide : "${spec ?? ""}" (SPEC-XXXX attendu)` };
  const paths = specFilesOnBase(spec, "spec.md");
  // Avant /plan, la spec doit être fusionnée ; à l'implémentation, son plan l'est déjà et suffit.
  if (paths.length !== 1 && requireSpec)
    return { ok: false, message: `${spec} : pas de spec.md unique sur ${base}. Fusionne d'abord la PR de spec.` };
  if (paths.length !== 1)
    return { ok: true, message: `${spec} : pas de spec.md unique sur ${base}, aucune dépendance lue.` };
  const parsed = parseDependencies(git("show", `${base}:${paths[0]}`));
  if (parsed.error) return { ok: false, message: `${paths[0]} : ${parsed.error}.` };
  const missing = parsed.deps.filter((dep) => !isDelivered(dep));
  if (missing.length) {
    return {
      ok: false,
      message: `${spec} dépend de ${missing.join(", ")}, pas encore livrée(s) sur ${base} (contrat absent ou encore en .skip). Termine d'abord ces specs (voir specs/ROADMAP.md).`,
    };
  }
  return {
    ok: true,
    message: parsed.deps.length
      ? `Dépendances de ${spec} livrées : ${parsed.deps.join(", ")}.`
      : `${spec} : aucune dépendance.`,
  };
}

/** Une ligne `### <task>` suivie de `:` (espaces tolérés) définit la tâche. */
function hasTaskHeading(plan, task) {
  const prefix = `### ${task}`;
  return plan.split("\n").some((line) => line.startsWith(prefix) && /^\s*:/.test(line.slice(prefix.length)));
}

/** Renvoie `{ ok, message }` : le plan de `spec` (et la tâche `task` si fournie) est-il sur `base` ? */
export function checkPlan(spec, task) {
  if (!SPEC_ID.test(spec ?? ""))
    return { ok: false, message: `Identifiant de spec invalide : "${spec ?? ""}" (SPEC-XXXX attendu)` };
  if (task !== undefined && !/^T\d+$/.test(task))
    return { ok: false, message: `Identifiant de tâche invalide : "${task}" (T# attendu)` };

  const paths = specFilesOnBase(spec, "plan.md");
  if (paths.length > 1) {
    return { ok: false, message: `Plusieurs plans correspondent à ${spec} sur ${base} : ${paths.join(", ")}.` };
  }
  if (paths.length === 0) {
    return {
      ok: false,
      message: `Le plan de ${spec} n'est pas sur ${base}. Fusionne d'abord la PR de plan (/plan), puis relance depuis un workspace à jour.`,
    };
  }
  const plan = git("show", `${base}:${paths[0]}`);
  const status = /^Statut\s*:\s*(.+?)\s*$/m.exec(plan)?.[1];
  if (status !== "PRÊT") {
    return { ok: false, message: `Le plan ${paths[0]} sur ${base} n'est pas prêt (Statut : ${status ?? "absent"}).` };
  }
  if (task !== undefined && !hasTaskHeading(plan, task)) {
    return { ok: false, message: `La tâche ${task} n'est pas définie dans ${paths[0]} sur ${base}.` };
  }
  const deps = checkDependencies(spec);
  if (!deps.ok) return deps;
  return {
    ok: true,
    message: `Plan de ${spec} présent sur ${base} (${paths[0]})${task ? `, tâche ${task} définie` : ""}. ${deps.message}`,
  };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const [cmd, spec, task] = process.argv.slice(2);
  if (cmd !== "check" && cmd !== "deps") {
    console.error("Usage : node scripts/plan-gate.mjs check <SPEC-XXXX> [T#] | deps <SPEC-XXXX>");
    process.exit(2);
  }
  try {
    if (!process.env.PLAN_GATE_NO_FETCH) {
      try {
        git("fetch", "--quiet", "origin");
      } catch {
        console.error(
          "plan-gate : git fetch origin impossible (hors ligne ?) : impossible de confirmer que le plan est fusionné.",
        );
        process.exit(2);
      }
    }
    const res = cmd === "check" ? checkPlan(spec, task) : checkDependencies(spec, { requireSpec: true });
    (res.ok ? console.log : console.error)(res.message);
    process.exit(res.ok ? 0 : 1);
  } catch (e) {
    console.error(`plan-gate : ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
