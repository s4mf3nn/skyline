#!/usr/bin/env node
// Mesure la consommation de tokens des sessions Claude Code du projet (transcripts JSONL locaux).
// Sert de base avant/après pour les optimisations de docs/factory/TOKENS.md et de source à METRICS.md.
// Usage :
//   node scripts/token-report.mjs [--dir <dossier de transcripts>] [--project <nom>] [--since AAAA-MM-JJ] [--exclude <workspace>] [--top N] [--json]
// Par défaut : tous les dossiers ~/.claude/projects/*<projet>* (un par workspace Conductor), où <projet> est le nom
// du dossier du dépôt principal ($CONDUCTOR_ROOT_PATH, sinon le dossier courant) ou la valeur de --project.
// Les messages assistant répétés (streaming) sont dédupliqués par identifiant de message ; les transcripts de
// subagents (revue, planner…) sont ajoutés à leur session ; les messages synthétiques sont ignorés.
// La consommation est aussi ventilée par jour (date UTC du message) : tableau `byDay`, repris par scripts/dashboard.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Entrée de `map` pour `key`, créée avec `init` si absente. */
function bucket(map, key, init) {
  if (!(key in map)) map[key] = init;
  return map[key];
}

/** Somme les usages d'un transcript : un seul décompte par `message.id` (le dernier vu). */
export function summarizeTranscript(text) {
  const byMessage = new Map();
  let firstTs = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    // Les messages synthétiques (`<synthetic>`) n'ont pas d'appel au modèle : ni tour ni tokens.
    if (entry.type !== "assistant" || !entry.message?.usage || entry.message.model === "<synthetic>") continue;
    firstTs ??= entry.timestamp ?? null;
    byMessage.set(entry.message.id ?? entry.uuid, {
      model: entry.message.model ?? "inconnu",
      usage: entry.message.usage,
      day: (entry.timestamp ?? "").slice(0, 10),
    });
  }
  const total = { turns: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, models: {}, byDay: {} };
  for (const { model, usage, day } of byMessage.values()) {
    total.turns += 1;
    total.input += usage.input_tokens ?? 0;
    total.cacheWrite += usage.cache_creation_input_tokens ?? 0;
    total.cacheRead += usage.cache_read_input_tokens ?? 0;
    total.output += usage.output_tokens ?? 0;
    total.models[model] = (total.models[model] ?? 0) + 1;
    if (day) {
      const d = bucket(total.byDay, day, { turns: 0, weighted: 0 });
      d.turns += 1;
      d.weighted += weighted({
        input: usage.input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
      });
    }
  }
  return { ...total, firstTs };
}

/** Additionne plusieurs résumés (session principale et ses subagents). */
export function mergeSummaries(list) {
  const total = { turns: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, models: {}, byDay: {}, firstTs: null };
  for (const s of list) {
    for (const k of ["turns", "input", "cacheWrite", "cacheRead", "output"]) total[k] += s[k];
    for (const [day, d] of Object.entries(s.byDay ?? {})) {
      const t = bucket(total.byDay, day, { turns: 0, weighted: 0 });
      t.turns += d.turns;
      t.weighted += d.weighted;
    }
    for (const [m, n] of Object.entries(s.models)) total.models[m] = (total.models[m] ?? 0) + n;
    if (s.firstTs && (total.firstTs === null || s.firstTs < total.firstTs)) total.firstTs = s.firstTs;
  }
  return total;
}

/** Tokens « pleine tarification » approchés : lecture de cache comptée au dixième. */
export function weighted(s) {
  return Math.round(s.input + s.cacheWrite * 1.25 + s.cacheRead * 0.1 + s.output * 5);
}

const fmt = (n) => n.toLocaleString("fr-FR");

/** Sessions : transcript principal et transcripts de ses subagents (`<session>/subagents/*.jsonl`, stockés à part). */
function sessions(dirs) {
  const out = [];
  for (const dir of dirs) {
    for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      if (!name.endsWith(".jsonl")) continue;
      const subDir = path.join(dir, name.slice(0, -".jsonl".length), "subagents");
      const subs = fs.existsSync(subDir) ? fs.readdirSync(subDir).filter((f) => f.endsWith(".jsonl")) : [];
      out.push({ dir, files: [path.join(dir, name), ...subs.map((f) => path.join(subDir, f))] });
    }
  }
  return out;
}

/** Dossiers de transcripts du projet : `dir` explicite, sinon un dossier par workspace sous ~/.claude/projects. */
export function transcriptDirs({ dir, project, exclude } = {}) {
  if (dir) return [dir];
  const root = path.join(os.homedir(), ".claude", "projects");
  // Claude Code nomme ses dossiers de transcripts d'après le chemin, caractères non alphanumériques remplacés par `-`.
  const name = (project ?? path.basename(process.env.CONDUCTOR_ROOT_PATH ?? process.cwd())).replace(
    /[^a-zA-Z0-9]/g,
    "-",
  );
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((d) => d.includes(name) && !(exclude && d.endsWith(`-${exclude}`)))
    .map((d) => path.join(root, d));
}

/** Une ligne par session (transcript principal et subagents fusionnés), filtrée par date de début. */
export function collectRows(dirs, { since, project } = {}) {
  const name = (project ?? path.basename(process.env.CONDUCTOR_ROOT_PATH ?? process.cwd())).replace(
    /[^a-zA-Z0-9]/g,
    "-",
  );
  const label = (dir) => {
    const base = path.basename(dir);
    const i = base.lastIndexOf(name);
    return (i === -1 ? base : base.slice(i + name.length).replace(/^-/, "")) || ".";
  };
  const rows = [];
  for (const { dir, files } of sessions(dirs)) {
    const s = mergeSummaries(files.map((f) => summarizeTranscript(fs.readFileSync(f, "utf8"))));
    if (s.turns === 0 || (since && (s.firstTs ?? "") < since)) continue;
    rows.push({ file: label(dir), subagents: files.length - 1, ...s });
  }
  return rows;
}

/** Consommation pondérée par jour, tous workspaces confondus, triée par date ; `since` écarte les jours antérieurs. */
export function dailyTotals(rows, since) {
  const days = {};
  for (const r of rows) {
    for (const [day, d] of Object.entries(r.byDay ?? {})) {
      if (since && day < since) continue;
      const t = bucket(days, day, { day, turns: 0, weighted: 0 });
      t.turns += d.turns;
      t.weighted += d.weighted;
    }
  }
  return Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const since = opt("--since");
  const top = Number(opt("--top") ?? 10);
  const dirs = transcriptDirs({ dir: opt("--dir"), project: opt("--project"), exclude: opt("--exclude") });
  const rows = collectRows(dirs, { since, project: opt("--project") });
  if (rows.length === 0) {
    console.error("Aucun transcript trouvé.");
    process.exit(1);
  }
  const days = dailyTotals(rows, since);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ days, sessions: rows.length }, null, 2));
    return;
  }
  rows.sort((a, b) => weighted(b) - weighted(a));
  const sum = (k) => rows.reduce((acc, r) => acc + r[k], 0);
  console.log(`Sessions : ${rows.length}, tours : ${fmt(sum("turns"))}`);
  console.log(
    `Entrée : ${fmt(sum("input"))} | écriture cache : ${fmt(sum("cacheWrite"))} | lecture cache : ${fmt(sum("cacheRead"))} | sortie : ${fmt(sum("output"))}`,
  );
  const turns = sum("turns");
  console.log(
    `Moyenne par tour : ${fmt(Math.round((sum("cacheRead") + sum("cacheWrite") + sum("input")) / turns))} tokens de contexte lus`,
  );
  if (days.length > 0) {
    const total = days.reduce((acc, d) => acc + d.weighted, 0);
    console.log(
      `Moyenne par jour actif : ${fmt(Math.round(total / days.length))} (équivalent pondéré, ${days.length} jour(s))`,
    );
  }
  console.log(`Top ${top} sessions (équivalent pondéré) :`);
  for (const r of rows.slice(0, top)) {
    console.log(
      `  ${r.file.padEnd(16)} ${String(r.turns).padStart(5)} tours (${r.subagents} subagents)  ${fmt(weighted(r)).padStart(14)}  ${Object.keys(r.models).join(",")}`,
    );
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) main();
