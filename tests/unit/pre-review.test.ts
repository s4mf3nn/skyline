import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface PreReview {
  globToRegExp(glob: string): RegExp;
  labelGlobs(text: string, label: string): string[];
  reviewLevel(files: string[], labeler: string): string;
  inPerimeter(file: string, paths: string[]): boolean;
  addedDependencies(before: string | null, after: string | null): string[];
  summarySection(text: string, title: string): string | null;
  checkSummary(summary: string | null, added: string[]): string[];
}
const mod = (await import(pathToFileURL(path.resolve("scripts/pre-review.mjs")).href)) as PreReview;

const labeler = `# commentaire
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
    const g = (glob: string, file: string) => mod.globToRegExp(glob).test(file);
    expect(g("src/features/**/service.ts", "src/features/links/service.ts")).toBe(true);
    expect(g("src/features/**/service.ts", "src/features/service.ts")).toBe(true);
    expect(g("src/features/**/service.ts", "src/features/links/repo.ts")).toBe(false);
    expect(g("web/**", "web/src/App.tsx")).toBe(true);
    expect(g("web/index.html", "web/indexXhtml")).toBe(false);
    expect(g("*.md", "a/b.md")).toBe(false);
  });

  it("lit les globs d'une étiquette", () => {
    expect(mod.labelGlobs(labeler, "risk:medium")).toEqual(["src/features/**/service.ts", "web/**"]);
    expect(mod.labelGlobs(labeler, "contract")).toEqual(["tests/acceptance/**"]);
    expect(mod.labelGlobs(labeler, "absent")).toEqual([]);
  });

  it("déduit le niveau de revue du fichier le plus risqué", () => {
    expect(mod.reviewLevel(["README.md", "src/features/redirect/routes.ts"], labeler)).toBe("full");
    expect(mod.reviewLevel(["README.md", "web/src/App.tsx"], labeler)).toBe("standard");
    expect(mod.reviewLevel(["docs/a.md"], labeler)).toBe("light");
    expect(mod.reviewLevel([], labeler)).toBe("light");
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
