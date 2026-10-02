import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface SplitPlan {
  parsePlan(text: string): { tasks: { id: string; title: string; group: string; from: number; to: number }[] };
  coveredCriteria(lines: string[]): { ids: string[]; mentionsEdgeCases: boolean };
  criterionBlock(lines: string[], id: string): string | null;
  renderTask(args: {
    spec: string;
    taskId: string;
    planText: string;
    specText: string;
    withPreamble?: boolean;
  }): string;
}
const mod = (await import(pathToFileURL(path.resolve("scripts/split-plan.mjs")).href)) as SplitPlan;

const plan = `# Plan SPEC-0009
Statut : PRÊT

Constat commun.

## Groupe 1 (parallèle)
### T1 : Premier
- Périmètre : a/
- Critères de la spec couverts : CA1, CA3, cas limites « vide »
- Définition de fini : tests

### T2 : Second
- Périmètre : b/
- Critères de la spec couverts : CU2
- Interface figée ci-dessus.

## Groupe 2
### T3 : Troisième
- Critères de la spec couverts : CA1
`;
const spec = `# SPEC-0009
## Critères d'acceptation
- **CA1** : premier
  suite du premier
- **CA2** : deuxième
- **CA3** : troisième
- **CU2** : interface
## Cas limites
- vide
## Hors périmètre
`;

describe("scripts/split-plan.mjs", () => {
  it("découpe les tâches avec leur groupe et leurs lignes", () => {
    const { tasks } = mod.parsePlan(plan);
    expect(tasks.map((t) => [t.id, t.title, t.group])).toEqual([
      ["T1", "Premier", "Groupe 1 (parallèle)"],
      ["T2", "Second", "Groupe 1 (parallèle)"],
      ["T3", "Troisième", "Groupe 2"],
    ]);
    expect(tasks[0]?.to).toBe(tasks[1]?.from);
  });

  it("lit les critères couverts et la mention des cas limites", () => {
    expect(mod.coveredCriteria(["- Critères de la spec couverts : CA1, CA3, cas limites « vide »"])).toEqual({
      ids: ["CA1", "CA3"],
      mentionsEdgeCases: true,
    });
    expect(mod.coveredCriteria(["rien"])).toEqual({ ids: [], mentionsEdgeCases: false });
  });

  it("développe les plages de critères", () => {
    expect(mod.coveredCriteria(["- Critères de la spec couverts : CA1 à CA4, CU2 à CU3"]).ids).toEqual([
      "CA1",
      "CA4",
      "CU2",
      "CU3",
      "CA2",
      "CA3",
    ]);
  });

  it("extrait un critère avec ses lignes de continuation, ou null", () => {
    const lines = spec.split("\n");
    expect(mod.criterionBlock(lines, "CA1")).toBe("- **CA1** : premier\n  suite du premier");
    expect(mod.criterionBlock(lines, "CA9")).toBeNull();
  });

  it("rend la tâche, ses critères et les cas limites sans le préambule", () => {
    const out = mod.renderTask({ spec: "SPEC-0009", taskId: "T1", planText: plan, specText: spec });
    expect(out).toContain("# SPEC-0009 T1");
    expect(out).toContain("- **CA1** : premier\n  suite du premier");
    expect(out).toContain("- **CA3** : troisième");
    expect(out).not.toContain("**CA2**");
    expect(out).toContain("## Cas limites (spec.md)\n- vide");
    expect(out).not.toContain("### T2");
    expect(out).toContain("Préambule du plan non inclus");
    expect(out).not.toContain("Constat commun.");
  });

  it("inclut le préambule sur demande ou quand la tâche renvoie à « ci-dessus »", () => {
    const asked = mod.renderTask({
      spec: "SPEC-0009",
      taskId: "T1",
      planText: plan,
      specText: spec,
      withPreamble: true,
    });
    expect(asked).toContain("Constat commun.");
    const auto = mod.renderTask({ spec: "SPEC-0009", taskId: "T2", planText: plan, specText: spec });
    expect(auto).toContain("Constat commun.");
    expect(auto).toContain("- **CU2** : interface");
  });

  it("signale un critère introuvable et une tâche absente", () => {
    const missing = mod.renderTask({ spec: "SPEC-0009", taskId: "T3", planText: plan, specText: "# vide" });
    expect(missing).toContain("**CA1** : introuvable dans spec.md");
    expect(() => mod.renderTask({ spec: "SPEC-0009", taskId: "T9", planText: plan, specText: spec })).toThrow(
      /T1, T2, T3/,
    );
  });
});
