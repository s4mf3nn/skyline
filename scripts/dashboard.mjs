#!/usr/bin/env node
// Tableau de bord de la factory : un fichier HTML statique (sans serveur ni dépendance) qui répond à
// « la factory est-elle optimale, faut-il une boucle d'amélioration ? ».
// Sources : transcripts Claude Code locaux (tokens par jour, via token-report.mjs) et PR GitHub (`gh`) avec le
// commentaire « Journal des revues » posé par `review-gate.mjs publish` (rejets du relecteur, passages).
// Usage :
//   node scripts/dashboard.mjs [--since AAAA-MM-JJ] [--out <fichier>] [--no-tokens] [--json] [--local]
// Par défaut : 30 derniers jours, écrit dans .context/dashboard.html.
// `--json` ajoute l'avancement du projet (`progress`, voir scripts/progress.mjs), lu sur origin/main : un workspace
// est sur une branche de tâche, donc en retard sur ce qui est fusionné. `--local` lit l'arbre de travail à la place.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { computeProgress, readFromDisk, readFromGit } from "./progress.mjs";
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

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (v) => (v === null ? "n/d" : `${Math.round(v * 100)} %`);
const num = (v, digits = 1) => (v === null ? "n/d" : v.toFixed(digits));
const compact = (n) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function tile(label, value, hint, bad) {
  const status = bad ? "⚠ au-dessus du seuil" : "";
  return `<div class="tile${bad ? " bad" : ""}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="hint">${esc(status || hint)}</div></div>`;
}

/** Histogramme SVG de la consommation pondérée par jour. */
function dailyChart(days) {
  if (days.length === 0) return "<p>Aucun transcript sur la période.</p>";
  const width = 720;
  const height = 180;
  const max = Math.max(...days.map((d) => d.weighted));
  const slot = width / days.length;
  const bars = days
    .map((d, i) => {
      const h = Math.max(1, (d.weighted / max) * (height - 30));
      const x = i * slot + slot * 0.1;
      return `<g><rect x="${x.toFixed(1)}" y="${(height - 20 - h).toFixed(1)}" width="${(slot * 0.8).toFixed(1)}" height="${h.toFixed(1)}" fill="var(--bar)"><title>${esc(d.day)} : ${esc(compact(d.weighted))} tokens pondérés, ${d.turns} tours</title></rect></g>`;
    })
    .join("");
  const first = esc(days[0].day);
  const last = esc(days[days.length - 1].day);
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tokens pondérés par jour, de ${first} à ${last}">${bars}<text x="0" y="${height - 4}" class="axis">${first}</text><text x="${width}" y="${height - 4}" text-anchor="end" class="axis">${last}</text><text x="0" y="12" class="axis">max ${esc(compact(max))}</text></svg>`;
}

export function renderHtml({ stats, days, generatedAt }) {
  const totalTokens = days.reduce((acc, d) => acc + d.weighted, 0);
  const avgPerDay = days.length === 0 ? null : totalTokens / days.length;
  const perPr = stats.merged === 0 || days.length === 0 ? null : totalTokens / stats.merged;
  const flagged = new Set(alerts(stats).map((a) => a.key));
  const levelRows = Object.entries(stats.levels)
    .map(
      ([level, l]) =>
        `<tr><td>${esc(level)}</td><td>${l.passes}</td><td>${l.rejected}</td><td>${pct(l.rejected / l.passes)}</td></tr>`,
    )
    .join("");
  const rejected = stats.rejectedPrs.map((p) => `<li>#${p.number} ${esc(p.title)} (${esc(p.verdict)})</li>`).join("");
  const alertList = alerts(stats)
    .map(
      (a) => `<li><strong>${esc(a.key)}</strong> : ${num(a.value, 2)} pour un seuil de ${a.max}. ${esc(a.hint)}.</li>`,
    )
    .join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Tableau de bord de la factory</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--muted:#666;--card:#f4f5f7;--bar:#3b6fd4;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#16181d;--fg:#e8e8e8;--muted:#9aa0a6;--card:#23262d;--bar:#7aa2f7;--bad:#f2b8b5}}
body{font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);max-width:820px;margin:2rem auto;padding:0 1rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
.tile{background:var(--card);border-radius:8px;padding:.75rem 1rem}.tile.bad{border-left:4px solid var(--bad)}
.label{color:var(--muted);font-size:.85rem}.value{font-size:1.6rem;font-weight:600}.hint{color:var(--muted);font-size:.8rem}.bad .hint{color:var(--bad)}
table{border-collapse:collapse}td,th{padding:.25rem .75rem;text-align:left;border-bottom:1px solid var(--card)}
svg{width:100%;height:auto}.axis{fill:var(--muted);font-size:11px}
</style></head><body>
<h1>Tableau de bord de la factory</h1>
<p class="hint">Depuis le ${esc(stats.since)} · généré le ${esc(generatedAt)}</p>
<h2>Tokens</h2>
<div class="tiles">
${tile("Moyenne par jour actif", avgPerDay === null ? "n/d" : compact(avgPerDay), "tokens pondérés", false)}
${tile("Total sur la période", compact(totalTokens), `${days.length} jour(s) actif(s)`, false)}
${tile("Par PR fusionnée", perPr === null ? "n/d" : compact(perPr), THRESHOLDS.tokensPerMergedPr.hint, false)}
</div>
${dailyChart(days)}
<h2>Revue</h2>
<div class="tiles">
${tile("Rejet au premier passage", pct(stats.firstPassRejectionRate), `${stats.reviewedPrs} PR relue(s)`, flagged.has("firstPassRejectionRate"))}
${tile("Passages moyens par PR", num(stats.avgPasses), "objectif : 2 au plus", flagged.has("avgPasses"))}
${tile("Taux de reprise", pct(stats.reworkRate), "PR à plus d'un passage", false)}
${tile("Revues écartées (waive)", String(stats.waived), "réservées à l'humain", false)}
</div>
<h3>Passages par niveau de revue</h3>
<table><tr><th>Niveau</th><th>Passages</th><th>Rejets</th><th>Taux</th></tr>${levelRows || '<tr><td colspan="4">Aucun passage journalisé.</td></tr>'}</table>
<h3>PR rejetées au premier passage</h3>
<ul>${rejected || "<li>Aucune.</li>"}</ul>
<h2>Livraison</h2>
<div class="tiles">
${tile("PR fusionnées", String(stats.merged), `${stats.prs} PR ouvertes sur la période`, false)}
${tile("Fermées sans fusion", pct(stats.closedWithoutMergeRate), `${stats.closedWithoutMerge} PR`, flagged.has("closedWithoutMergeRate"))}
${tile("Délai médian ouverture → fusion", stats.leadTimeMedianHours === null ? "n/d" : `${num(stats.leadTimeMedianHours)} h`, "", false)}
${tile("PR sans journal de revue", String(stats.prsWithoutJournal), "hors périmètre des taux de revue", false)}
</div>
<h2>Boucle d'amélioration</h2>
${alertList ? `<ul>${alertList}</ul><p>Lance <code>/retro</code>, puis <code>/learn</code> sur chaque problème récurrent.</p>` : "<p>Aucun seuil dépassé.</p>"}
</body></html>
`;
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

/** Avancement du projet, ou null si origin/main est illisible : le reste du tableau de bord reste produit. */
function collectProgress(prs, local) {
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
    lastRelease: lastRun("release", "--status", "success"),
    gates: lastRun("gates", "--event", "push")?.conclusion ?? null,
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
  const prs = fetchPrs();
  const stats = computeStats(prs, since);
  const days = args.includes("--no-tokens") ? [] : dailyTotals(collectRows(transcriptDirs(), { since }), since);
  if (args.includes("--json")) {
    const progress = collectProgress(prs, args.includes("--local"));
    console.log(JSON.stringify({ stats, days, alerts: alerts(stats), progress }, null, 2));
    return;
  }
  const out = opt("--out") ?? path.join(".context", "dashboard.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    renderHtml({ stats, days, generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") }),
  );
  console.log(`Tableau de bord écrit : ${out}`);
  for (const a of alerts(stats))
    console.log(`Seuil dépassé : ${a.key} = ${num(a.value, 2)} (max ${a.max}). ${a.hint}.`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) main();
