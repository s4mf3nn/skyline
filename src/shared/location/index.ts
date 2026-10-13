// Point d'entrée : l'interface et le faux seulement (aucun module natif). L'implémentation réelle vit dans `expo.ts`.
export type LocationPermission = "granted" | "denied";

export interface Position {
  latitude: number;
  longitude: number;
}

export interface LocationService {
  requestPermission(): Promise<LocationPermission>;
  /** Rejette avec `LOCATION_DENIED` si la permission est refusée. */
  getPosition(): Promise<Position>;
  /** Renvoie la fonction de désabonnement : plus aucune valeur n'est transmise après son appel. */
  watchHeading(onHeading: (degrees: number) => void): () => void;
}

export { createFakeLocation } from "./fake";
