#!/usr/bin/env node
// Personnalise le boilerplate pour un nouveau projet, puis se supprime (script à usage unique).
// Usage :
//   node scripts/init-factory.mjs <nom-du-projet> <propriétaire-github> [--phase 1|2|3] [--description "<phrase>"]
// Lancé en général par la commande `/init-project`, qui pose les questions à ta place.
// Effets :
//   - remplace {{PROJECT_NAME}} et {{GITHUB_OWNER}} dans les fichiers de TOKEN_FILES ;
//   - renomme le paquet dans package.json ;
//   - déplace le guide du boilerplate (README.md) vers docs/factory/BOILERPLATE.md et installe README.project.md
//     comme README.md du projet ;
//   - avec --phase, fixe la phase d'autonomie de départ dans docs/factory/WORKFLOW.md (1 par défaut) ;
//   - avec --description, remplace la phrase d'accroche du README du projet ;
//   - supprime ce script, son test et la commande `/init-project`.
// N'utilise que la bibliothèque standard : à lancer avant `pnpm install`.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const PROJECT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// Utilisateur, organisation ou équipe (`org/equipe`), comme dans CODEOWNERS.
const GITHUB_OWNER = /^[A-Za-z0-9][A-Za-z0-9-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

/** Fichiers qui portent des jetons à remplacer (chemins après le déplacement des README). */
export const TOKEN_FILES = ["README.md", "CLAUDE.md", ".github/CODEOWNERS", ".gitleaks.toml", "docs/adr/0001-stack.md"];
const SELF = ["scripts/init-factory.mjs", "tests/unit/init-factory.test.ts", ".claude/commands/init-project.md"];
const PHASES = ["1", "2", "3"];
const PHASE_LINE = /Phase en cours : \d\./;
const DESCRIPTION_PLACEHOLDER = "<!-- À compléter : une phrase sur le produit. -->";

/** Remplace chaque `{{CLÉ}}` de `values` dans `text`. */
export function applyTokens(text, values) {
  let out = text;
  for (const [key, value] of Object.entries(values)) out = out.replaceAll(`{{${key}}}`, value);
  return out;
}

/** Fixe la phase d'autonomie dans le texte de WORKFLOW.md. */
export function applyPhase(text, phase) {
  return text.replace(PHASE_LINE, `Phase en cours : ${phase}.`);
}

/**
 * Personnalise le dépôt situé dans `dir`. `options.phase` ("1" à "3") et `options.description` sont facultatifs.
 * Lève une Error si un argument est invalide ou si c'est déjà fait.
 */
export function init(dir, name, owner, options = {}) {
  const { phase = "1", description } = options;
  if (!PROJECT_NAME.test(name ?? "")) throw new Error(`Nom de projet invalide : "${name ?? ""}" (kebab-case attendu)`);
  if (!GITHUB_OWNER.test(owner ?? "")) throw new Error(`Propriétaire GitHub invalide : "${owner ?? ""}"`);
  if (!PHASES.includes(phase)) throw new Error(`Phase invalide : "${phase}" (1, 2 ou 3 attendu)`);
  if (description?.includes("\n")) throw new Error("Description invalide : une seule ligne attendue");
  const at = (p) => path.join(dir, p);
  if (!fs.existsSync(at("README.project.md")))
    throw new Error("README.project.md absent : le dépôt est déjà initialisé.");
  // Contrôlé avant tout déplacement, pour ne jamais laisser un dépôt à moitié initialisé.
  const workflow = at("docs/factory/WORKFLOW.md");
  if (fs.existsSync(workflow) && !PHASE_LINE.test(fs.readFileSync(workflow, "utf8")))
    throw new Error('WORKFLOW.md ne contient pas la ligne "Phase en cours : N."');

  fs.renameSync(at("README.md"), at("docs/factory/BOILERPLATE.md"));
  fs.renameSync(at("README.project.md"), at("README.md"));

  if (description) {
    const readme = fs.readFileSync(at("README.md"), "utf8");
    // Fonction de remplacement : une chaîne interpréterait les motifs `$&`, `$$`... de la description.
    fs.writeFileSync(
      at("README.md"),
      readme.replace(`${DESCRIPTION_PLACEHOLDER}\n`, () => `${description}\n\n`),
    );
  }
  if (fs.existsSync(workflow)) fs.writeFileSync(workflow, applyPhase(fs.readFileSync(workflow, "utf8"), phase));

  const values = { PROJECT_NAME: name, GITHUB_OWNER: owner };
  for (const file of TOKEN_FILES) {
    if (!fs.existsSync(at(file))) continue;
    fs.writeFileSync(at(file), applyTokens(fs.readFileSync(at(file), "utf8"), values));
  }

  const pkg = JSON.parse(fs.readFileSync(at("package.json"), "utf8"));
  pkg.name = name;
  fs.writeFileSync(at("package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  for (const file of SELF) fs.rmSync(at(file), { force: true });
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  let name;
  let flags = {};
  try {
    const parsed = parseArgs({
      allowPositionals: true,
      options: { phase: { type: "string" }, description: { type: "string" } },
    });
    flags = parsed.values;
    let owner;
    [name, owner] = parsed.positionals;
    init(process.cwd(), name, owner, { phase: flags.phase, description: flags.description });
    console.log(
      `Factory initialisée pour ${name} (propriétaire : @${owner}, phase d'autonomie : ${flags.phase ?? "1"}).`,
    );
    console.log("Suite : docs/factory/BOILERPLATE.md, section « Démarrer un nouveau projet », étape 3.");
  } catch (e) {
    console.error(`init-factory : ${e instanceof Error ? e.message : e}`);
    console.error(
      "Usage : node scripts/init-factory.mjs <nom-du-projet> <propriétaire-github> [--phase 1|2|3] [--description '<phrase>']",
    );
    process.exit(1);
  }
}
