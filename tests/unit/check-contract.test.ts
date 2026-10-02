import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/check-contract.mjs");
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

const BASE = {
  "tests/acceptance/SPEC-0001.test.ts": 'describe.skip("SPEC-0001", () => {});\n',
  "tests/holdout/SPEC-0001.test.ts": 'describe("scenarios", () => {});\n',
};

/** Dépôt dont origin/main contient BASE, avec `change` appliqué par-dessus en un seul commit. */
function repoWith(change: (repo: string) => void): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "check-contract-"));
  repos.push(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  for (const [p, content] of Object.entries(BASE)) {
    fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
    fs.writeFileSync(path.join(repo, p), content);
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  change(repo);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "change");
  return repo;
}

const check = (repo: string, labels = "") => {
  const res = spawnSync("node", [script], { cwd: repo, encoding: "utf8", env: { ...gitEnv, PR_LABELS: labels } });
  return { code: res.status, err: res.stderr };
};

describe("scripts/check-contract.mjs", () => {
  it("accepts removing .skip and adding a new hidden scenario", () => {
    const repo = repoWith((r) => {
      fs.writeFileSync(path.join(r, "tests/acceptance/SPEC-0001.test.ts"), 'describe("SPEC-0001", () => {});\n');
      fs.writeFileSync(path.join(r, "tests/holdout/SPEC-0002.test.ts"), "x\n");
    });
    expect(check(repo).code).toBe(0);
  });

  it("rejects a modified hidden scenario unless the contract-change label is set", () => {
    const repo = repoWith((r) => fs.writeFileSync(path.join(r, "tests/holdout/SPEC-0001.test.ts"), "changed\n"));
    const res = check(repo);
    expect(res.code).toBe(1);
    expect(res.err).toContain("tests/holdout/SPEC-0001.test.ts");
    expect(check(repo, "contract-change").code).toBe(0);
  });

  it("rejects a hidden scenario that is renamed away", () => {
    const repo = repoWith((r) =>
      fs.renameSync(path.join(r, "tests/holdout/SPEC-0001.test.ts"), path.join(r, "tests/holdout/SPEC-0002.test.ts")),
    );
    expect(check(repo).code).toBe(1);
  });

  it("rejects a contract test that is renamed away", () => {
    const repo = repoWith((r) =>
      fs.renameSync(
        path.join(r, "tests/acceptance/SPEC-0001.test.ts"),
        path.join(r, "tests/acceptance/SPEC-0002.test.ts"),
      ),
    );
    expect(check(repo).code).toBe(1);
  });

  it("rejects a contract test whose content changes beyond .skip", () => {
    const repo = repoWith((r) =>
      fs.writeFileSync(path.join(r, "tests/acceptance/SPEC-0001.test.ts"), 'describe("other", () => {});\n'),
    );
    expect(check(repo).code).toBe(1);
  });
});
