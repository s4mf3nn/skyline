import { createContext, useContext, useEffect } from "react";

/** Couleur d'accent `#RRGGBB` de chaque page ; `null` tant que l'écran n'en a pas déclaré. */
export type PageAccents = readonly [string | null, string | null];

/** Emplacement où l'écran d'une page déclare son accent ; fourni par le pager. */
export interface PageAccentSlot {
  setAccent(color: string | null): void;
}

/** `null` hors pager : `usePagerAccent` est alors sans effet. */
export const PageAccentContext = createContext<PageAccentSlot | null>(null);

/** Appelé par l'écran d'une page pour déclarer son accent au pager. */
export function usePagerAccent(color: string | null): void {
  const slot = useContext(PageAccentContext);
  useEffect(() => {
    slot?.setAccent(color);
  }, [slot, color]);
}

/** Accent de la page active, `fallback` si elle n'en a pas déclaré. */
export function activeAccent(accents: PageAccents, page: 0 | 1, fallback: string): string {
  return accents[page] ?? fallback;
}

/** Nouveau tuple où seul l'accent de `page` change. */
export function withAccent(accents: PageAccents, page: 0 | 1, color: string | null): PageAccents {
  return page === 0 ? [color, accents[1]] : [accents[0], color];
}
