import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

interface Row {
  spec: string;
  passed: number;
  total: number;
  failures: { title: string; messages: string[] }[];
  error: string | null;
}
interface Holdout {
  specOf(file: string): string | null;
  isActive(acceptanceText: string | null): boolean;
  summarize(report: unknown): Row[];
  holdouts(dir: string): { spec: string; file: string; active: boolean }[];
}
const script = path.resolve("scripts/holdout.mjs");
const mod = (await import(pathToFileURL(script).href)) as Holdout;

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd,
    encoding: "utf8",
    env: gitEnv,
  });

function write(dir: string, files: Record<string, string>) {
  for (const [p, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), content);
  }
}

/** Dépôt temporaire qui contient `files`, et un worktree `ws` sur une branche de tâche. */
function newRepo(files: Record<string, string>): { main: string; ws: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "holdout-"));
  dirs.push(root);
  const main = path.join(root, "main");
  const ws = path.join(root, "ws");
  fs.mkdirSync(main);
  git(main, "init", "-q", "-b", "main");
  git(main, "config", "user.email", "t@example.com");
  git(main, "config", "user.name", "t");
  write(main, files);
  git(main, "add", "-A");
  git(main, "commit", "-q", "-m", "base");
  git(main, "worktree", "add", "-q", ws, "-b", "task");
  return { main, ws };
}

const run = (cwd: string, ...args: string[]) => {
  const res = spawnSync("node", [script, ...args], { cwd, encoding: "utf8", env: gitEnv });
  return { code: res.status, out: res.stdout, err: res.stderr };
};

describe("scripts/holdout.mjs", () => {
  it("reads the spec id from a scenario file name", () => {
    expect(mod.specOf("tests/holdout/SPEC-0003.test.ts")).toBe("SPEC-0003");
    expect(mod.specOf("/abs/tests/holdout/SPEC-0012.test.ts")).toBe("SPEC-0012");
    expect(mod.specOf("tests/holdout/helpers.ts")).toBeNull();
  });

  it("activates scenarios only when the contract test exists and has no .skip left", () => {
    expect(mod.isActive('describe("SPEC-0001", () => {});')).toBe(true);
    expect(mod.isActive('describe.skip("SPEC-0001", () => {});')).toBe(false);
    expect(mod.isActive('describe("a", () => { it.skip ("b", () => {}); });')).toBe(false);
    expect(mod.isActive(null)).toBe(false);
  });

  it("summarizes a Vitest report per spec, including failures and load errors", () => {
    const rows = mod.summarize({
      testResults: [
        {
          name: "/repo/tests/holdout/SPEC-0002.test.ts",
          status: "failed",
          assertionResults: [
            { fullName: "s > a", status: "passed", failureMessages: [] },
            { fullName: "s > b", status: "failed", failureMessages: ["expected 1 to be 2"] },
          ],
        },
        {
          name: "/repo/tests/holdout/SPEC-0001.test.ts",
          status: "failed",
          message: "Cannot find module",
          assertionResults: [],
        },
      ],
    });
    expect(rows.map((r) => r.spec)).toEqual(["SPEC-0001", "SPEC-0002"]);
    expect(rows[0]).toMatchObject({ passed: 0, total: 0, error: "Cannot find module" });
    expect(rows[1]).toMatchObject({ passed: 1, total: 2, error: null });
    expect(rows[1]?.failures).toEqual([{ title: "s > b", messages: ["expected 1 to be 2"] }]);
    expect(mod.summarize({})).toEqual([]);
  });

  it("lists the scenarios of a directory with their state", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holdout-list-"));
    dirs.push(dir);
    expect(mod.holdouts(dir)).toEqual([]);
    write(dir, {
      "tests/holdout/SPEC-0001.test.ts": "",
      "tests/holdout/SPEC-0002.test.ts": "",
      "tests/holdout/SPEC-0003.test.ts": "",
      "tests/holdout/notes.md": "",
      "tests/acceptance/SPEC-0001.test.ts": 'describe("x", () => {});',
      "tests/acceptance/SPEC-0002.test.ts": 'describe.skip("x", () => {});',
    });
    expect(mod.holdouts(dir).map((h) => [h.spec, h.active])).toEqual([
      ["SPEC-0001", true],
      ["SPEC-0002", false],
      ["SPEC-0003", false],
    ]);
  });

  it("hide removes tests/holdout from the workspace without touching the main checkout or git status", () => {
    const { main, ws } = newRepo({
      "tests/holdout/SPEC-0001.test.ts": "secret",
      "tests/acceptance/SPEC-0001.test.ts": "contrat",
      "src/a.ts": "a",
    });
    expect(run(ws, "hide").code).toBe(0);
    expect(fs.existsSync(path.join(ws, "tests/holdout"))).toBe(false);
    expect(fs.existsSync(path.join(ws, "tests/acceptance/SPEC-0001.test.ts"))).toBe(true);
    expect(git(ws, "status", "--porcelain")).toBe("");
    expect(fs.existsSync(path.join(main, "tests/holdout/SPEC-0001.test.ts"))).toBe(true);
    expect(run(ws, "hide").code).toBe(0);
    expect(run(ws, "list").out).toContain("Aucun scénario caché");
  });

  it("hide survives a rebase that brings new scenarios", () => {
    const { main, ws } = newRepo({ "tests/holdout/SPEC-0001.test.ts": "secret", "src/a.ts": "a" });
    run(ws, "hide");
    write(main, { "tests/holdout/SPEC-0002.test.ts": "autre", "src/b.ts": "b" });
    git(main, "add", "-A");
    git(main, "commit", "-q", "-m", "spec 2");
    write(ws, { "src/c.ts": "c" });
    git(ws, "add", "-A");
    git(ws, "-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "-m", "work");
    git(ws, "-c", "user.email=t@example.com", "-c", "user.name=t", "rebase", "-q", "main");
    expect(fs.existsSync(path.join(ws, "src/b.ts"))).toBe(true);
    expect(fs.existsSync(path.join(ws, "tests/holdout"))).toBe(false);
  });

  it("run plays nothing when no scenario is active, and rejects an unknown subcommand", () => {
    const { ws } = newRepo({
      "tests/holdout/SPEC-0001.test.ts": "secret",
      "tests/acceptance/SPEC-0001.test.ts": 'describe.skip("x", () => {});',
    });
    const res = run(ws, "run");
    expect(res.code).toBe(0);
    expect(res.out).toContain("aucun à jouer");
    expect(run(ws, "list").out).toContain("inactif");
    expect(run(ws, "nope").code).toBe(2);
  });
});
