import path from "node:path";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0003 (logique) : parcours de bout en bout par l'interface publique, avec d'autres données
// que le contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type PageIndex = 0 | 1;
interface FeatureLike {
  name: string;
  order: number;
  screen: () => null;
}
interface PagerModule {
  PAGER_METRICS: { swipeThresholdPt: number; edgeResistance: number; axisLockPt: number };
  lockAxis(dx: number, dy: number): "horizontal" | "vertical" | null;
  draggedOffset(page: PageIndex, dx: number): number;
  settlePage(page: PageIndex, dx: number): PageIndex;
  indicatorTraits(page: PageIndex): readonly [{ width: number; height: number; opacity: number }, unknown];
  selectPages(features: readonly FeatureLike[]): readonly FeatureLike[];
}
const pager = () => load<PagerModule>("src/shared/pager/index.ts");

const feature = (name: string, order: number): FeatureLike => ({ name, order, screen: () => null });

type Sample = { dx: number; dy: number };

/** Joue un geste : verrouille l'axe au premier échantillon qui le décide, puis relâche sur le dernier échantillon. */
function playGesture(
  samples: readonly Sample[],
  page: PageIndex,
  mod: Pick<PagerModule, "lockAxis" | "settlePage" | "draggedOffset">,
) {
  let axis: "horizontal" | "vertical" | null = null;
  const offsets: number[] = [];
  for (const { dx, dy } of samples) {
    if (axis === null) axis = mod.lockAxis(dx, dy);
    if (axis === "horizontal") offsets.push(mod.draggedOffset(page, dx));
  }
  const last = samples[samples.length - 1];
  const settled = axis === "horizontal" && last !== undefined ? mod.settlePage(page, last.dx) : page;
  return { axis, offsets, settled };
}

describe("SPEC-0003 hidden scenarios (logic)", () => {
  it("plays a session of gestures from Ciel to Passages and back, ending where the thresholds say", async () => {
    const mod = await pager();
    let page: PageIndex = 0;

    // Un défilement vertical de la page ne change jamais de page, même long.
    const scroll = playGesture(
      [
        { dx: 1, dy: 5 },
        { dx: 3, dy: 40 },
        { dx: 70, dy: 120 },
      ],
      page,
      mod,
    );
    expect(scroll.axis).toBe("vertical");
    expect(scroll.offsets).toEqual([]);
    expect(scroll.settled).toBe(0);

    // Un glissement trop court revient sur Ciel.
    const short = playGesture(
      [
        { dx: -9, dy: 2 },
        { dx: -30, dy: 4 },
        { dx: -59, dy: 3 },
      ],
      page,
      mod,
    );
    expect(short.axis).toBe("horizontal");
    expect(short.offsets).toEqual([-9, -30, -59]);
    expect(short.settled).toBe(0);

    // Un glissement d'au moins 60 pt passe sur Passages.
    const swipe = playGesture(
      [
        { dx: -10, dy: 1 },
        { dx: -80, dy: -6 },
        { dx: -140, dy: 8 },
      ],
      page,
      mod,
    );
    expect(swipe.settled).toBe(1);
    page = swipe.settled;

    // Sur Passages, tirer vers l'extérieur résiste ×0,3 puis revient.
    const outward = playGesture(
      [
        { dx: -20, dy: 0 },
        { dx: -100, dy: 3 },
      ],
      page,
      mod,
    );
    expect(outward.offsets[0]).toBeCloseTo(-6, 10);
    expect(outward.offsets[1]).toBeCloseTo(-30, 10);
    expect(outward.settled).toBe(1);

    // Un glissement vers la droite d'au moins 60 pt revient sur Ciel.
    const back = playGesture(
      [
        { dx: 12, dy: -3 },
        { dx: 61, dy: -1 },
      ],
      page,
      mod,
    );
    expect(back.settled).toBe(0);
  });

  it("agrees with its own metrics at the exact boundaries, whatever the page", async () => {
    const mod = await pager();
    const { swipeThresholdPt, edgeResistance, axisLockPt } = mod.PAGER_METRICS;

    expect(mod.lockAxis(axisLockPt, 0)).toBe("horizontal");
    expect(mod.lockAxis(axisLockPt - 0.01, 0)).toBeNull();
    expect(mod.settlePage(0, -swipeThresholdPt)).toBe(1);
    expect(mod.settlePage(0, -swipeThresholdPt + 0.01)).toBe(0);
    expect(mod.settlePage(1, swipeThresholdPt)).toBe(0);
    expect(mod.settlePage(1, swipeThresholdPt - 0.01)).toBe(1);
    expect(mod.draggedOffset(0, 50)).toBeCloseTo(50 * edgeResistance, 10);
    expect(mod.draggedOffset(1, -50)).toBeCloseTo(-50 * edgeResistance, 10);
    expect(mod.draggedOffset(0, -50)).toBe(-50);
    expect(mod.draggedOffset(1, 50)).toBe(50);
  });

  it("picks the pages of a registry the way the generated file shapes it, then lights the matching trait", async () => {
    const mod = await pager();
    const registry = [feature("map", 30), feature("passages", 20), feature("hangar", 20), feature("sky", 10)];
    const pages = mod.selectPages(registry);

    expect(pages.map((page) => page.name)).toEqual(["sky", "passages"]);
    expect(registry.map((entry) => entry.name)).toEqual(["map", "passages", "hangar", "sky"]);

    for (const page of [0, 1] as const) {
      const traits = mod.indicatorTraits(page);
      const [first, second] = traits as readonly [{ width: number }, { width: number }];
      expect(page === 0 ? first.width : second.width).toBe(18);
      expect(page === 0 ? second.width : first.width).toBe(6);
    }
  });
});
