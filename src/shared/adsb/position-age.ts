import type { Aircraft } from "./index";

const EARTH_RADIUS_KM = 6371;
const DEG_PER_RAD = 180 / Math.PI;

/** Ramène la longitude dans [-180, 180] par enroulement ; une valeur déjà dans la plage ne bouge pas. */
function wrapLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) return longitude;
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * Avance la position en ligne droite de `seenPosS` secondes, au cap et à la vitesse sol connus
 * (approximation locale). Rend `null` si l'avion ne peut pas être placé : déplacement non nul
 * depuis un pôle, ou latitude recalée hors de [-90, 90].
 */
export function advanceBySeenPos(aircraft: Aircraft, seenPosS: number): Aircraft | null {
  const { latitude, longitude, trackDeg, groundSpeedKmh } = aircraft;
  if (trackDeg === null || groundSpeedKmh === null) return aircraft;
  if (!(seenPosS > 0) || groundSpeedKmh <= 0) return aircraft;
  if (Math.abs(latitude) === 90) return null;

  const distanceKm = (groundSpeedKmh * seenPosS) / 3600;
  const trackRad = trackDeg / DEG_PER_RAD;
  const newLatitude = latitude + ((distanceKm * Math.cos(trackRad)) / EARTH_RADIUS_KM) * DEG_PER_RAD;
  if (newLatitude < -90 || newLatitude > 90) return null;

  const cosLatitude = Math.cos(latitude / DEG_PER_RAD);
  const deltaLongitude = ((distanceKm * Math.sin(trackRad)) / (EARTH_RADIUS_KM * cosLatitude)) * DEG_PER_RAD;
  return { ...aircraft, latitude: newLatitude, longitude: wrapLongitude(longitude + deltaLongitude) };
}
