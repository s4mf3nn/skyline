import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface PreReview {
  globMatch(glob: string, file: string): boolean;
  workMode(hasLease: boolean, branch: string): string;
  isFixBranch(branch: string): boolean;
  hasRegressionTest(files: string[]): boolean;
  labelGlobs(text: string, label: string): string[];
  labelNames(text: string): string[];
  deadZones(text: string, files: string[]): { label: string; glob: string }[];
  unprotectedSqlFiles(text: string, files: string[]): string[];
  reviewLevel(files: string[], labeler: string): string;
  reviewKind(files: string[]): string;
  inPerimeter(file: string, paths: string[]): boolean;
  addedDependencies(before: string | null, after: string | null): string[];
  summarySection(text: string, title: string): string | null;
  checkSummary(summary: string | null, added: string[]): string[];
}
const mod = (await import(pathToFileURL(path.resolve("scripts/pre-review.mjs")).href)) as PreReview;

const labeler = `# commentaire
"review:full":
  - changed-files:
      - any-glob-to-any-file:
          - "src/features/redirect/**"

"risk:high":
  - changed-files:
      - any-glob-to-any-file:
          - "src/features/redirect/**"
          - "scripts/**"
          - "web/index.html"

"risk:medium":
  - changed-files:
      - any-glob-to-any-file:
          - "src/features/**/service.ts"
          - "web/**"

"contract":
  - changed-files:
      - any-glob-to-any-file:
          - "tests/acceptance/**"
`;

describe("scripts/pre-review.mjs", () => {
  it("convertit les globs du labeler", () => {
    const g = (glob: string, file: string) => mod.globMatch(glob, file);
    expect(g("src/features/**/service.ts", "src/features/links/service.ts")).toBe(true);
    expect(g("src/features/**/service.ts", "src/features/service.ts")).toBe(true);
    expect(g("src/features/**/service.ts", "src/features/links/repo.ts")).toBe(false);
    expect(g("web/**", "web/src/App.tsx")).toBe(true);
    expect(g("web/index.html", "web/indexXhtml")).toBe(false);
    expect(g("*.md", "a/b.md")).toBe(false);
  });

  it("couvre les cas limites des globs", () => {
    const g = (glob: string, file: string) => mod.globMatch(glob, file);
    expect(g("**/x.ts", "x.ts")).toBe(true);
    expect(g("**/x.ts", "a/b/x.ts")).toBe(true);
    expect(g("**/x.ts", "a/bx.ts")).toBe(false);
    expect(g("a/**b", "a/c/d/b")).toBe(true);
    expect(g("a*b", "axxb")).toBe(true);
    expect(g("a*b", "a/b")).toBe(false);
    expect(g("src/*", "src/a/b")).toBe(false);
    expect(g("a.b", "aXb")).toBe(false);
    expect(g("a+(b)[c]", "a+(b)[c]")).toBe(true);
    expect(g("", "")).toBe(true);
    expect(g("", "a")).toBe(false);
    expect(g("a", "ab")).toBe(false);
    expect(g("**/**/**/x", `${"a/".repeat(40)}y`)).toBe(false);
  });

  it("équivaut à l'ancienne conversion par RegExp (test différentiel)", () => {
    const legacy = (glob: string, file: string) => {
      let re = "";
      for (let i = 0; i < glob.length; i++) {
        const c = glob[i] as string;
        if (c === "*" && glob[i + 1] === "*") {
          if (glob[i + 2] === "/") {
            re += "(?:.*/)?";
            i += 2;
          } else {
            re += ".*";
            i += 1;
          }
        } else if (c === "*") re += "[^/]*";
        else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      }
      return new RegExp(`^${re}$`).test(file);
    };
    const words = (alphabet: string[], max: number): string[] => {
      let all = [""];
      let layer = [""];
      for (let n = 0; n < max; n++) {
        layer = layer.flatMap((w) => alphabet.map((c) => w + c));
        all = all.concat(layer);
      }
      return all;
    };
    const globs = words(["a", ".", "/", "*"], 5);
    const files = words(["a", ".", "/"], 4);
    const mismatches = globs.flatMap((glob) =>
      files.filter((file) => mod.globMatch(glob, file) !== legacy(glob, file)).map((file) => `${glob} ~ ${file}`),
    );
    expect(mismatches).toEqual([]);
  });

  it("distingue le travail de spec de l'outillage", () => {
    expect(mod.workMode(true, "main")).toBe("spec");
    expect(mod.workMode(false, "spec-0001-t2-create-link")).toBe("spec");
    expect(mod.workMode(false, "s4mf3nn/dgp95")).toBe("hors-spec");
    expect(mod.workMode(false, "s4mf3nn/spec-0001-t2-x")).toBe("spec");
    expect(mod.workMode(false, "")).toBe("spec");
    expect(mod.workMode(false, "respec-0001-t2")).toBe("hors-spec");
    expect(mod.workMode(false, "spec-0001-fix-42-empty-slug")).toBe("spec");
  });

  it("recognizes a fix branch", () => {
    expect(mod.isFixBranch("spec-0001-fix-42-empty-slug")).toBe(true);
    expect(mod.isFixBranch("s4mf3nn/spec-0001-fix-42")).toBe(true);
    expect(mod.isFixBranch("spec-0001-fix")).toBe(true);
    expect(mod.isFixBranch("spec-0001-t2-fix-typo")).toBe(false);
    expect(mod.isFixBranch("spec-0001-fixture")).toBe(false);
    expect(mod.isFixBranch("fix-login")).toBe(false);
  });

  it("requires a regression test outside the contract and the holdout scenarios", () => {
    expect(mod.hasRegressionTest(["src/features/links/service.ts", "src/features/links/service.test.ts"])).toBe(true);
    expect(mod.hasRegressionTest(["tests/unit/lease.test.ts"])).toBe(true);
    expect(mod.hasRegressionTest(["src/features/links/service.ts"])).toBe(false);
    expect(mod.hasRegressionTest(["tests/acceptance/SPEC-0001.test.ts"])).toBe(false);
    expect(mod.hasRegressionTest(["tests/holdout/SPEC-0001.test.ts"])).toBe(false);
  });

  it("lit les globs d'une étiquette", () => {
    expect(mod.labelGlobs(labeler, "risk:medium")).toEqual(["src/features/**/service.ts", "web/**"]);
    expect(mod.labelGlobs(labeler, "contract")).toEqual(["tests/acceptance/**"]);
    expect(mod.labelGlobs(labeler, "absent")).toEqual([]);
  });

  it("lists the labels of the labeler in file order", () => {
    expect(mod.labelNames(labeler)).toEqual(["review:full", "risk:high", "risk:medium", "contract"]);
  });

  it("reports the globs that match no tracked file", () => {
    const files = ["src/features/redirect/route.ts", "scripts/lease.mjs", "tests/acceptance/SPEC-0001.test.ts"];
    expect(mod.deadZones(labeler, files)).toEqual([
      { label: "risk:high", glob: "web/index.html" },
      { label: "risk:medium", glob: "src/features/**/service.ts" },
      { label: "risk:medium", glob: "web/**" },
    ]);
    expect(mod.deadZones(labeler, [])).toHaveLength(7);
  });

  it("lists SQL files that no risk:high glob covers", () => {
    const files = ["src/features/redirect/seed.sql", "drizzle/0001_init.sql", "web/schema.sql", "README.md"];
    expect(mod.unprotectedSqlFiles(labeler, files)).toEqual(["drizzle/0001_init.sql", "web/schema.sql"]);
    expect(mod.unprotectedSqlFiles(labeler, ["README.md"])).toEqual([]);
  });

  it("classifies the default zones the same way whatever the package layout", () => {
    const real = fs.readFileSync(".github/labeler.yml", "utf8");
    const level = (file: string) => mod.reviewLevel([file], real);
    expect(level("src/features/auth/routes.ts")).toBe("full");
    expect(level("web/src/features/auth/login.tsx")).toBe("full");
    expect(level("apps/api/src/db/migrations/0001_init.sql")).toBe("full");
    expect(level("src/shared/auth-middleware.ts")).toBe("full");
    expect(level("apps/api/src/shared/http/auth-guard.ts")).toBe("full");
    expect(level("web/src/features/admin/reports.tsx")).toBe("full");
    expect(level("src/shared/errors.ts")).toBe("standard");
    expect(level("mobile/package.json")).toBe("standard");
    expect(level("src/features/links/routes.ts")).toBe("light");
  });

  it("déduit le niveau de revue du fichier le plus risqué", () => {
    expect(mod.reviewLevel(["README.md", "src/features/redirect/routes.ts"], labeler)).toBe("full");
    expect(mod.reviewLevel(["README.md", "web/src/App.tsx"], labeler)).toBe("standard");
    expect(mod.reviewLevel(["scripts/gen.mjs"], labeler)).toBe("standard");
    expect(mod.reviewLevel(["docs/a.md"], labeler)).toBe("light");
    expect(mod.reviewLevel([], labeler)).toBe("light");
  });

  it("picks the spec reviewer when the diff only holds specs, contract tests and hidden scenarios", () => {
    const spec = [
      "specs/SPEC-0003-export/spec.md",
      "tests/acceptance/SPEC-0003.test.ts",
      "tests/holdout/SPEC-0003.test.ts",
    ];
    expect(mod.reviewKind(spec)).toBe("spec");
    expect(mod.reviewKind(["specs/SPEC-0003-export/spec.md"])).toBe("spec");
    expect(mod.reviewKind([...spec, "src/features/export/routes.ts"])).toBe("code");
    expect(mod.reviewKind(["specs/SPEC-0003-export/plan.md"])).toBe("code");
    expect(mod.reviewKind(["specs/_template/extra/spec.md"])).toBe("code");
    expect(mod.reviewKind([])).toBe("code");
  });

  it("reviews product framing (product, domain, roadmap, numbered ADR) like a spec", () => {
    const cadrage = ["docs/PRODUCT.md", "docs/DOMAIN.md", "specs/ROADMAP.md", "docs/adr/0002-auth.md"];
    expect(mod.reviewKind(cadrage)).toBe("spec");
    expect(mod.reviewKind([...cadrage, "specs/SPEC-0003-export/spec.md"])).toBe("spec");
    expect(mod.reviewKind(["docs/adr/_template.md"])).toBe("code");
    expect(mod.reviewKind(["docs/factory/WORKFLOW.md"])).toBe("code");
    expect(mod.reviewKind(["docs/PRODUCT.md", "src/app.ts"])).toBe("code");
  });

  it("reviews screen mockups with their spec", () => {
    const files = ["specs/SPEC-0004-swipe/spec.md", "specs/SPEC-0004-swipe/maquettes/card.png"];
    expect(mod.reviewKind(files)).toBe("spec");
    expect(mod.reviewKind(["specs/SPEC-0004-swipe/plan.md", "specs/SPEC-0004-swipe/maquettes/card.png"])).toBe("code");
  });

  it("contrôle le périmètre par fichier ou dossier", () => {
    const paths = ["src/features/links/", "web/src/form"];
    expect(mod.inPerimeter("src/features/links/routes.ts", paths)).toBe(true);
    expect(mod.inPerimeter("web/src/form", paths)).toBe(true);
    expect(mod.inPerimeter("web/src/formulaire/x.ts", paths)).toBe(false);
    expect(mod.inPerimeter("src/app.ts", paths)).toBe(false);
  });

  it("détecte les dépendances ajoutées", () => {
    const before = JSON.stringify({ dependencies: { hono: "1" }, devDependencies: { vitest: "1" } });
    const after = JSON.stringify({
      dependencies: { hono: "2", zod: "3" },
      devDependencies: { vitest: "1", jsdom: "1" },
    });
    expect(mod.addedDependencies(before, after)).toEqual(["zod", "jsdom"]);
    expect(mod.addedDependencies(null, after)).toEqual(["hono", "zod", "vitest", "jsdom"]);
    expect(mod.addedDependencies(before, null)).toEqual([]);
  });

  it("extrait une section du résumé sans commentaires", () => {
    const s = "## A\nx\n## B\n<!-- note -->\ny\n";
    expect(mod.summarySection(s, "B")).toBe("y");
    expect(mod.summarySection(s, "C")).toBeNull();
  });

  it("vérifie la section Context7 et la déclaration des dépendances", () => {
    const ok =
      "## Documentation consultée (Context7)\nhono 4.13.12 (cache)\n## Nouvelles dépendances\nzod, 3, validation\n";
    expect(mod.checkSummary(ok, ["zod"])).toEqual([]);
    expect(mod.checkSummary(ok, ["jsdom"])).toEqual([expect.stringContaining("jsdom")]);
    const longer =
      "## Documentation consultée (Context7)\nAucune\n## Nouvelles dépendances\nzod-to-json-schema, 1, schéma\n";
    expect(mod.checkSummary(longer, ["zod"])).toEqual([expect.stringContaining("zod")]);
    const versioned =
      "## Documentation consultée (Context7)\nAucune\n## Nouvelles dépendances\n`zod@3.2` : validation, @scope/pkg (x)\n";
    expect(mod.checkSummary(versioned, ["zod", "@scope/pkg"])).toEqual([]);
    const template = "## Documentation consultée (Context7)\nBibliothèque et version, une par ligne. `Aucune` si...\n";
    expect(mod.checkSummary(template, [])).toEqual([expect.stringContaining("Context7")]);
    expect(mod.checkSummary("## Autre\n", [])).toEqual([expect.stringContaining("Context7")]);
    expect(mod.checkSummary(null, [])).toEqual([expect.stringContaining("absent")]);
  });
});
