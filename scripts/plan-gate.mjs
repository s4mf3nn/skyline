#!/usr/bin/env node
// Contrôle que le plan d'une spec est fusionné sur la base (origin/main) avant d'implémenter ses tâches.
// Les nouveaux workspaces Conductor partent de origin/main : un plan.md seulement local y est invisible.
// Usage :
//   node scripts/plan-gate.mjs check <SPEC-XXXX> [T#]
// Le contrôle porte sur la présence d'un plan `Statut : PRÊT` (et de la tâche demandée) sur la base ; il ne vérifie
// pas que les tâches listées dans « Dépend de » sont fusionnées (ordre des groupes : voir le plan).
// Variables : BASE_REF (défaut origin/main), PLAN_GATE_NO_FETCH=1 pour sauter le `git fetch` (tests).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const base = process.env.BASE_REF ?? "origin/main";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** `specs/<spec>-<slug>/plan.md`, sans RegExp construite depuis l'argument (ReDoS, semgrep). */
function isPlanPath(p, spec) {
  const [dir, folder, file, ...rest] = p.split("/");
  return (
    rest.length === 0 &&
    dir === "specs" &&
    file === "plan.md" &&
    folder?.startsWith(`${spec}-`) &&
    folder.length > spec.length + 1
  );
}

/** Une ligne `### <task>` suivie de `:` (espaces tolérés) définit la tâche. */
function hasTaskHeading(plan, task) {
  const prefix = `### ${task}`;
  return plan.split("\n").some((line) => line.startsWith(prefix) && /^\s*:/.test(line.slice(prefix.length)));
}

/** Renvoie `{ ok, message }` : le plan de `spec` (et la tâche `task` si fournie) est-il sur `base` ? */
export function checkPlan(spec, task) {
  if (!/^SPEC-\d{4}$/.test(spec ?? ""))
    return { ok: false, message: `Identifiant de spec invalide : "${spec ?? ""}" (SPEC-XXXX attendu)` };
  if (task !== undefined && !/^T\d+$/.test(task))
    return { ok: false, message: `Identifiant de tâche invalide : "${task}" (T# attendu)` };

  const paths = git("ls-tree", "-r", "--name-only", base, "--", "specs/")
    .split("\n")
    .filter((p) => isPlanPath(p, spec));
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
  return {
    ok: true,
    message: `Plan de ${spec} présent sur ${base} (${paths[0]})${task ? `, tâche ${task} définie` : ""}.`,
  };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const [cmd, spec, task] = process.argv.slice(2);
  if (cmd !== "check") {
    console.error("Usage : node scripts/plan-gate.mjs check <SPEC-XXXX> [T#]");
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
    const res = checkPlan(spec, task);
    (res.ok ? console.log : console.error)(res.message);
    process.exit(res.ok ? 0 : 1);
  } catch (e) {
    console.error(`plan-gate : ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
