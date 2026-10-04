#!/usr/bin/env node
// Tableau de bord de la factory : un fichier HTML statique (sans serveur ni dépendance) qui répond à
// « la factory est-elle optimale, faut-il une boucle d'amélioration ? ».
// Sources : transcripts Claude Code locaux (tokens par jour, via token-report.mjs) et PR GitHub (`gh`) avec le
// commentaire « Journal des revues » posé par `review-gate.mjs publish` (rejets du relecteur, passages).
// Usage :
//   node scripts/dashboard.mjs [--since AAAA-MM-JJ] [--out <fichier>] [--no-tokens] [--json] [--local] [--no-github]
// Par défaut : 30 derniers jours, écrit dans .context/dashboard.html (rendu : scripts/dashboard-view.mjs).
// L'avancement du projet (`progress`, voir scripts/progress.mjs) est lu sur origin/main : un workspace est sur une
// branche de tâche, donc en retard sur ce qui est fusionné. `--local` lit l'arbre de travail à la place.
// `--no-github` n'appelle pas `gh` (hors ligne) : l'avancement est déduit des fichiers seuls.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { num, renderPage } from "./dashboard-view.mjs";
import { computeProgress, readFromDisk, readFromGit, readSpecDates } from "./progress.mjs";
import { parseComment } from "./review-journal.mjs";
import { collectRows, dailyTotals, transcriptDirs } from "./token-report.mjs";

/** Seuils au-delà desquels un indicateur appelle une boucle d'amélioration (`/retro`, puis `/learn`). */
export const THRESHOLDS = {
  firstPassRejectionRate: { max: 0.4, hint: "spec ou plan trop flou, ou contexte de l'implémenteur insuffisant" },
  avgPasses: { max: 2, hint: "la boucle de correction ne converge pas : relire les findings récurrents" },
  closedWithoutMergeRate: { max: 0.2, hint: "tâches mal découpées ou specs à amender avant de coder" },
  tokensPerMergedPr: { max: null, hint: "à comparer à la semaine précédente : doit baisser" },
};

const median = (list) => {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const isRejection = (verdict) => verdict === "CHANGEMENTS" || verdict === "BLOQUANT";

/** Passages de revue d'une PR, triés par date, relus dans ses commentaires. */
export function prEntries(pr) {
  return (pr.comments ?? []).flatMap((c) => parseComment(c.body ?? "")).sort((a, b) => a.at.localeCompare(b.at));
}

/** Statistiques de PR et de revue sur les PR créées depuis `since` (AAAA-MM-JJ). */
export function computeStats(prs, since) {
  const scoped = prs.filter((pr) => pr.createdAt.slice(0, 10) >= since);
  const merged = scoped.filter((pr) => pr.mergedAt);
  const closed = scoped.filter((pr) => pr.state === "CLOSED" && !pr.mergedAt);
  const journals = scoped.map((pr) => ({ pr, entries: prEntries(pr) })).filter((j) => j.entries.length > 0);
  const reviewed = journals.filter((j) => j.entries.some((e) => e.verdict !== "WAIVED"));

  const verdicts = {};
  const levels = {};
  for (const { entries } of journals) {
    for (const e of entries) {
      verdicts[e.verdict] = (verdicts[e.verdict] ?? 0) + 1;
      const key = e.level ?? "inconnu";
      levels[key] = levels[key] ?? { passes: 0, rejected: 0 };
      const l = levels[key];
      l.passes += 1;
      if (isRejection(e.verdict)) l.rejected += 1;
    }
  }
  const firstRejected = reviewed.filter((j) => isRejection(j.entries[0].verdict));
  const ratio = (n, d) => (d === 0 ? null : n / d);
  return {
    since,
    prs: scoped.length,
    merged: merged.length,
    closedWithoutMerge: closed.length,
    closedWithoutMergeRate: ratio(closed.length, merged.length + closed.length),
    leadTimeMedianHours: median(merged.map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.createdAt)) / 3.6e6)),
    reviewedPrs: reviewed.length,
    prsWithoutJournal: scoped.length - journals.length,
    firstPassRejectionRate: ratio(firstRejected.length, reviewed.length),
    avgPasses: ratio(
      reviewed.reduce((acc, j) => acc + j.entries.length, 0),
      reviewed.length,
    ),
    reworkRate: ratio(reviewed.filter((j) => j.entries.length > 1).length, reviewed.length),
    waived: verdicts.WAIVED ?? 0,
    verdicts,
    levels,
    rejectedPrs: firstRejected.map((j) => ({ number: j.pr.number, title: j.pr.title, verdict: j.entries[0].verdict })),
  };
}

/** Indicateurs au-delà de leur seuil, avec la piste d'amélioration associée. */
export function alerts(stats) {
  return Object.entries(THRESHOLDS)
    .filter(([key, t]) => t.max !== null && stats[key] !== null && stats[key] !== undefined && stats[key] > t.max)
    .map(([key, t]) => ({ key, value: stats[key], max: t.max, hint: t.hint }));
}

/** Page HTML ; sans `progress`, seule la santé de la factory est rendue. */
export function renderHtml(data) {
  return renderPage({ ...data, alerts: alerts(data.stats), thresholds: THRESHOLDS });
}

function fetchPrs() {
  const out = execFileSync(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      "300",
      "--json",
      "number,title,state,createdAt,mergedAt,closedAt,comments,headRefName,url",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out);
}

/** Dernier run d'un workflow sur main, ou null (aucun run, workflow absent, `gh` indisponible). */
function lastRun(workflow, ...filters) {
  try {
    const out = execFileSync(
      "gh",
      [
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
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(out)[0] ?? null;
  } catch {
    return null;
  }
}

function readLeases() {
  const file = path.join(process.env.CONDUCTOR_ROOT_PATH ?? process.cwd(), ".factory", "leases.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

/** Fichiers du projet sur origin/main à jour ; hors ligne, la dernière copie connue suffit. */
function readMain() {
  try {
    execFileSync("git", ["fetch", "--quiet", "origin"], { stdio: "ignore" });
  } catch {
    // Hors ligne : on lit origin/main tel qu'il a été récupéré la dernière fois.
  }
  return readFromGit("origin/main");
}

/** Issues `bug` (défauts échappés de METRICS.md), ou liste vide si `gh` est indisponible. */
function fetchBugs() {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "list", "--label", "bug", "--state", "all", "--limit", "300", "--json", "number,state"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return JSON.parse(out);
  } catch {
    return [];
  }
}

/** Dates d'arrivée des specs ; sans historique lisible (clone superficiel), les délais restent `n/d`. */
function specDates(ref) {
  try {
    return readSpecDates(ref);
  } catch {
    return {};
  }
}

/** Avancement du projet, ou null si origin/main est illisible : le reste du tableau de bord reste produit. */
function collectProgress(prs, { local, github }) {
  let files;
  try {
    files = local ? readFromDisk() : readMain();
  } catch {
    console.error("Avancement indisponible : origin/main est illisible (dépôt sans remote ?). Relance avec --local.");
    return null;
  }
  return computeProgress({
    files,
    prs,
    leases: readLeases(),
    lastRelease: github ? lastRun("release", "--status", "success") : null,
    gates: github ? (lastRun("gates", "--event", "push")?.conclusion ?? null) : null,
    specDates: specDates(local ? "HEAD" : "origin/main"),
    bugs: github ? fetchBugs() : [],
    now: new Date().toISOString(),
  });
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const since = opt("--since") ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const local = args.includes("--local");
  const github = !args.includes("--no-github");
  const prs = github ? fetchPrs() : [];
  const stats = computeStats(prs, since);
  const days = args.includes("--no-tokens") ? [] : dailyTotals(collectRows(transcriptDirs(), { since }), since);
  const progress = collectProgress(prs, { local, github });
  if (args.includes("--json")) {
    console.log(JSON.stringify({ stats, days, alerts: alerts(stats), progress }, null, 2));
    return;
  }
  const out = opt("--out") ?? path.join(".context", "dashboard.html");
  const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const source = local ? "l'arbre de travail" : "origin/main";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderHtml({ stats, days, generatedAt, progress, source, github }));
  console.log(`Tableau de bord écrit : ${out}`);
  for (const a of alerts(stats))
    console.log(`Seuil dépassé : ${a.key} = ${num(a.value, 2)} (max ${a.max}). ${a.hint}.`);
  for (const b of progress?.blockers ?? []) console.log(`Bloquant : ${b.spec ? `${b.spec}, ` : ""}${b.message}.`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) main();
