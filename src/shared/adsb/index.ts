// Point d'entrée : l'interface et le faux seulement. La source provisoire vit dans `empty.ts`.
export interface Aircraft {
  /** Identifiant OACI 24 bits de l'appareil, en hexadécimal minuscule. */
  hex: string;
  /** Indicatif, sans espace de fin. */
  callsign: string | null;
  latitude: number;
  longitude: number;
  /** Mètres. */
  altitudeM: number | null;
  /** Vitesse sol, km/h. */
  groundSpeedKmh: number | null;
  /** Cap suivi, degrés de 0 à 360, 0 au nord. */
  trackDeg: number | null;
}

export interface AdsbQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface AdsbSource {
  /** Rejette avec `ADSB_UNAVAILABLE` si la source est indisponible. */
  fetchAircraft(query: AdsbQuery): Promise<Aircraft[]>;
}

export { createFakeAdsbSource } from "./fake";
