#!/usr/bin/env node
// Trace et contrôle de la revue adversariale locale.
// Le verdict est lié à l'empreinte (patch-id) du diff par rapport à la base : un simple rebase
// sans changement de contenu ne l'invalide pas, une nouvelle modification oui.
// Stocké dans <workspace>/.context/review.json (hors git).
// Usage :
//   node scripts/review-gate.mjs record <OK|CHANGEMENTS|BLOQUANT> [--loops N] [--model <modèle du relecteur>]   (obligatoire en zone à risque élevé)
//   node scripts/review-gate.mjs waive "<raison>"   (humain uniquement)
//   node scripts/review-gate.mjs check              (utilisé par le hook pre-push)
//   node scripts/review-gate.mjs section            (bloc Markdown pour le corps de la PR)
//   node scripts/review-gate.mjs verify-pr          (CI : PR_BODY, BASE_REF)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const VERDICTS = ["OK", "CHANGEMENTS", "BLOQUANT"];
const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const base = process.env.BASE_REF ?? "origin/main";
const file = path.join(sh("git rev-parse --show-toplevel"), ".context", "review.json");

function fingerprint() {
  const out = execSync(`git diff ${base}...HEAD | git patch-id --stable`, { encoding: "utf8" }).trim();
  return out.split(/\s+/)[0] ?? "";
}

/** Niveau de revue du diff (`full` en zone à risque élevé). Inconnu si le script de pré-revue ne s'exécute pas. */
function reviewLevel() {
  try {
    return sh("node scripts/pre-review.mjs level");
  } catch {
    return "inconnu";
  }
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "record") {
  const verdict = args[0];
  if (!VERDICTS.includes(verdict)) fail(`Verdict invalide. Attendu : ${VERDICTS.join(" | ")}`);
  const i = args.indexOf("--loops");
  const loops = i >= 0 ? Number(args[i + 1]) : 1;
  const m = args.indexOf("--model");
  const model = m >= 0 ? args[m + 1] : undefined;
  const patchId = fingerprint();
  if (!patchId) fail(`Diff vide par rapport à ${base} : rien à relire.`);
  if (!model && reviewLevel() === "full")
    fail("Zone à risque élevé : indique le modèle du relecteur (--model <modèle>), voir .claude/commands/review.md.");
  save({ verdict, patchId, loops, model, head: sh("git rev-parse HEAD"), at: new Date().toISOString() });
  console.log(`Revue enregistrée : ${verdict} (patch-id ${patchId.slice(0, 12)}, ${loops} passage(s))`);
} else if (cmd === "waive") {
  const reason = args.join(" ").trim();
  if (!reason) fail('Une raison est obligatoire : waive "<raison>"');
  const patchId = fingerprint();
  if (!patchId) fail(`Diff vide par rapport à ${base}.`);
  save({ verdict: "WAIVED", reason, patchId, head: sh("git rev-parse HEAD"), at: new Date().toISOString() });
  console.log(`Revue écartée par un humain : ${reason}`);
} else if (cmd === "check") {
  const r = load();
  if (!r) fail("Aucune revue locale enregistrée. Lance /review (ou /ship) avant de pousser.");
  const patchId = fingerprint();
  if (!patchId) process.exit(0);
  if (r.patchId !== patchId) fail("Le code a changé depuis la dernière revue. Relance /review.");
  if (r.verdict !== "OK" && r.verdict !== "WAIVED") {
    fail(`Dernier verdict : ${r.verdict}. Corrige puis relance /review.`);
  }
  console.log(`Revue locale à jour : ${r.verdict}`);
} else if (cmd === "section") {
  const r = load();
  if (!r) fail("Aucune revue locale enregistrée.");
  const lines = ["## Revue locale", `Verdict : ${r.verdict}`, `Patch-id : ${r.patchId}`];
  if (r.loops) lines.push(`Passages : ${r.loops}`);
  if (r.model) lines.push(`Modèle du relecteur : ${r.model}`);
  if (r.reason) lines.push(`Raison de l'exception : ${r.reason}`);
  console.log(lines.join("\n"));
} else if (cmd === "verify-pr") {
  const body = process.env.PR_BODY ?? "";
  const verdict = body.match(/^Verdict : (\w+)\s*$/m)?.[1];
  const patchId = body.match(/^Patch-id : (\w+)\s*$/m)?.[1];
  if (!verdict || !patchId) fail("Section « Revue locale » absente ou incomplète dans le corps de la PR.");
  if (verdict !== "OK" && verdict !== "WAIVED") fail(`Verdict de revue locale : ${verdict}.`);
  if (patchId !== fingerprint())
    fail("Le patch-id de la revue ne correspond plus au diff de la PR : relance /review puis /ship.");
  console.log(`Trace de revue cohérente : ${verdict}`);
} else {
  fail("Usage : review-gate.mjs record|waive|check|section|verify-pr");
}
