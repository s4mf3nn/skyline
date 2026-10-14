import type { Feature } from "../feature";

export type { PageAccentSlot, PageAccents } from "./accent";
export { activeAccent, PageAccentContext, usePagerAccent, withAccent } from "./accent";

/** 0 = Ciel, 1 = Prochains passages. */
export type PageIndex = 0 | 1;

export interface PagerMetrics {
  swipeThresholdPt: number;
  edgeResistance: number;
  axisLockPt: number;
  transitionMs: number;
  easing: readonly [number, number, number, number];
  indicatorTransitionMs: number;
}

export interface IndicatorTrait {
  width: number;
  height: number;
  opacity: number;
}

/** Valeurs du handoff de design. */
export const PAGER_METRICS: PagerMetrics = {
  swipeThresholdPt: 60,
  edgeResistance: 0.3,
  axisLockPt: 8,
  transitionMs: 380,
  easing: [0.2, 0.8, 0.2, 1],
  indicatorTransitionMs: 300,
};

export const PAGER_LAYOUT = {
  indicatorTopPt: 50,
  indicatorGapPt: 5,
  defaultAccent: "#F4F1EA",
} as const;

// Les quatre fonctions suivantes sont appelées depuis les callbacks du geste, sur le fil d'interface :
// Reanimated ne les transforme pas seul quand elles viennent d'un autre fichier, d'où la directive.

/** Axe du geste, `null` tant que le mouvement est sous le seuil ; l'égalité reste verticale. */
export function lockAxis(dx: number, dy: number): "horizontal" | "vertical" | null {
  "worklet";
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < PAGER_METRICS.axisLockPt) return null;
  return absX > absY ? "horizontal" : "vertical";
}

/** Déplacement de la bande pendant un glissement de `dx` pt, freiné au-delà des bords. */
export function draggedOffset(page: PageIndex, dx: number): number {
  "worklet";
  const towardsOutside = (page === 0 && dx > 0) || (page === 1 && dx < 0);
  return towardsOutside ? dx * PAGER_METRICS.edgeResistance : dx;
}

/** Page de repos au relâchement : seule la distance compte, jamais la vitesse. */
export function settlePage(page: PageIndex, dx: number): PageIndex {
  "worklet";
  if (page === 0 && dx <= -PAGER_METRICS.swipeThresholdPt) return 1;
  if (page === 1 && dx >= PAGER_METRICS.swipeThresholdPt) return 0;
  return page;
}

/** Décalage de la bande quand `page` est au repos. */
export function restOffset(page: PageIndex, width: number): number {
  "worklet";
  return -page * width;
}

const ACTIVE_TRAIT: IndicatorTrait = { width: 18, height: 4, opacity: 1 };
const INACTIVE_TRAIT: IndicatorTrait = { width: 6, height: 4, opacity: 0.4 };

export function indicatorTraits(page: PageIndex): readonly [IndicatorTrait, IndicatorTrait] {
  return page === 0 ? [ACTIVE_TRAIT, INACTIVE_TRAIT] : [INACTIVE_TRAIT, ACTIVE_TRAIT];
}

export function pageValueText(page: PageIndex): string {
  return `Page ${page + 1} sur 2`;
}

/** Action d'accessibilité de l'indicateur : bornée aux deux pages, quelle que soit la page de départ. */
export function stepPage(page: PageIndex, action: "increment" | "decrement"): PageIndex {
  if (action === "increment") return 1;
  return 0;
}

/** Les deux features de plus petit `order`, à `order` égal dans l'ordre reçu. Ne modifie pas la liste. */
export function selectPages(features: readonly Feature[]): readonly Feature[] {
  return [...features].sort((a, b) => a.order - b.order).slice(0, 2);
}

export type PagerRoot =
  | { kind: "home" }
  | { kind: "single"; feature: Feature }
  | { kind: "pager"; pages: readonly [Feature, Feature] };

export function pagerRoot(features: readonly Feature[]): PagerRoot {
  const [first, second] = selectPages(features);
  if (first === undefined) return { kind: "home" };
  if (second === undefined) return { kind: "single", feature: first };
  return { kind: "pager", pages: [first, second] };
}
