import type { ComponentType } from "react";

/** Une feature du registre `src/features.gen.ts` : son écran est monté par l'application. */
export interface Feature {
  name: string;
  /** Les features sont triées par `order` croissant : la plus petite est montée en premier. */
  order: number;
  screen: ComponentType;
}

/** Écran de la feature d'`order` le plus petit, `fallback` si la liste est vide. Ne modifie pas `features`. */
export function pickScreen(features: readonly Feature[], fallback: ComponentType): ComponentType {
  let first: Feature | undefined;
  for (const feature of features) {
    if (first === undefined || feature.order < first.order) first = feature;
  }
  return first === undefined ? fallback : first.screen;
}
