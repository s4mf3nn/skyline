// Point d'entrée : l'interface et le faux seulement (aucun module natif). L'implémentation réelle vit dans `app-state.ts`.
export interface AppLifecycle {
  /** Le listener est appelé à chaque retour au premier plan. Renvoie la fonction de désabonnement. */
  onForeground(listener: () => void): () => void;
}

export { createFakeLifecycle } from "./fake";
