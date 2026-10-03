#!/usr/bin/env node
// Trace et contrôle de la revue adversariale locale.
// Le verdict est lié à l'empreinte (patch-id) du diff par rapport à la base : un simple rebase
// sans changement de contenu ne l'invalide pas, une nouvelle modification oui.
// Stocké dans <workspace>/.context/review.json (hors git).
// Usage :
//   node scripts/review-gate.mjs record <OK|CHANGEMENTS|BLOQUANT> [--loops N] [--model <modèle du relecteur>] [--blocking N] [--to-fix N]   (--model obligatoire en zone review:full)
//   node scripts/review-gate.mjs waive "<raison>"   (humain uniquement)
//   node scripts/review-gate.mjs check              (utilisé par le hook pre-push)
//   node scripts/review-gate.mjs section            (bloc Markdown pour le corps de la PR)
//   node scripts/review-gate.mjs verify-pr          (CI : PR_BODY, BASE_REF)
//   node scripts/review-gate.mjs journal            (journal des passages, en commentaire de PR)
//   node scripts/review-gate.mjs publish            (crée ou met à jour le commentaire « Journal des revues » de la PR)
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildComment, MARKER, specFromBranch } from "./review-journal.mjs";

const VERDICTS = ["OK", "CHANGEMENTS", "BLOQUANT"];
const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const base = process.env.BASE_REF ?? "origin/main";
const contextDir = path.join(sh("git rev-parse --show-toplevel"), ".context");
const file = path.join(contextDir, "review.json");
const journalFile = path.join(contextDir, "review-log.jsonl");

function fingerprint() {
  const out = execSync(`git diff ${base}...HEAD | git patch-id --stable`, { encoding: "utf8" }).trim();
  return out.split(/\s+/)[0] ?? "";
}

/** Niveau de revue du diff (`full` en zone `review:full` : code applicatif sensible). Inconnu si le script de pré-revue ne s'exécute pas. */
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

/** Type de diff (`spec` ou `code`), inconnu si le script de pré-revue ne s'exécute pas. */
function reviewKind() {
  try {
    return sh("node scripts/pre-review.mjs kind");
  } catch {
    return "inconnu";
  }
}

function loadJournal() {
  try {
    return fs
      .readFileSync(journalFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

/** Ajoute un passage au journal local (jamais réécrit : c'est ce qui conserve les rejets). */
function appendJournal(entry) {
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  const pass = loadJournal().filter((e) => e.branch === branch).length + 1;
  const line = { at: new Date().toISOString(), branch, spec: specFromBranch(branch), pass, ...entry };
  fs.mkdirSync(contextDir, { recursive: true });
  fs.appendFileSync(journalFile, `${JSON.stringify(line)}\n`);
}

/** Passages de la branche courante. */
function branchJournal() {
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  return loadJournal().filter((e) => e.branch === branch);
}

function numberOption(name) {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : undefined;
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
    fail("review:full zone: provide the reviewer model (--model <model>), see .claude/commands/review.md.");
  save({ verdict, patchId, loops, model, head: sh("git rev-parse HEAD"), at: new Date().toISOString() });
  appendJournal({
    verdict,
    kind: reviewKind(),
    level: reviewLevel(),
    model,
    blocking: numberOption("--blocking"),
    toFix: numberOption("--to-fix"),
    patchId: patchId.slice(0, 12),
  });
  console.log(`Revue enregistrée : ${verdict} (patch-id ${patchId.slice(0, 12)}, ${loops} passage(s))`);
} else if (cmd === "waive") {
  const reason = args.join(" ").trim();
  if (!reason) fail('Une raison est obligatoire : waive "<raison>"');
  const patchId = fingerprint();
  if (!patchId) fail(`Diff vide par rapport à ${base}.`);
  save({ verdict: "WAIVED", reason, patchId, head: sh("git rev-parse HEAD"), at: new Date().toISOString() });
  appendJournal({ verdict: "WAIVED", reason, patchId: patchId.slice(0, 12) });
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
} else if (cmd === "journal") {
  const entries = branchJournal();
  if (entries.length === 0) fail("Aucun passage de revue dans le journal local.");
  console.log(buildComment(entries));
} else if (cmd === "publish") {
  const entries = branchJournal();
  if (entries.length === 0) fail("Aucun passage de revue dans le journal local.");
  const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const bodyFile = path.join(contextDir, "review-log-comment.md");
  fs.writeFileSync(bodyFile, `${buildComment(entries)}\n`);
  try {
    const number = gh("pr", "view", "--json", "number", "--jq", ".number");
    const repo = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner");
    const jq = `.[] | select(.body | contains("${MARKER}")) | .id`;
    const existing = gh("api", "--paginate", `repos/${repo}/issues/${number}/comments`, "--jq", jq).split("\n")[0];
    if (existing) gh("api", "-X", "PATCH", `repos/${repo}/issues/comments/${existing}`, "-F", `body=@${bodyFile}`);
    else gh("pr", "comment", number, "--body-file", bodyFile);
  } catch (e) {
    fail(`Publication du journal impossible (PR absente ou gh indisponible) : ${e.stderr ?? e.message}`);
  }
  console.log(`Journal des revues publié (${entries.length} passage(s)).`);
} else {
  fail("Usage : review-gate.mjs record|waive|check|section|verify-pr|journal|publish");
}
