#!/usr/bin/env node
// Pré-revue déterministe, sans modèle : ce qu'un script sait vérifier ne doit pas coûter une passe du relecteur.
// Usage :
//   node scripts/pre-review.mjs check   contrôles déterministes (code 1 s'il y a une violation)
//   node scripts/pre-review.mjs level   niveau de revue : full | standard | light (selon .github/labeler.yml : `review:full`, `risk:high`/`risk:medium`)
//   node scripts/pre-review.mjs mode    travail de spec ou hors spec (bail du workspace, branche spec-xxxx-t#-* ou spec-xxxx-fix-*)
//   node scripts/pre-review.mjs brief   niveau, contrôles, fichiers et diff filtré, pour le subagent `reviewer`
//   node scripts/pre-review.mjs kind    relecteur à lancer : spec (`spec-reviewer`) | code (`reviewer`)
//   node scripts/pre-review.mjs zones   globs de .github/labeler.yml qui ne correspondent à aucun fichier suivi (avertissement)
// Contrôles : fichiers modifiés dans le périmètre du bail, scénarios cachés retirés du workspace de tâche, tests de
// contrat (check-contract), dépendances ajoutées et déclarées dans .pr-summary.md, section « Documentation consultée
// (Context7) » remplie, test de non-régression présent sur une branche de correctif (spec-xxxx-fix-*).
// Variables : BASE_REF (défaut origin/main), CONDUCTOR_ROOT_PATH et CONDUCTOR_WORKSPACE_PATH (baux).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const base = process.env.BASE_REF ?? "origin/main";
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
const norm = (p) => p.replace(/^\.\//, "").replace(/\/+$/, "");

/** Fichiers exclus du diff montré au relecteur : générés, lockfiles, contrat et scénarios cachés (check-contract). */
export const DIFF_EXCLUDES = ["pnpm-lock.yaml", "*.gen.ts", "tests/acceptance", "tests/holdout"];

/** Le fichier correspond-il au glob du labeler (`**`, `*`) ? Sans RegExp dynamique ; les globs viennent du dépôt (`labeler.yml`), pas d'une entrée utilisateur. */
export function globMatch(glob, file, g = 0, f = 0) {
  if (g === glob.length) return f === file.length;
  if (glob[g] === "*" && glob[g + 1] === "*") {
    const slash = glob[g + 2] === "/";
    const next = g + (slash ? 3 : 2);
    for (let k = f; k <= file.length; k++) {
      if ((!slash || k === f || file[k - 1] === "/") && globMatch(glob, file, next, k)) return true;
    }
    return false;
  }
  if (glob[g] === "*") {
    for (let k = f; k <= file.length; k++) {
      if (globMatch(glob, file, g + 1, k)) return true;
      if (file[k] === "/" || k === file.length) break;
    }
    return false;
  }
  return f < file.length && glob[g] === file[f] && globMatch(glob, file, g + 1, f + 1);
}

/** Globs listés sous une étiquette de `labeler.yml` (lecture simple : lignes `- "glob"` sous la clé). */
export function labelGlobs(labelerText, label) {
  const globs = [];
  let inLabel = false;
  for (const line of labelerText.split("\n")) {
    if (/^\S/.test(line) && !line.startsWith("#"))
      inLabel = line.trim().replace(/:$/, "").replace(/^"|"$/g, "") === label;
    else if (inLabel) {
      const m = /^\s*-\s*"([^"]+)"/.exec(line);
      if (m?.[1]) globs.push(m[1]);
    }
  }
  return globs;
}

/** Étiquettes de `labeler.yml` (clés de premier niveau), dans l'ordre du fichier. */
export function labelNames(labelerText) {
  return labelerText
    .split("\n")
    .filter((line) => /^\S/.test(line) && !line.startsWith("#"))
    .map((line) => line.trim().replace(/:$/, "").replace(/^"|"$/g, ""));
}

/**
 * Globs qui ne correspondent à aucun des `files` : `{ label, glob }`. Une zone morte ne protège rien, par exemple
 * quand l'outil de migration écrit ailleurs que dans le dossier prévu.
 */
export function deadZones(labelerText, files) {
  return labelNames(labelerText).flatMap((label) =>
    labelGlobs(labelerText, label)
      .filter((glob) => !files.some((f) => globMatch(glob, f)))
      .map((glob) => ({ label, glob })),
  );
}

/** `full` si un fichier est en zone `review:full`, `standard` s'il est en risque élevé ou moyen, sinon `light`. */
export function reviewLevel(files, labelerText) {
  const match = (label) => {
    const globs = labelGlobs(labelerText, label);
    return files.some((f) => globs.some((g) => globMatch(g, f)));
  };
  if (match("review:full")) return "full";
  if (match("risk:high") || match("risk:medium")) return "standard";
  return "light";
}

const SPEC_FILE = /^(specs\/[^/]+\/spec\.md|tests\/(acceptance|holdout)\/.+)$/;

/** `spec` si le diff ne contient que des specs, des tests de contrat et des scénarios cachés ; sinon `code`. */
export function reviewKind(files) {
  return files.length > 0 && files.every((f) => SPEC_FILE.test(f)) ? "spec" : "code";
}

/** Le fichier est-il sous l'un des chemins du périmètre (fichier ou dossier) ? */
export function inPerimeter(file, paths) {
  const f = norm(file);
  return paths.some((p) => f === norm(p) || f.startsWith(`${norm(p)}/`));
}

/** Noms de dépendances présents dans `after` et absents de `before` (package.json sérialisés, ou null). */
export function addedDependencies(before, after) {
  const names = (json) => {
    if (!json) return new Set();
    const p = JSON.parse(json);
    return new Set(
      ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].flatMap((k) =>
        Object.keys(p[k] ?? {}),
      ),
    );
  };
  const old = names(before);
  return [...names(after)].filter((n) => !old.has(n));
}

/** Contenu d'une section `## <titre>` du résumé de PR, sans le titre ni les commentaires HTML. */
export function summarySection(text, title) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start === -1) return null;
  const next = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

const TEMPLATE_CONTEXT7 = "Bibliothèque et version, une par ligne.";

/** Violations liées à `.pr-summary.md` : section Context7 remplie, dépendances ajoutées déclarées. */
export function checkSummary(summary, added) {
  const problems = [];
  if (summary === null) return [".pr-summary.md absent (voir .github/pull_request_template.md)"];
  const ctx = summarySection(summary, "Documentation consultée (Context7)");
  if (!ctx || ctx.startsWith(TEMPLATE_CONTEXT7))
    problems.push("section « Documentation consultée (Context7) » vide ou au texte du template");
  // Noms entiers (jetons) : `zod` ne doit pas être satisfait par `zod-to-json-schema`.
  const tokens = (summarySection(summary, "Nouvelles dépendances") ?? "").split(/[\s,;:|()`]+/);
  const declared = new Set([...tokens, ...tokens.map((t) => t.replace(/@[^@/]+$/, ""))]); // `zod@3.2` déclare `zod`
  for (const name of added) {
    if (!declared.has(name)) problems.push(`dépendance ajoutée non déclarée dans « Nouvelles dépendances » : ${name}`);
  }
  return problems;
}

/** Branche de correctif posée par `/fix` : `[préfixe/]spec-xxxx-fix-*`. */
export function isFixBranch(branch) {
  return /^(?:[^/]+\/)?spec-\d+-fix(-|$)/i.test(branch);
}

const TEST_FILE = /\.test\.tsx?$/;

/** Le diff contient-il un test hors contrat et hors scénarios cachés (ceux-là sont immuables) ? */
export function hasRegressionTest(files) {
  return files.some((f) => TEST_FILE.test(f) && !inPerimeter(f, ["tests/acceptance", "tests/holdout"]));
}

/** Travail de spec si bail, HEAD détaché, branche de tâche `[préfixe/]spec-xxxx-t#-*` ou de correctif ; sinon hors spec (outillage). */
export function workMode(hasLease, branch) {
  const isTaskBranch = /^(?:[^/]+\/)?spec-\d+-t\d+(-|$)/i.test(branch);
  return hasLease || branch === "" || isTaskBranch || isFixBranch(branch) ? "spec" : "hors-spec";
}

function currentBranch() {
  return git("branch", "--show-current").trim();
}

function currentLease() {
  const root = process.env.CONDUCTOR_ROOT_PATH ?? process.cwd();
  const workspace = process.env.CONDUCTOR_WORKSPACE_PATH ?? process.cwd();
  try {
    const leases = JSON.parse(fs.readFileSync(path.join(root, ".factory", "leases.json"), "utf8"));
    const mine = leases.filter((l) => l.workspace === workspace);
    return mine.length ? mine : null;
  } catch {
    return null;
  }
}

function changedFiles() {
  return git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
}

function showOrNull(ref) {
  try {
    return git("show", ref);
  } catch {
    return null;
  }
}

/** Exécute les contrôles ; renvoie `{ problems, notes }`. */
export function runChecks() {
  const problems = [];
  const notes = [];
  const files = changedFiles();

  const leases = currentLease();
  if (leases) {
    const perimeter = leases.flatMap((l) => l.paths);
    for (const f of files)
      if (!inPerimeter(f, perimeter)) problems.push(`hors périmètre (${perimeter.join(", ")}) : ${f}`);
    if (fs.existsSync("tests/holdout"))
      problems.push("scénarios cachés visibles dans un workspace de tâche : lance `node scripts/holdout.mjs hide`");
  } else notes.push("aucun bail pour ce workspace : périmètre non contrôlé");

  // Un correctif sans test laisse le bug revenir : le test qui le reproduit fait partie du correctif.
  if (isFixBranch(currentBranch())) {
    notes.push(
      "correctif de bug (branche spec-xxxx-fix-*) : pas de tâche de plan, voir « Référence » de .pr-summary.md",
    );
    if (!hasRegressionTest(files))
      problems.push(
        "correctif sans test de non-régression : ajoute un test `*.test.ts` ou `*.test.tsx` qui reproduit le bug",
      );
  }

  try {
    execFileSync("node", ["scripts/check-contract.mjs"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  } catch (e) {
    problems.push(
      `contrat modifié (tests d'acceptation hors retrait de .skip, ou scénarios cachés) : ${String(e.stderr ?? e.message).trim()}`,
    );
  }

  const mergeBase = git("merge-base", base, "HEAD").trim();
  const added = files
    .filter((f) => path.basename(f) === "package.json")
    .flatMap((f) => addedDependencies(showOrNull(`${mergeBase}:${f}`), showOrNull(`HEAD:${f}`)));
  const summary = fs.existsSync(".pr-summary.md") ? fs.readFileSync(".pr-summary.md", "utf8") : null;
  problems.push(...checkSummary(summary, added));
  return { problems, notes };
}

function level() {
  return reviewLevel(changedFiles(), fs.readFileSync(".github/labeler.yml", "utf8"));
}

const LEVEL_HELP = {
  full: "zone review:full : revue complète (tous les points de la procédure).",
  standard:
    "risque élevé hors review:full ou moyen : revue complète ; Context7 seulement pour une API absente de docs/factory/libs-cache.md.",
  light:
    "risque faible : spec, tests, cas limites, sécurité des points d'entrée et des entrées, honnêteté du résumé ; pas de Context7 sauf bibliothèque nouvelle.",
};

function brief() {
  const lvl = level();
  const { problems, notes } = runChecks();
  const files = changedFiles();
  const excluded = DIFF_EXCLUDES.map((e) => `:(exclude)${e}`);
  const out = [
    `NIVEAU DE REVUE : ${lvl} (${LEVEL_HELP[lvl]})`,
    `CONTRÔLES DÉTERMINISTES : ${problems.length ? `${problems.length} violation(s)` : "OK"} (déjà faits, ne pas les refaire)`,
    ...problems.map((p) => `  - ${p}`),
    ...notes.map((n) => `  - note : ${n}`),
    `FICHIERS MODIFIÉS (${files.length}) :`,
    ...files.map((f) => `  ${f}`),
    `DIFF (sans ${DIFF_EXCLUDES.join(", ")}) :`,
    git("diff", "-U3", `${base}...HEAD`, "--", ".", ...excluded),
  ];
  return out.join("\n");
}

/** Avertit des zones mortes, sans échouer : avant SPEC-0000, la plupart des zones applicatives le sont. */
function zones() {
  const files = git("ls-files").split("\n").filter(Boolean);
  const dead = deadZones(fs.readFileSync(".github/labeler.yml", "utf8"), files);
  if (!dead.length) {
    console.log("Zones de risque : chaque glob de .github/labeler.yml correspond à au moins un fichier.");
    return;
  }
  console.log(`Zones de risque : ${dead.length} glob(s) sans aucun fichier correspondant (ne protègent rien) :`);
  for (const { label, glob } of dead) console.log(`  ${label}  ${glob}`);
  console.log(
    "À adapter dans .github/labeler.yml, docs/factory/RISK.md et .github/CODEOWNERS, ou à garder s'ils anticipent du code à venir.",
  );
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const cmd = process.argv[2];
  try {
    if (cmd === "check") {
      const { problems, notes } = runChecks();
      for (const n of notes) console.log(`note : ${n}`);
      if (problems.length) {
        console.error(`Pré-revue : ${problems.length} violation(s)\n${problems.map((p) => `- ${p}`).join("\n")}`);
        process.exit(1);
      }
      console.log("Pré-revue : OK");
    } else if (cmd === "level") console.log(level());
    else if (cmd === "mode") console.log(workMode(currentLease() !== null, currentBranch()));
    else if (cmd === "brief") console.log(brief());
    else if (cmd === "kind") console.log(reviewKind(changedFiles()));
    else if (cmd === "zones") zones();
    else {
      console.error("Usage : node scripts/pre-review.mjs check | level | mode | brief | kind | zones");
      process.exit(2);
    }
  } catch (e) {
    console.error(`pre-review : ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
