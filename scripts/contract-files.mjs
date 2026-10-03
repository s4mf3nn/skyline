#!/usr/bin/env node
// Fichiers du contrat (`tests/acceptance/`) et des scénarios cachés (`tests/holdout/`) : nommage et lanceur.
// Nom : `SPEC-XXXX.test.ts(x)`, ou `SPEC-XXXX.<suffixe>.test.ts(x)` quand une spec répartit son contrat.
// Par défaut, tout tourne sous Vitest. Un projet dont certains tests ne peuvent pas tourner sous Vitest (ex. rendu
// d'écrans React Native) les confie à un autre lanceur, par suffixe, dans package.json :
//   "factory": { "contractRunners": { "<suffixe>": "<nom d'un script de package.json>" } }
// Le script reçoit les fichiers en arguments et la variable CONTRACT_REPORT : il écrit à ce chemin un rapport JSON au
// format de Jest (ex. `jest --json --outputFile=$CONTRACT_REPORT`), celui que produit aussi le rapporteur JSON de Vitest.
// Usage :
//   node scripts/contract-files.mjs run    joue les tests de contrat confiés à un autre lanceur (pnpm verify, CI)
//   node scripts/contract-files.mjs list   suffixes déclarés et script associé
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ACCEPTANCE_DIR = "tests/acceptance";
export const HOLDOUT_DIR = "tests/holdout";
const FILE = /^(SPEC-\d{4})(?:\.([a-z][a-z0-9-]*))?\.test\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const SUFFIX = /^[a-z][a-z0-9-]*$/;

/** Identifiant de spec d'un fichier de contrat ou de scénarios (`SPEC-0003.test.ts`), ou null. */
export function specOf(file) {
  return FILE.exec(path.basename(file))?.[1] ?? null;
}

/** Suffixe d'un fichier de contrat ou de scénarios (`api` pour `SPEC-0003.api.test.ts`), ou null. */
export function suffixOf(file) {
  return FILE.exec(path.basename(file))?.[2] ?? null;
}

/** Fichiers de test de `folder` (relatif à `dir`), triés ; liste vide si le dossier n'existe pas. */
export function testFiles(dir, folder) {
  if (!fs.existsSync(path.join(dir, folder))) return [];
  return fs
    .readdirSync(path.join(dir, folder))
    .filter((f) => TEST_FILE.test(f))
    .sort();
}

/**
 * Lanceurs déclarés dans `package.json` (`factory.contractRunners`) : `{ suffixe: script }`, vide sans déclaration.
 * Lève une Error si la déclaration est invalide ou renvoie à un script absent.
 */
export function readRunners(pkg) {
  const runners = pkg?.factory?.contractRunners ?? {};
  if (typeof runners !== "object" || Array.isArray(runners))
    throw new Error("factory.contractRunners doit être un objet { suffixe: script }");
  for (const [suffix, script] of Object.entries(runners)) {
    if (!SUFFIX.test(suffix)) throw new Error(`Suffixe de lanceur invalide : "${suffix}" (minuscules, chiffres, -)`);
    if (typeof script !== "string" || pkg.scripts?.[script] === undefined)
      throw new Error(`Lanceur du suffixe "${suffix}" : script "${script}" absent de package.json`);
  }
  return runners;
}

/** `package.json` de `dir`, ou null s'il n'existe pas. */
export function readPackage(dir = process.cwd()) {
  const file = path.join(dir, "package.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

/** Regroupe `files` par lanceur : clé `null` pour Vitest, sinon le nom du script déclaré pour leur suffixe. */
export function groupByRunner(files, runners) {
  const groups = new Map();
  for (const file of files) {
    const suffix = suffixOf(file);
    const script = suffix !== null && Object.hasOwn(runners, suffix) ? runners[suffix] : null;
    groups.set(script, [...(groups.get(script) ?? []), file]);
  }
  return groups;
}

/** Lance le script `script` sur `files` ; le rapport JSON est attendu à `report`. */
export function runScript(script, files, report, { env = process.env, capture = false } = {}) {
  return spawnSync("pnpm", ["run", "--silent", script, ...files], {
    encoding: "utf8",
    env: { ...env, CONTRACT_REPORT: path.resolve(report) },
    stdio: capture ? "pipe" : "inherit",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** Joue les tests de contrat confiés à un autre lanceur ; Vitest joue les autres dans `pnpm test`. */
function runAcceptance() {
  const runners = readRunners(readPackage());
  const files = testFiles(process.cwd(), ACCEPTANCE_DIR).map((f) => path.join(ACCEPTANCE_DIR, f));
  const groups = [...groupByRunner(files, runners)].filter(([script]) => script !== null);
  if (!groups.length) {
    console.log("Contrat : aucun fichier confié à un autre lanceur que Vitest");
    return 0;
  }
  let code = 0;
  for (const [script, group] of groups) {
    console.log(`Contrat : ${group.length} fichier(s) joué(s) par le script ${script}`);
    const report = path.join(".context", `contract-${script.replace(/[^a-zA-Z0-9-]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(report), { recursive: true });
    fs.rmSync(report, { force: true });
    const res = runScript(script, group, report);
    if (res.status !== 0) {
      console.error(`Contrat : échec du script ${script} (code ${res.status ?? res.error?.message})`);
      code = 1;
    } else if (!fs.existsSync(report)) {
      // Un lanceur qui sort en 0 sans rapport n'a peut-être rien joué : même exigence que scripts/holdout.mjs.
      console.error(`Contrat : le script ${script} n'a écrit aucun rapport dans $CONTRACT_REPORT`);
      code = 1;
    }
  }
  return code;
}

function list() {
  const runners = readRunners(readPackage());
  if (!Object.keys(runners).length) console.log("Aucun lanceur déclaré : tout le contrat tourne sous Vitest");
  for (const [suffix, script] of Object.entries(runners)) console.log(`SPEC-XXXX.${suffix}.test.ts(x)  ->  ${script}`);
  return 0;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const cmd = process.argv[2];
  try {
    if (cmd === "run") process.exit(runAcceptance());
    else if (cmd === "list") process.exit(list());
    else {
      console.error("Usage : node scripts/contract-files.mjs run | list");
      process.exit(2);
    }
  } catch (e) {
    console.error(`contract-files : ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
