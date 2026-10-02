import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/lease.mjs");
let roots: string[] = [];

afterEach(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  roots = [];
});

function newRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lease-"));
  roots.push(root);
  return root;
}

function lease(root: string, workspace: string, ...args: string[]) {
  const res = spawnSync("node", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, CONDUCTOR_ROOT_PATH: root, CONDUCTOR_WORKSPACE_PATH: workspace },
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

describe("scripts/lease.mjs acquire", () => {
  it("pose un bail sur un périmètre libre", () => {
    const res = lease(newRoot(), "/ws/a", "acquire", "T1", "src");
    expect(res.code).toBe(0);
  });

  it("refuse un bail de même identifiant tenu par un autre workspace", () => {
    const root = newRoot();
    lease(root, "/ws/a", "acquire", "T1", "src");
    const res = lease(root, "/ws/b", "acquire", "T1", ".");
    expect(res.code).toBe(1);
    expect(res.err).toContain("/ws/a");
    expect(lease(root, "/ws/b", "list").out).toContain("T1  src");
  });

  it("reste idempotent quand le même workspace ré-acquiert son bail", () => {
    const root = newRoot();
    lease(root, "/ws/a", "acquire", "T1", "src");
    const res = lease(root, "/ws/a", "acquire", "T1", "src", "tests/unit");
    expect(res.code).toBe(0);
    expect(lease(root, "/ws/a", "list").out).toContain("src, tests/unit");
  });

  it("refuse un périmètre qui chevauche le bail d'une autre tâche", () => {
    const root = newRoot();
    lease(root, "/ws/a", "acquire", "T1", "src");
    const res = lease(root, "/ws/b", "acquire", "T2", "src/features");
    expect(res.code).toBe(1);
    expect(res.err).toContain("T1");
  });
});
