import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface VerifyQuiet {
  filterOutput(output: string, maxLines?: number): string;
}
const mod = (await import(pathToFileURL(path.resolve("scripts/verify-quiet.mjs")).href)) as VerifyQuiet;

describe("scripts/verify-quiet.mjs", () => {
  it("retire le tableau de couverture, les tests réussis et le bruit, garde les erreurs", () => {
    const out = mod.filterOutput(
      [
        "> my-project@ verify",
        " ✓ src/a.test.ts (3 tests)",
        " FAIL src/b.test.ts > b > fait x",
        "AssertionError: expected 1 to be 2",
        "File      | % Stmts | % Branch",
        "All files |   91.2  |   85.0",
        "src/a.ts  |   100   |   100",
        "src/c.ts:4:7 - error TS2322: Type 'string' is not assignable to type 'number'.",
        "",
      ].join("\n"),
    );
    expect(out).toBe(
      [
        " FAIL src/b.test.ts > b > fait x",
        "AssertionError: expected 1 to be 2",
        "src/c.ts:4:7 - error TS2322: Type 'string' is not assignable to type 'number'.",
      ].join("\n"),
    );
  });

  it("retire les codes couleur", () => {
    expect(mod.filterOutput("\u001b[31mFAIL\u001b[39m x")).toBe("FAIL x");
  });

  it("tronque au milieu en gardant le début et la fin", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `erreur ${i}`).join("\n");
    const out = mod.filterOutput(lines, 9).split("\n");
    expect(out).toHaveLength(10);
    expect(out[0]).toBe("erreur 0");
    expect(out[3]).toContain("41 lignes omises");
    expect(out.at(-1)).toBe("erreur 49");
  });
});
