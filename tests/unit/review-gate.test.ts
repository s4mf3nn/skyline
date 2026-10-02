import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/review-gate.mjs");
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

/** Dépôt temporaire avec un commit sur `origin/main` et un commit de travail au-dessus. */
function newRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "review-gate-"));
  repos.push(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  fs.writeFileSync(path.join(repo, "a.txt"), "a");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  fs.writeFileSync(path.join(repo, "b.txt"), "b");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "work");
  return repo;
}

function gate(repo: string, ...args: string[]) {
  const res = spawnSync("node", [script, ...args], { cwd: repo, encoding: "utf8", env: gitEnv });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

describe("scripts/review-gate.mjs", () => {
  it("records the reviewer model in the PR section when provided", () => {
    const repo = newRepo();
    expect(gate(repo, "record", "OK", "--loops", "2", "--model", "opus").code).toBe(0);
    const section = gate(repo, "section").out;
    expect(section).toContain("Verdict : OK");
    expect(section).toContain("Passages : 2");
    expect(section).toContain("Modèle du relecteur : opus");
    expect(gate(repo, "check").code).toBe(0);
  });

  it("requires the reviewer model in a high-risk zone only", () => {
    const repo = newRepo();
    fs.mkdirSync(path.join(repo, "scripts"), { recursive: true });
    fs.copyFileSync(path.resolve("scripts/pre-review.mjs"), path.join(repo, "scripts/pre-review.mjs"));
    fs.mkdirSync(path.join(repo, ".github"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, ".github/labeler.yml"),
      '"risk:high":\n  - changed-files:\n      - any-glob-to-any-file:\n          - "sensitive/**"\n',
    );
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "tooling");
    expect(gate(repo, "record", "OK").code).toBe(0);
    fs.mkdirSync(path.join(repo, "sensitive"));
    fs.writeFileSync(path.join(repo, "sensitive/a.txt"), "a");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "sensitive");
    const refused = gate(repo, "record", "OK");
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("--model");
    expect(gate(repo, "record", "OK", "--model", "opus").code).toBe(0);
  });

  it("adds no model line when none is provided", () => {
    const repo = newRepo();
    gate(repo, "record", "OK");
    expect(gate(repo, "section").out).not.toContain("Modèle du relecteur");
  });

  it("refuses the push when the code changed since the review or the verdict is not OK", () => {
    const repo = newRepo();
    expect(gate(repo, "check").code).toBe(1);
    gate(repo, "record", "CHANGEMENTS", "--model", "sonnet");
    expect(gate(repo, "check").err).toContain("CHANGEMENTS");
    gate(repo, "record", "OK");
    fs.writeFileSync(path.join(repo, "c.txt"), "c");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "more");
    expect(gate(repo, "check").err).toContain("Le code a changé");
  });
});
