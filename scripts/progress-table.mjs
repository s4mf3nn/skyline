#!/usr/bin/env node
// Tableau d'avancement global en Markdown (docs/PROGRESS.md) : une ligne par spec de la roadmap, une colonne par
// étape du cycle (spec, plan, implémentation, livraison, production). Même source que `pnpm dashboard`
// (`computeProgress`), lue sur origin/main avec l'état des PR de GitHub. Régénéré par le workflow `progress`
// après chaque fusion sur main : le fichier ne s'édite jamais à la main.
// Usage : node scripts/progress-table.mjs [--out <fichier>] [--local] [--no-github]
// Dans le workflow (GITHUB_ACTIONS), un échec de `gh` fait échouer le script : on ne commite jamais un tableau dégradé.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { computeProgress, readFromDisk, readFromGit } from "./progress.mjs";

const DONE = "✅";
const PARTIAL = "🟡";
const TODO = "⬜";

const STAGE_LABELS = {
  "to-write": "Spec à écrire",
  specified: "Plan à écrire",
  planned: "Prêt à implémenter",
  "in-progress": "En cours",
  delivered: "Livrée, à mettre en production",
  released: "En production",
};

function tasksDone(spec) {
  const tasks = spec.plan?.tasks ?? [];
  return { done: tasks.filter((task) => task.status === "done").length, total: tasks.length };
}

function implementationCell(spec) {
  const { done, total } = tasksDone(spec);
  if (total === 0) return TODO;
  if (done === total) return `${DONE} ${done}/${total}`;
  return `${done === 0 ? TODO : PARTIAL} ${done}/${total}`;
}

function planCell(spec) {
  if (!spec.plan) return TODO;
  return spec.plan.status === "PRÊT" ? DONE : PARTIAL;
}

/** Les titres et messages de la roadmap peuvent être très longs : on les coupe pour garder le tableau lisible. */
const short = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Ligne du tableau pour une spec. */
export function specRow(spec) {
  const delivered = spec.stage === "delivered" || spec.stage === "released";
  return [
    spec.id,
    short(spec.title ?? "", 70).replaceAll("|", "\\|") || "n/d",
    spec.exists ? DONE : TODO,
    planCell(spec),
    delivered ? `${DONE} ${tasksDone(spec).done}/${tasksDone(spec).total}` : implementationCell(spec),
    delivered ? DONE : TODO,
    spec.stage === "released" ? DONE : TODO,
    STAGE_LABELS[spec.stage],
  ];
}

/** Document Markdown complet. `progress` vient de `computeProgress`. */
export function renderProgress(progress, { source, generatedAt, degraded = false }) {
  const steps = progress.project.steps.map((step) => {
    const mark = step.done ? DONE : step.status === "current" ? PARTIAL : TODO;
    return `| ${mark} | ${step.label} | ${short(step.detail || "", 100).replaceAll("|", "\\|")} |`;
  });
  const header = "| Spec | Titre | Spec | Plan | Implémentation | Livrée | Production | Étape |";
  const rows = progress.specs.map((spec) => `| ${specRow(spec).join(" | ")} |`);
  const blockers = progress.blockers.map((b) => `- ${b.spec ? `${b.spec} : ` : ""}${short(b.message, 160)}`);
  const next = progress.nextActions.map((a) => `- ${short(`${a.command} : ${a.reason}`, 160)}`);
  return [
    "# Avancement du projet",
    "",
    `<!-- Fichier généré par scripts/progress-table.mjs (workflow \`progress\`). Ne pas éditer à la main. -->`,
    `Mis à jour le ${generatedAt} d'après ${source}. Légende : ${DONE} fait, ${PARTIAL} en cours, ${TODO} à faire.`,
    "",
    ...(degraded
      ? ["> Données GitHub indisponibles : les tâches et la production sont déduites des fichiers seuls.", ""]
      : []),
    "## Étapes du projet",
    "",
    "| | Étape | Détail |",
    "|---|---|---|",
    ...steps,
    "",
    "## Specs",
    "",
    header,
    "|---|---|:-:|:-:|:-:|:-:|:-:|---|",
    ...rows,
    "",
    "## Bloquants",
    "",
    ...(blockers.length > 0 ? blockers : ["Aucun."]),
    "",
    "## Prochaines actions",
    "",
    ...(next.length > 0 ? next : ["Aucune."]),
    "",
  ].join("\n");
}

/** `gh` indisponible : null en local (tableau dégradé), échec en CI pour ne pas commiter un tableau faux. */
function gh(args) {
  try {
    return JSON.parse(
      execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }),
    );
  } catch (error) {
    if (process.env.GITHUB_ACTIONS) throw error;
    return null;
  }
}

// Le workflow est désigné par son fichier : `gh` ne retrouve pas par son nom un workflow jamais exécuté.
function lastRun(workflow, ...filters) {
  const runs = gh([
    "run",
    "list",
    "--workflow",
    workflow,
    "--branch",
    "main",
    "--limit",
    "1",
    "--json",
    "conclusion,createdAt",
    ...filters,
  ]);
  return runs?.[0] ?? null;
}

function main() {
  const args = process.argv.slice(2);
  const local = args.includes("--local");
  const github = !args.includes("--no-github");
  const outIndex = args.indexOf("--out");
  const out = outIndex >= 0 ? args[outIndex + 1] : path.join("docs", "PROGRESS.md");
  const prList = ["pr", "list", "--state", "all", "--limit", "300"];
  const fetched = github ? gh([...prList, "--json", "number,title,state,mergedAt,headRefName,url,comments"]) : null;
  const prs = fetched ?? [];
  const degraded = fetched === null;
  if (!local) {
    try {
      execFileSync("git", ["fetch", "--quiet", "origin"], { stdio: "ignore" });
    } catch {
      // Hors ligne : on lit origin/main tel qu'il a été récupéré la dernière fois.
    }
  }
  const files = local ? readFromDisk() : readFromGit("origin/main");
  const progress = computeProgress({
    files,
    prs,
    lastRelease: github ? lastRun("release.yml", "--status", "success") : null,
    // `gates` n'est pas lu : le workflow part au push, avant la fin du run `gates` de cette fusion. /land le contrôle.
    now: new Date().toISOString(),
  });
  const generatedAt = new Date().toISOString().slice(0, 10);
  const text = renderProgress(progress, {
    source: local ? "l'arbre de travail" : "origin/main",
    generatedAt,
    degraded,
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log(`Avancement écrit : ${out}`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) main();
