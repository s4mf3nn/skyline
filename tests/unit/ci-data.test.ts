import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/ci-data.sh");
let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

// Faux scripts/workspace-data.sh : note ses appels et écrit une variable dans .env.local.
const FAKE_WORKSPACE_DATA = `#!/usr/bin/env bash
echo "$1 $WORKSPACE_NAME $PROJECT_NAME" >> calls.log
if [ "$1" = setup ]; then printf '# commentaire\\n\\nDATABASE_URL=postgres://u:secret@h/db\\n' > .env.local; fi
`;

/** Dossier de projet temporaire avec `scripts/ci-data.sh` et, si demandé, le faux `workspace-data.sh`. */
function newProject(withWorkspaceData: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-data-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(script, path.join(dir, "scripts/ci-data.sh"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "@acme/Social-App" }));
  if (withWorkspaceData)
    fs.writeFileSync(path.join(dir, "scripts/workspace-data.sh"), FAKE_WORKSPACE_DATA, { mode: 0o755 });
  return dir;
}

function run(dir: string, args: string[], env: Record<string, string> = {}) {
  fs.writeFileSync(path.join(dir, "github.env"), "");
  const res = spawnSync("bash", ["scripts/ci-data.sh", ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      GITHUB_RUN_ID: "42",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_ENV: path.join(dir, "github.env"),
      ...env,
    },
  });
  const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : "");
  return { code: res.status, out: res.stdout, err: res.stderr, env: read("github.env"), calls: read("calls.log") };
}

describe("scripts/ci-data.sh", () => {
  it("does nothing without scripts/workspace-data.sh", () => {
    const res = run(newProject(false), ["setup"]);
    expect(res.code).toBe(0);
    expect(res.env).toBe("");
    expect(res.out).toContain("Aucun scripts/workspace-data.sh");
  });

  it("creates a resource named after the run and passes its variables to the next steps, masked", () => {
    const res = run(newProject(true), ["setup"]);
    expect(res.code).toBe(0);
    expect(res.calls).toBe("setup ci_42_2 _acme_social_app\n");
    expect(res.env).toBe(
      "WORKSPACE_NAME=ci_42_2\nPROJECT_NAME=_acme_social_app\nDATABASE_URL=postgres://u:secret@h/db\n",
    );
    expect(res.out).toContain("::add-mask::postgres://u:secret@h/db");
    expect(res.out).not.toContain("::add-mask::# commentaire");
  });

  it("appends the suffix to the resource name (one per e2e matrix entry)", () => {
    const res = run(newProject(true), ["setup", "e2e_node22"]);
    expect(res.calls).toBe("setup ci_42_2_e2e_node22 _acme_social_app\n");
    const dotted = run(newProject(true), ["setup", "E2E-node22.x"]);
    expect(dotted.calls).toBe("setup ci_42_2_e2e_node22_x _acme_social_app\n");
  });

  it("archives only the resource created by setup and ignores its failure", () => {
    const dir = newProject(true);
    expect(run(dir, ["archive"]).calls).toBe("");
    const res = run(dir, ["archive"], { WORKSPACE_NAME: "ci_42_2", PROJECT_NAME: "p" });
    expect(res.code).toBe(0);
    expect(res.calls).toBe("archive ci_42_2 p\n");

    fs.writeFileSync(path.join(dir, "scripts/workspace-data.sh"), "#!/usr/bin/env bash\nexit 3\n", { mode: 0o755 });
    expect(run(dir, ["archive"], { WORKSPACE_NAME: "ci_42_2" }).code).toBe(0);
  });

  it("rejects an unknown command", () => {
    const res = run(newProject(true), ["drop"]);
    expect(res.code).toBe(2);
    expect(res.err).toContain("Usage");
  });
});
