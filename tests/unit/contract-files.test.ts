import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

interface ContractFiles {
  readRunners(pkg: unknown): Record<string, string>;
  groupByRunner(files: string[], runners: Record<string, string>): Map<string | null, string[]>;
}
const contractScript = path.resolve("scripts/contract-files.mjs");
const holdoutScript = path.resolve("scripts/holdout.mjs");
const mod = (await import(pathToFileURL(contractScript).href)) as ContractFiles;

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

// Lanceur factice : écrit un rapport au format de Jest, un test par fichier, en échec si le fichier contient FAIL.
const FAKE_RUNNER = `import fs from "node:fs";
const files = process.argv.slice(2);
const testResults = files.map((name) => {
  const failed = fs.readFileSync(name, "utf8").includes("FAIL");
  return { name, status: failed ? "failed" : "passed", assertionResults: [
    { fullName: name, status: failed ? "failed" : "passed", failureMessages: failed ? ["boom"] : [] },
  ] };
});
fs.writeFileSync(process.env.CONTRACT_REPORT, JSON.stringify({ testResults }));
process.exit(testResults.some((r) => r.status === "failed") ? 1 : 0);
`;

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-files-"));
  dirs.push(dir);
  const all: Record<string, string> = {
    "package.json": JSON.stringify({
      name: "t",
      scripts: { "test:fake": "node fake-runner.mjs" },
      factory: { contractRunners: { fake: "test:fake" } },
    }),
    "fake-runner.mjs": FAKE_RUNNER,
    ...files,
  };
  for (const [p, content] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), content);
  }
  return dir;
}

const node = (cwd: string, script: string, ...args: string[]) => {
  const res = spawnSync("node", [script, ...args], { cwd, encoding: "utf8" });
  return { code: res.status, out: res.stdout, err: res.stderr };
};

describe("scripts/contract-files.mjs", () => {
  it("reads the declared runners and rejects an invalid declaration", () => {
    const scripts = { "test:native": "jest" };
    expect(mod.readRunners(null)).toEqual({});
    expect(mod.readRunners({ scripts })).toEqual({});
    expect(mod.readRunners({ scripts, factory: { contractRunners: { native: "test:native" } } })).toEqual({
      native: "test:native",
    });
    expect(() => mod.readRunners({ scripts, factory: { contractRunners: { native: "test:absent" } } })).toThrow(
      /script "test:absent" absent/,
    );
    expect(() => mod.readRunners({ scripts, factory: { contractRunners: { Native: "test:native" } } })).toThrow(
      /Suffixe de lanceur invalide/,
    );
    expect(() => mod.readRunners({ scripts, factory: { contractRunners: ["test:native"] } })).toThrow(
      /doit être un objet/,
    );
  });

  it("groups files by runner, Vitest for unsuffixed or undeclared suffixes", () => {
    const groups = mod.groupByRunner(
      [
        "tests/holdout/SPEC-0001.test.ts",
        "tests/holdout/SPEC-0001.native.test.tsx",
        "tests/holdout/SPEC-0002.api.test.ts",
        "tests/holdout/SPEC-0002.native.test.tsx",
      ],
      { native: "test:native" },
    );
    expect([...groups]).toEqual([
      [null, ["tests/holdout/SPEC-0001.test.ts", "tests/holdout/SPEC-0002.api.test.ts"]],
      ["test:native", ["tests/holdout/SPEC-0001.native.test.tsx", "tests/holdout/SPEC-0002.native.test.tsx"]],
    ]);
  });

  it("run plays the contract files of a declared suffix with their script and fails when they fail", () => {
    const ok = project({ "tests/acceptance/SPEC-0001.fake.test.ts": "ok", "tests/acceptance/SPEC-0001.test.ts": "" });
    const res = node(ok, contractScript, "run");
    expect(res.code).toBe(0);
    expect(res.out).toContain("1 fichier(s) joué(s) par le script test:fake");
    const ko = project({ "tests/acceptance/SPEC-0001.fake.test.ts": "FAIL" });
    expect(node(ko, contractScript, "run").code).toBe(1);
  });

  it("run fails when the runner exits 0 without writing a report", () => {
    const dir = project({ "tests/acceptance/SPEC-0001.fake.test.ts": "ok", "fake-runner.mjs": "process.exit(0);" });
    const res = node(dir, contractScript, "run");
    expect(res.code).toBe(1);
    expect(res.err).toContain("n'a écrit aucun rapport");
  });

  it("run does nothing without a declared runner", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-files-none-"));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "t" }));
    const res = node(dir, contractScript, "run");
    expect(res.code).toBe(0);
    expect(res.out).toContain("aucun fichier confié à un autre lanceur");
  });

  it("holdout run plays the scenarios of a declared suffix with their runner and only prints a count", () => {
    const dir = project({
      "tests/acceptance/SPEC-0001.fake.test.ts": 'describe("x", () => {});',
      "tests/holdout/SPEC-0001.fake.test.ts": "ok",
      "tests/acceptance/SPEC-0002.fake.test.ts": 'describe("x", () => {});',
      "tests/holdout/SPEC-0002.fake.test.ts": "FAIL secret",
    });
    const res = node(dir, holdoutScript, "run");
    expect(res.code).toBe(1);
    expect(res.out).toContain("SPEC-0001 : 1/1 scénarios cachés passent");
    expect(res.out).toContain("SPEC-0002 : 0/1 scénarios cachés passent");
    expect(`${res.out}${res.err}`).not.toContain("boom");
    expect(node(dir, holdoutScript, "run", "--details").out).toContain("boom");
  });
});
