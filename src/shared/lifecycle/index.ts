// Point d'entrée : l'interface et le faux seulement (aucun module natif). L'implémentation réelle vit dans `app-state.ts`.
export interface AppLifecycle {
  /** Le listener est appelé à chaque retour au premier plan. Renvoie la fonction de désabonnement. */
  onForeground(listener: () => void): () => void;
  /**
   * Le listener est appelé à chaque entrée en arrière-plan. Renvoie la fonction de désabonnement.
   * Facultatif : des tests de contrat figés (SPEC-0005, 0006, 0009, 0010) fournissent un cycle de vie sans lui.
   */
  onBackground?(listener: () => void): () => void;
}

export { createFakeLifecycle } from "./fake";
