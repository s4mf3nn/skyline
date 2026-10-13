import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0003 (Vitest) : logique pure du pager à deux pages. Le rendu (bande, indicateur, accessibilité) est
// joué par `SPEC-0003.native.test.tsx` ; le geste lui-même n'est pas rejoué sous Jest (spec, « Parcours sur cible réelle »).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Module posé par cette spec : chargé par chemin, avec les types du contrat d'interface recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type PageIndex = 0 | 1;
interface IndicatorTrait {
  width: number;
  height: number;
  opacity: number;
}
interface FeatureLike {
  name: string;
  order: number;
  screen: () => null;
}
interface PagerModule {
  PAGER_METRICS: {
    swipeThresholdPt: number;
    edgeResistance: number;
    axisLockPt: number;
    transitionMs: number;
    easing: readonly [number, number, number, number];
    indicatorTransitionMs: number;
  };
  lockAxis(dx: number, dy: number): "horizontal" | "vertical" | null;
  draggedOffset(page: PageIndex, dx: number): number;
  settlePage(page: PageIndex, dx: number): PageIndex;
  indicatorTraits(page: PageIndex): readonly [IndicatorTrait, IndicatorTrait];
  selectPages(features: readonly FeatureLike[]): readonly FeatureLike[];
}
const pager = () => load<PagerModule>("src/shared/pager/index.ts");

function feature(name: string, order: number): FeatureLike {
  return { name, order, screen: () => null };
}

describe.skip("SPEC-0003 pager (logic)", () => {
  it("CA1 : fixes the handoff values", async () => {
    const { PAGER_METRICS } = await pager();
    expect(PAGER_METRICS.swipeThresholdPt).toBe(60);
    expect(PAGER_METRICS.edgeResistance).toBe(0.3);
    expect(PAGER_METRICS.axisLockPt).toBe(8);
    expect(PAGER_METRICS.transitionMs).toBe(380);
    expect(PAGER_METRICS.easing).toEqual([0.2, 0.8, 0.2, 1]);
    expect(PAGER_METRICS.indicatorTransitionMs).toBe(300);
  });

  it("CA2 : locks no axis while the movement stays under 8 pt on both axes", async () => {
    const { lockAxis } = await pager();
    expect(lockAxis(0, 0)).toBeNull();
    expect(lockAxis(7.9, 0)).toBeNull();
    expect(lockAxis(-7.9, 7.9)).toBeNull();
    expect(lockAxis(0, -7.99)).toBeNull();
  });

  it("CA2 : locks the horizontal axis from 8 pt when the horizontal movement dominates", async () => {
    const { lockAxis } = await pager();
    expect(lockAxis(8, 0)).toBe("horizontal");
    expect(lockAxis(-8, 3)).toBe("horizontal");
    expect(lockAxis(12, -11.9)).toBe("horizontal");
  });

  it("CA2 : locks the vertical axis when the vertical movement dominates or ties, so the page can scroll", async () => {
    const { lockAxis } = await pager();
    expect(lockAxis(0, 8)).toBe("vertical");
    expect(lockAxis(2, -20)).toBe("vertical");
    expect(lockAxis(10, 10)).toBe("vertical");
    expect(lockAxis(-9, 9)).toBe("vertical");
  });

  it("CA3 : follows the finger one to one toward a page that exists", async () => {
    const { draggedOffset } = await pager();
    expect(draggedOffset(0, -120)).toBe(-120);
    expect(draggedOffset(0, 0)).toBe(0);
    expect(draggedOffset(1, 75)).toBe(75);
    expect(draggedOffset(1, 0)).toBe(0);
  });

  it("CA3 : applies the 0.3 resistance beyond the edges", async () => {
    const { draggedOffset } = await pager();
    expect(draggedOffset(0, 100)).toBeCloseTo(30, 10);
    expect(draggedOffset(0, 10)).toBeCloseTo(3, 10);
    expect(draggedOffset(1, -200)).toBeCloseTo(-60, 10);
    expect(draggedOffset(1, -1)).toBeCloseTo(-0.3, 10);
  });

  it("CA4 : moves to the other page from 60 pt, exactly 60 included", async () => {
    const { settlePage } = await pager();
    expect(settlePage(0, -60)).toBe(1);
    expect(settlePage(0, -250)).toBe(1);
    expect(settlePage(1, 60)).toBe(0);
    expect(settlePage(1, 180)).toBe(0);
  });

  it("CA4 : stays on the page under 60 pt", async () => {
    const { settlePage } = await pager();
    expect(settlePage(0, -59.9)).toBe(0);
    expect(settlePage(0, 0)).toBe(0);
    expect(settlePage(1, 59.9)).toBe(1);
    expect(settlePage(1, 0)).toBe(1);
  });

  it("CA4 : comes back to the page of origin after a drag toward the outside, whatever the distance", async () => {
    const { settlePage } = await pager();
    expect(settlePage(0, 400)).toBe(0);
    expect(settlePage(0, 60)).toBe(0);
    expect(settlePage(1, -400)).toBe(1);
    expect(settlePage(1, -60)).toBe(1);
  });

  it("CA4 : decides on the distance alone, taking the raw drag and not the resisted one", async () => {
    const { settlePage, draggedOffset } = await pager();
    // 150 pt toward the inside gives 150 pt, 150 pt toward the outside gives 45 pt: only the first changes page.
    expect(settlePage(0, -150)).toBe(1);
    expect(draggedOffset(0, 150)).toBeCloseTo(45, 10);
    expect(settlePage(0, 150)).toBe(0);
  });

  it("CA5 : draws a 18 x 4 full-opacity trait for the active page and a 6 x 4 trait at 40 % for the other", async () => {
    const { indicatorTraits } = await pager();
    expect(indicatorTraits(0)).toEqual([
      { width: 18, height: 4, opacity: 1 },
      { width: 6, height: 4, opacity: 0.4 },
    ]);
    expect(indicatorTraits(1)).toEqual([
      { width: 6, height: 4, opacity: 0.4 },
      { width: 18, height: 4, opacity: 1 },
    ]);
  });

  it("CA6 : keeps the two features of smallest order, sorted by increasing order", async () => {
    const { selectPages } = await pager();
    const sky = feature("sky", 1);
    const passages = feature("passages", 2);
    const later = feature("later", 7);
    expect(selectPages([later, passages, sky])).toEqual([sky, passages]);
    expect(selectPages([sky, passages, later])).toEqual([sky, passages]);
  });

  it("CA6 : keeps the list order between features of the same order", async () => {
    const { selectPages } = await pager();
    const first = feature("first", 3);
    const second = feature("second", 3);
    const third = feature("third", 3);
    const lower = feature("lower", 1);
    expect(selectPages([first, second, third])).toEqual([first, second]);
    expect(selectPages([third, lower, second, first])).toEqual([lower, third]);
  });

  it("CA6 : returns every feature when there are fewer than two, and does not modify the list it receives", async () => {
    const { selectPages } = await pager();
    const only = feature("only", 5);
    expect(selectPages([])).toEqual([]);
    expect(selectPages([only])).toEqual([only]);

    const a = feature("a", 9);
    const b = feature("b", 2);
    const list = [a, b];
    selectPages(list);
    expect(list).toEqual([a, b]);
    expect(list[0]).toBe(a);
  });
});
