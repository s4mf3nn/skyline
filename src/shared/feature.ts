import type { ComponentType } from "react";

/** Une feature du registre `src/features.gen.ts` : son écran est monté par l'application. */
export interface Feature {
  name: string;
  /** Les features sont triées par `order` croissant : la plus petite est montée en premier. */
  order: number;
  screen: ComponentType;
}
