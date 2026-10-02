import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

interface InitFactory {
  TOKEN_FILES: string[];
  applyTokens(text: string, values: Record<string, string>): string;
  init(dir: string, name?: string, owner?: string): void;
}
const mod = (await import(pathToFileURL(path.resolve("scripts/init-factory.mjs")).href)) as InitFactory;

let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Dépôt factice : les fichiers que le script déplace, réécrit ou supprime. */
function newRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-factory-"));
  dirs.push(dir);
  const files: Record<string, string> = {
    "README.md": "# Guide du boilerplate\n",
    "README.project.md": "# {{PROJECT_NAME}}\n",
    "CLAUDE.md": "# CLAUDE.md : {{PROJECT_NAME}}\n",
    ".github/CODEOWNERS": "/specs/ @{{GITHUB_OWNER}}\n/scripts/ @{{GITHUB_OWNER}}\n",
    "package.json": '{ "name": "software-factory-boilerplate", "private": true }\n',
    "docs/factory/WORKFLOW.md": "inchangé {{PROJECT_NAME}}\n",
    "scripts/init-factory.mjs": "",
    "tests/unit/init-factory.test.ts": "",
  };
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), "utf8");

describe("scripts/init-factory.mjs", () => {
  it("remplace toutes les occurrences des jetons connus et laisse les autres", () => {
    expect(mod.applyTokens("{{A}} et {{A}}, {{B}}", { A: "x" })).toBe("x et x, {{B}}");
  });

  it("personnalise le dépôt, déplace le guide et se supprime", () => {
    const dir = newRepo();
    mod.init(dir, "mon-projet", "mon-org/equipe");
    expect(read(dir, "README.md")).toBe("# mon-projet\n");
    expect(read(dir, "docs/factory/BOILERPLATE.md")).toBe("# Guide du boilerplate\n");
    expect(read(dir, "CLAUDE.md")).toBe("# CLAUDE.md : mon-projet\n");
    expect(read(dir, ".github/CODEOWNERS")).toBe("/specs/ @mon-org/equipe\n/scripts/ @mon-org/equipe\n");
    expect(JSON.parse(read(dir, "package.json"))).toEqual({ name: "mon-projet", private: true });
    expect(fs.existsSync(path.join(dir, "README.project.md"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "scripts/init-factory.mjs"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "tests/unit/init-factory.test.ts"))).toBe(false);
  });

  it("ne touche pas aux fichiers hors de la liste", () => {
    const dir = newRepo();
    mod.init(dir, "mon-projet", "moi");
    expect(read(dir, "docs/factory/WORKFLOW.md")).toBe("inchangé {{PROJECT_NAME}}\n");
  });

  it.each([
    ["Mon Projet", "moi"],
    ["mon_projet", "moi"],
    ["mon-projet", "@moi"],
    ["mon-projet", ""],
  ])("refuse les arguments invalides (%s, %s) sans rien modifier", (name, owner) => {
    const dir = newRepo();
    expect(() => mod.init(dir, name, owner)).toThrow(/invalide/);
    expect(read(dir, "README.md")).toBe("# Guide du boilerplate\n");
  });

  it("refuse une seconde initialisation", () => {
    const dir = newRepo();
    mod.init(dir, "mon-projet", "moi");
    expect(() => mod.init(dir, "autre", "moi")).toThrow(/déjà initialisé/);
  });

  it("ne laisse aucun jeton dans les fichiers du boilerplate après initialisation", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-factory-"));
    dirs.push(dir);
    for (const file of ["README.md", "README.project.md", "package.json", ...mod.TOKEN_FILES.slice(1)]) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.copyFileSync(file, path.join(dir, file));
    }
    fs.mkdirSync(path.join(dir, "docs/factory"), { recursive: true });
    mod.init(dir, "mon-projet", "moi");
    for (const file of mod.TOKEN_FILES) expect(read(dir, file)).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});
