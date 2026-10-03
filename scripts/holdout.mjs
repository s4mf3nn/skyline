#!/usr/bin/env node
// Scénarios cachés (`tests/holdout/SPEC-XXXX.test.ts`, ou `.test.tsx` quand ils rendent une interface) : écrits avec
// la spec, validés par l'humain, jamais vus par l'agent producteur. Ils vérifient que l'implémentation satisfait
// l'intention, pas seulement les tests visibles.
// Une spec peut répartir son contrat et ses scénarios sur plusieurs fichiers suffixés (`SPEC-XXXX.api.test.ts`,
// `SPEC-XXXX.ui.test.tsx`), par exemple quand ils s'exécutent dans des environnements différents. Un suffixe déclaré
// dans package.json (`factory.contractRunners`, voir scripts/contract-files.mjs) est joué par son propre lanceur.
// Usage :
//   node scripts/holdout.mjs hide            retire tests/holdout de ce workspace (sparse-checkout), au début de /implement et de /fix
//   node scripts/holdout.mjs list            scénarios actifs : ceux dont le test de contrat n'a plus de `.skip`
//   node scripts/holdout.mjs run [--details] joue les scénarios actifs (code 1 si l'un échoue)
// Sans `--details`, la sortie se limite à un décompte par spec : le détail d'un échec est réservé à l'humain,
// sinon l'agent qui lit la CI apprendrait le scénario. Rapports complets dans .context/holdout-<lanceur>.json (hors git).
// Retour arrière de `hide` (humain) : git sparse-checkout disable.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACCEPTANCE_DIR,
  groupByRunner,
  HOLDOUT_DIR,
  readPackage,
  readRunners,
  runScript,
  specOf,
  testFiles,
} from "./contract-files.mjs";

export { HOLDOUT_DIR, specOf, suffixOf } from "./contract-files.mjs";

/** Textes de tous les fichiers de contrat d'une spec, quels que soient leur suffixe et leur extension. */
function readAcceptance(dir, spec) {
  return testFiles(dir, ACCEPTANCE_DIR)
    .filter((f) => specOf(f) === spec)
    .map((f) => fs.readFileSync(path.join(dir, ACCEPTANCE_DIR, f), "utf8"));
}

/** Les scénarios d'une spec sont joués quand elle a un contrat et qu'aucun de ses fichiers n'a encore de `.skip`. */
export function isActive(acceptanceTexts) {
  return acceptanceTexts.length > 0 && acceptanceTexts.every((text) => !/\.skip\s*\(/.test(text));
}

/** Fichiers de test du contrat ou des scénarios dont le nom n'est pas reconnu : ils ne seraient jamais joués. */
export function unrecognizedFiles(dir = process.cwd()) {
  return [ACCEPTANCE_DIR, HOLDOUT_DIR].flatMap((folder) =>
    testFiles(dir, folder)
      .filter((f) => specOf(f) === null)
      .map((f) => path.join(folder, f)),
  );
}

/** Signale les noms non reconnus ; renvoie true s'il y en a. */
function reportUnrecognized() {
  const bad = unrecognizedFiles();
  for (const f of bad)
    console.error(`Nom non reconnu : ${f} (attendu SPEC-XXXX.test.ts ou SPEC-XXXX.<suffixe>.test.ts, en .ts ou .tsx)`);
  return bad.length > 0;
}

/** Décompte par spec d'un rapport JSON de Vitest (ou de Jest, même format) : `{ spec, passed, total, failures, error }`. */
export function summarize(report) {
  return (report.testResults ?? [])
    .map((r) => {
      const tests = r.assertionResults ?? [];
      const failed = tests.filter((t) => t.status === "failed");
      return {
        spec: specOf(r.name) ?? path.basename(r.name),
        passed: tests.filter((t) => t.status === "passed").length,
        total: tests.length,
        failures: failed.map((t) => ({ title: t.fullName ?? t.title, messages: t.failureMessages ?? [] })),
        // Fichier en échec sans test en échec : erreur de chargement (import, syntaxe).
        error: r.status === "failed" && failed.length === 0 ? (r.message ?? "erreur de chargement") : null,
      };
    })
    .sort((a, b) => a.spec.localeCompare(b.spec));
}

/** Fichiers de scénarios présents dans `dir`, avec leur état d'activation. */
export function holdouts(dir = process.cwd()) {
  return testFiles(dir, HOLDOUT_DIR)
    .filter((f) => specOf(f) !== null)
    .map((f) => ({
      spec: specOf(f),
      file: path.join(HOLDOUT_DIR, f),
      active: isActive(readAcceptance(dir, specOf(f))),
    }));
}

function hide() {
  execFileSync("git", ["sparse-checkout", "set", "--no-cone", "/*", `!/${HOLDOUT_DIR}/`], { stdio: "inherit" });
  console.log(`${HOLDOUT_DIR} retiré de ce workspace (retour arrière, humain : git sparse-checkout disable).`);
  return 0;
}

function list() {
  if (reportUnrecognized()) return 2;
  const all = holdouts();
  if (!all.length) console.log("Aucun scénario caché dans ce workspace");
  for (const h of all) console.log(`${h.spec}  ${h.active ? "actif" : "inactif (test de contrat encore en .skip)"}`);
  return 0;
}

/**
 * Joue `files` sous Vitest (`script` null) ou avec le script déclaré, sortie capturée (jamais montrée sans --details).
 * Renvoie `{ report, code, output }` ; `report` est null si le lanceur n'a écrit aucun rapport.
 */
function play(script, files) {
  const out = path.join(".context", `holdout-${(script ?? "vitest").replace(/[^a-zA-Z0-9-]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(out, { force: true });
  const env = { ...process.env, HOLDOUT: "1" };
  const res =
    script === null
      ? spawnSync("pnpm", ["exec", "vitest", "run", ...files, "--reporter=json", `--outputFile=${out}`], {
          encoding: "utf8",
          env,
          maxBuffer: 256 * 1024 * 1024,
        })
      : runScript(script, files, out, { env, capture: true });
  return {
    report: fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null,
    code: res.status ?? res.error?.message,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}`,
  };
}

function run(details) {
  if (reportUnrecognized()) return 2;
  const active = holdouts().filter((h) => h.active);
  if (!active.length) {
    console.log("Scénarios cachés : aucun à jouer");
    return 0;
  }
  const groups = groupByRunner(
    active.map((h) => h.file),
    readRunners(readPackage()),
  );
  const rows = [];
  for (const [script, files] of groups) {
    const played = play(script, files);
    if (played.report === null) {
      const runner = script ?? "Vitest";
      console.error(`Scénarios cachés : ${runner} n'a produit aucun rapport (code ${played.code}).`);
      if (details) console.error(played.output);
      return 2;
    }
    rows.push(...summarize(played.report));
  }
  rows.sort((a, b) => a.spec.localeCompare(b.spec));
  let failed = false;
  for (const r of rows) {
    const ok = !r.error && r.passed === r.total;
    failed ||= !ok;
    console.log(`${r.spec} : ${r.passed}/${r.total} scénarios cachés passent${r.error ? " (fichier en erreur)" : ""}`);
    if (!details) continue;
    if (r.error) console.log(`  ${r.error}`);
    for (const f of r.failures) console.log(`  ÉCHEC ${f.title}\n${f.messages.map((m) => `    ${m}`).join("\n")}`);
  }
  if (failed && !details)
    console.error(
      "Détail réservé à l'humain : node scripts/holdout.mjs run --details (voir docs/factory/WORKFLOW.md).",
    );
  return failed ? 1 : 0;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === "hide") process.exit(hide());
    else if (cmd === "list") process.exit(list());
    else if (cmd === "run") process.exit(run(args.includes("--details")));
    else {
      console.error("Usage : node scripts/holdout.mjs hide | list | run [--details]");
      process.exit(2);
    }
  } catch (e) {
    console.error(`holdout : ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
