import type { Position } from "../location";
import type { CardinalPoint } from "./model";

const EARTH_RADIUS_KM = 6371;
const SECTOR_DEG = 45;
const CARDINALS: readonly CardinalPoint[] = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Ramène un angle dans [0, 360), jamais -0 ni 360. */
export function normalizeDeg(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  // Un très petit négatif donne 360 après l'addition : on le ramène à 0.
  if (wrapped >= 360 || wrapped === 0) {
    return 0;
  }
  return wrapped;
}

/** Distance au sol entre deux positions (haversine). */
export function groundDistanceKm(a: Position, b: Position): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Gisement de `to` vu de `from`, 0 au nord, sens horaire. */
export function bearingDeg(from: Position, to: Position): number {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}

/** Point cardinal du secteur de 45° centré sur lui (borne basse incluse). */
export function cardinalPoint(deg: number): CardinalPoint {
  const sector = Math.floor((normalizeDeg(deg) + SECTOR_DEG / 2) / SECTOR_DEG) % CARDINALS.length;
  return CARDINALS[sector] as CardinalPoint;
}

/** Angle de la flèche vers la cible ; `null` si le cap du téléphone est inconnu. */
export function arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null {
  if (headingDeg === null) {
    return null;
  }
  return normalizeDeg(targetDeg - headingDeg);
}
