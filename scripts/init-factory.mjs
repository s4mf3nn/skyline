#!/usr/bin/env node
// Personnalise le boilerplate pour un nouveau projet, puis se supprime (script à usage unique).
// Usage :
//   node scripts/init-factory.mjs <nom-du-projet> <propriétaire-github>
// Effets :
//   - remplace {{PROJECT_NAME}} et {{GITHUB_OWNER}} dans les fichiers de TOKEN_FILES ;
//   - renomme le paquet dans package.json ;
//   - déplace le guide du boilerplate (README.md) vers docs/factory/BOILERPLATE.md et installe README.project.md
//     comme README.md du projet ;
//   - supprime ce script et son test.
// N'utilise que la bibliothèque standard : à lancer avant `pnpm install`.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// Utilisateur, organisation ou équipe (`org/equipe`), comme dans CODEOWNERS.
const GITHUB_OWNER = /^[A-Za-z0-9][A-Za-z0-9-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

/** Fichiers qui portent des jetons à remplacer (chemins après le déplacement des README). */
export const TOKEN_FILES = ["README.md", "CLAUDE.md", ".github/CODEOWNERS", ".gitleaks.toml", "docs/adr/0001-stack.md"];
const SELF = ["scripts/init-factory.mjs", "tests/unit/init-factory.test.ts"];

/** Remplace chaque `{{CLÉ}}` de `values` dans `text`. */
export function applyTokens(text, values) {
  let out = text;
  for (const [key, value] of Object.entries(values)) out = out.replaceAll(`{{${key}}}`, value);
  return out;
}

/** Personnalise le dépôt situé dans `dir`. Lève une Error si un argument est invalide ou si c'est déjà fait. */
export function init(dir, name, owner) {
  if (!PROJECT_NAME.test(name ?? "")) throw new Error(`Nom de projet invalide : "${name ?? ""}" (kebab-case attendu)`);
  if (!GITHUB_OWNER.test(owner ?? "")) throw new Error(`Propriétaire GitHub invalide : "${owner ?? ""}"`);
  const at = (p) => path.join(dir, p);
  if (!fs.existsSync(at("README.project.md")))
    throw new Error("README.project.md absent : le dépôt est déjà initialisé.");

  fs.renameSync(at("README.md"), at("docs/factory/BOILERPLATE.md"));
  fs.renameSync(at("README.project.md"), at("README.md"));

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
  const [name, owner] = process.argv.slice(2);
  try {
    init(process.cwd(), name, owner);
    console.log(`Factory initialisée pour ${name} (propriétaire : @${owner}).`);
    console.log("Suite : docs/factory/BOILERPLATE.md, section « Démarrer un nouveau projet », étape 3.");
  } catch (e) {
    console.error(`init-factory : ${e instanceof Error ? e.message : e}`);
    console.error("Usage : node scripts/init-factory.mjs <nom-du-projet> <propriétaire-github>");
    process.exit(1);
  }
}
