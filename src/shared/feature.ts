import type { ComponentType } from "react";

/** Nom d'une page du pager : `"ciel"` est la page 0, `"passages"` la page 1. */
export type PageName = "ciel" | "passages";

/** Une feature du registre `src/features.gen.ts` : son écran est monté par l'application. */
export interface Feature {
  name: string;
  /** Les features sont triées par `order` croissant : la plus petite est montée en premier. */
  order: number;
  screen: ComponentType;
  /**
   * Dit si la page de la feature existe, selon la page affichée. Appelée comme un crochet depuis
   * un composant du pager. Sans `presence`, la page est toujours présente.
   */
  presence?: (displayedPage: PageName) => boolean;
}
