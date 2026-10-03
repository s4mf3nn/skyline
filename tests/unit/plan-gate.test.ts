import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/plan-gate.mjs");
let repos: string[] = [];

afterEach(() => {
  for (const r of repos) fs.rmSync(r, { recursive: true, force: true });
  repos = [];
});

const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd,
    encoding: "utf8",
    env: gitEnv,
  });

/** Dépôt temporaire dont `origin/main` contient `files` ; `local` n'existe que dans l'arbre de travail. */
function newRepo(files: Record<string, string>, local: Record<string, string> = {}): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "plan-gate-"));
  repos.push(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  const write = (set: Record<string, string>) => {
    for (const [p, content] of Object.entries(set)) {
      fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
      fs.writeFileSync(path.join(repo, p), content);
    }
  };
  write({ "README.md": "x", ...files });
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  write(local);
  return repo;
}

function check(repo: string, args: string[], env: Record<string, string> = {}, scriptPath = script) {
  const res = spawnSync("node", [scriptPath, "check", ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...gitEnv, PLAN_GATE_NO_FETCH: "1", ...env },
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

const PLAN = "# Plan\nStatut : PRÊT\n\n### T1 : première\n- Périmètre : src/a\n\n### T2 : seconde\n";

describe("scripts/plan-gate.mjs check", () => {
  it("réussit quand plan.md est sur origin/main", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": PLAN });
    const res = check(repo, ["SPEC-0002"]);
    expect(res.code).toBe(0);
    expect(res.out).toContain("specs/SPEC-0002-redirect/plan.md");
  });

  it("échoue quand plan.md n'existe que dans l'arbre de travail (non fusionné)", () => {
    const repo = newRepo({}, { "specs/SPEC-0002-redirect/plan.md": PLAN });
    const res = check(repo, ["SPEC-0002"]);
    expect(res.code).toBe(1);
    expect(res.err).toContain("n'est pas sur origin/main");
  });

  it("échoue quand plan.md est commité mais pas sur origin/main", () => {
    const repo = newRepo({});
    fs.mkdirSync(path.join(repo, "specs/SPEC-0002-redirect"), { recursive: true });
    fs.writeFileSync(path.join(repo, "specs/SPEC-0002-redirect/plan.md"), PLAN);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "plan");
    expect(check(repo, ["SPEC-0002"]).code).toBe(1);
  });

  it("échoue pour une autre spec, même si une spec voisine a un plan", () => {
    const repo = newRepo({ "specs/SPEC-0001-create-link/plan.md": PLAN });
    expect(check(repo, ["SPEC-0002"]).code).toBe(1);
  });

  it("vérifie que la tâche est définie dans le plan fusionné", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": PLAN });
    expect(check(repo, ["SPEC-0002", "T2"]).code).toBe(0);
    const res = check(repo, ["SPEC-0002", "T3"]);
    expect(res.code).toBe(1);
    expect(res.err).toContain("T3");
  });

  it("refuse un identifiant de spec ou de tâche mal formé", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": PLAN });
    expect(check(repo, ["0002"]).code).toBe(1);
    expect(check(repo, ["SPEC-0002", "tâche"]).code).toBe(1);
  });

  it("sort en erreur d'usage sans sous-commande valide", () => {
    const repo = newRepo({});
    const res = spawnSync("node", [script], { cwd: repo, encoding: "utf8" });
    expect(res.status).toBe(2);
  });

  it("échoue quand le plan fusionné n'est pas au statut PRÊT", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": PLAN.replace("PRÊT", "BLOQUÉ") });
    const res = check(repo, ["SPEC-0002"]);
    expect(res.code).toBe(1);
    expect(res.err).toContain("BLOQUÉ");
  });

  it("échoue quand deux dossiers correspondent à la même spec", () => {
    const repo = newRepo({
      "specs/SPEC-0002-a/plan.md": PLAN,
      "specs/SPEC-0002-b/plan.md": PLAN,
    });
    expect(check(repo, ["SPEC-0002"]).code).toBe(1);
  });

  it("ne confond pas T1 avec T10 et accepte « ### T1: » sans espace avant les deux-points", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": "Statut : PRÊT\n### T10 : dix\n### T2: deux\n" });
    expect(check(repo, ["SPEC-0002", "T1"]).code).toBe(1);
    expect(check(repo, ["SPEC-0002", "T2"]).code).toBe(0);
  });

  it("ignore un dossier au slug vide et un plan.md imbriqué", () => {
    const repo = newRepo({
      "specs/SPEC-0002-/plan.md": PLAN,
      "specs/SPEC-0002-x/sub/plan.md": PLAN,
    });
    expect(check(repo, ["SPEC-0002"]).code).toBe(1);
  });

  it("sort en erreur (2) quand la base n'existe pas", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": PLAN });
    expect(check(repo, ["SPEC-0002"], { BASE_REF: "origin/inexistante" }).code).toBe(2);
  });

  it("sort en erreur (2) quand le fetch est impossible", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/plan.md": PLAN });
    const res = check(repo, ["SPEC-0002"], { PLAN_GATE_NO_FETCH: "" });
    expect(res.code).toBe(2);
    expect(res.err).toContain("git fetch origin impossible");
  });

  it("fails when a dependency is not delivered (a contract file still has .skip)", () => {
    const repo = newRepo({
      "specs/SPEC-0002-redirect/plan.md": PLAN,
      "specs/SPEC-0002-redirect/spec.md": "# SPEC-0002\nDépend de : SPEC-0000, SPEC-0001\n",
      "tests/acceptance/SPEC-0000.test.ts": 'describe("SPEC-0000", () => {});\n',
      "tests/acceptance/SPEC-0001.api.test.ts": 'describe("SPEC-0001 api", () => {});\n',
      "tests/acceptance/SPEC-0001.ui.test.tsx": 'describe.skip("SPEC-0001 ui", () => {});\n',
    });
    const res = check(repo, ["SPEC-0002", "T1"]);
    expect(res.code).toBe(1);
    expect(res.err).toContain("SPEC-0001");
    expect(res.err).not.toContain("SPEC-0000,");
  });

  it("passes when every dependency is delivered", () => {
    const repo = newRepo({
      "specs/SPEC-0002-redirect/plan.md": PLAN,
      "specs/SPEC-0002-redirect/spec.md": "# SPEC-0002\nDépend de : SPEC-0001\n",
      "tests/acceptance/SPEC-0001.test.ts": 'describe("SPEC-0001", () => {});\n',
    });
    const res = check(repo, ["SPEC-0002", "T1"]);
    expect(res.code).toBe(0);
    expect(res.out).toContain("Dépendances de SPEC-0002 livrées : SPEC-0001");
  });

  it("treats a dependency without a contract on the base as not delivered", () => {
    const repo = newRepo({ "specs/SPEC-0002-redirect/spec.md": "Dépend de : SPEC-0001\n" });
    expect(
      spawnSync("node", [script, "deps", "SPEC-0002"], { cwd: repo, env: { ...gitEnv, PLAN_GATE_NO_FETCH: "1" } })
        .status,
    ).toBe(1);
  });

  it("deps accepts « aucune » and a spec without the line, rejects the template text", () => {
    const repo = newRepo({
      "specs/SPEC-0001-a/spec.md": "Dépend de : aucune\n",
      "specs/SPEC-0002-b/spec.md": "# sans dépendance déclarée\n",
      "specs/SPEC-0003-c/spec.md": "Dépend de : aucune | SPEC-XXXX\n",
    });
    const deps = (spec: string) =>
      spawnSync("node", [script, "deps", spec], {
        cwd: repo,
        encoding: "utf8",
        env: { ...gitEnv, PLAN_GATE_NO_FETCH: "1" },
      });
    expect(deps("SPEC-0001").status).toBe(0);
    expect(deps("SPEC-0002").status).toBe(0);
    const bad = deps("SPEC-0003");
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("illisible");
    const missing = deps("SPEC-0009");
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Fusionne d'abord la PR de spec");
  });

  it("s'exécute aussi depuis un chemin contenant des espaces (pas de faux OK silencieux)", () => {
    const repo = newRepo({});
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan gate "));
    repos.push(dir);
    // plan-gate.mjs importe ses voisins : ils sont copiés avec lui.
    for (const name of ["plan-gate.mjs", "holdout.mjs", "contract-files.mjs"])
      fs.copyFileSync(path.resolve("scripts", name), path.join(dir, name));
    const copy = path.join(dir, "plan-gate.mjs");
    const res = check(repo, ["SPEC-0002"], {}, copy);
    expect(res.code).toBe(1);
    expect(res.err).toContain("n'est pas sur origin/main");
  });
});
