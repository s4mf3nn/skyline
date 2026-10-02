#!/usr/bin/env node
// Vérifie qu'une PR ne modifie les tests de contrat (tests/acceptance) qu'en retirant `.skip`.
// Contournement possible uniquement avec le label `contract-change`, posé par un humain.
import { execSync } from "node:child_process";

const base = process.env.BASE_REF ?? "origin/main";
const labels = (process.env.PR_LABELS ?? "").split(",");
if (labels.includes("contract-change")) {
  console.log("Label contract-change présent : contrôle ignoré.");
  process.exit(0);
}

const sh = (c) => execSync(c, { encoding: "utf8" });
const changed = sh(`git diff --name-only --diff-filter=M ${base}...HEAD -- tests/acceptance`)
  .split("\n")
  .filter(Boolean);
const normalize = (s) => s.replace(/describe\.skip\(/g, "describe(");

let failed = false;
for (const f of changed) {
  const before = normalize(sh(`git show ${base}:${f}`));
  const after = normalize(sh(`git show HEAD:${f}`));
  if (before !== after) {
    console.error(`Contrat modifié : ${f} (seul le retrait de .skip est autorisé)`);
    failed = true;
  }
}
const deleted = sh(`git diff --name-only --diff-filter=D ${base}...HEAD -- tests/acceptance`).trim();
if (deleted) {
  console.error(`Tests de contrat supprimés : ${deleted}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
