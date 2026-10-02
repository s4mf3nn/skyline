import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/security-scan.mjs");
let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Dossier de binaires factices : chaque outil de `tools` sort avec le code donné et écrit ses arguments dans `args.log`. */
function fakeBin(tools: Record<string, number>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "security-scan-"));
  dirs.push(dir);
  for (const [name, code] of Object.entries(tools)) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, `#!/bin/sh\necho "${name} $*" >> "${dir}/args.log"\nexit ${code}\n`);
    fs.chmodSync(file, 0o755);
  }
  return dir;
}

function run(bin: string, args: string[] = [], env: Record<string, string> = {}) {
  // PATH réduit au dossier factice : node est lancé par chemin absolu, les outils réels sont invisibles.
  const res = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { PATH: bin, ...env },
  });
  const log = path.join(bin, "args.log");
  return {
    code: res.status,
    out: res.stdout,
    err: res.stderr,
    calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "",
  };
}

describe("scripts/security-scan.mjs", () => {
  it("lance Semgrep avec les arguments de la CI", () => {
    const res = run(fakeBin({ semgrep: 0 }), ["semgrep"]);
    expect(res.code).toBe(0);
    expect(res.calls).toContain("semgrep scan --config auto --error --exclude tests");
  });

  it("lance gitleaks sur les commits de la branche, secrets masqués", () => {
    const res = run(fakeBin({ gitleaks: 0 }), ["gitleaks"], { BASE_REF: "origin/main" });
    expect(res.code).toBe(0);
    expect(res.calls).toContain("gitleaks git --log-opts=origin/main..HEAD --redact");
  });

  it("lance les deux outils par défaut", () => {
    const res = run(fakeBin({ semgrep: 0, gitleaks: 0 }));
    expect(res.code).toBe(0);
    expect(res.calls).toContain("semgrep");
    expect(res.calls).toContain("gitleaks");
  });

  it("échoue quand l'outil signale un constat", () => {
    const res = run(fakeBin({ semgrep: 1 }), ["semgrep"]);
    expect(res.code).toBe(1);
    expect(res.err).toContain("semgrep a signalé des constats");
  });

  it("échoue si un seul des deux outils signale un constat", () => {
    expect(run(fakeBin({ semgrep: 0, gitleaks: 1 })).code).toBe(1);
  });

  it("avertit sans échouer quand l'outil est absent en local", () => {
    const res = run(fakeBin({}), ["semgrep"]);
    expect(res.code).toBe(0);
    expect(res.err).toContain("Avertissement");
    expect(res.err).toContain("pipx install semgrep");
    expect(res.calls).toBe("");
  });

  it("échoue quand l'outil est absent en CI", () => {
    const res = run(fakeBin({}), ["semgrep"], { CI: "true" });
    expect(res.code).toBe(1);
    expect(res.err).toContain("En CI c'est une erreur");
  });

  it("échoue pour un outil inconnu", () => {
    const res = run(fakeBin({}), ["trivy"]);
    expect(res.code).toBe(1);
    expect(res.err).toContain('Outil inconnu : "trivy"');
  });
});

describe(".gitleaks.toml", () => {
  const config = fs.readFileSync(".gitleaks.toml", "utf8");

  it("étend les règles par défaut", () => {
    expect(config).toMatch(/\[extend\][^[]*useDefault\s*=\s*true/);
  });

  it("n'autorise les clés factices que dans les fichiers de test ET selon la convention (condition AND)", () => {
    const allowlist = config.split("[[allowlists]]")[1] ?? "";
    expect(allowlist).toMatch(/condition\s*=\s*"AND"/);
    expect(allowlist).toMatch(/regexes\s*=/);
    expect(allowlist).toMatch(/paths\s*=/);
  });

  it("ne couvre aucun chemin de code applicatif", () => {
    const paths = /paths\s*=\s*\[(.*)\]/.exec(config)?.[1] ?? "";
    expect(paths).not.toMatch(/src/);
    expect(paths).not.toMatch(/\.\*['"]/);
  });
});
