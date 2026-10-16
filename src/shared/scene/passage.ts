import type { Aircraft } from "../adsb";
import type { Position } from "../location";
import { cardinalPoint, normalizeDeg } from "./geo";
import { type Passage, WINDOW_HALF_LENGTH_KM } from "./model";

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = (EARTH_RADIUS_KM * Math.PI) / 180;
const MS_PER_HOUR = 3_600_000;

interface LocalPoint {
  eastKm: number;
  northKm: number;
}

/** Plan local autour de l'observateur : x vers l'est, y vers le nord, en km. */
function toLocalKm(observer: Position, point: Position): LocalPoint {
  const cosLat = Math.cos((observer.latitude * Math.PI) / 180);
  return {
    eastKm: (point.longitude - observer.longitude) * KM_PER_DEGREE * cosLat,
    northKm: (point.latitude - observer.latitude) * KM_PER_DEGREE,
  };
}

/** Un avion est exploitable si sa vitesse et son cap sont connus, et s'il n'est pas au sol (INV2). */
export function isUsable(aircraft: Aircraft): boolean {
  const { groundSpeedKmh, trackDeg, altitudeM } = aircraft;
  if (groundSpeedKmh === null || groundSpeedKmh <= 0 || trackDeg === null) {
    return false;
  }
  return altitudeM === null || altitudeM > 0;
}

/**
 * Extrapole un avion exploitable en ligne droite, à vitesse et cap constants,
 * depuis sa position à `takenAtMs`, et en déduit son passage.
 */
export function predictPassage(aircraft: Aircraft, observer: Position, takenAtMs: number, nowMs: number): Passage {
  const speedKmh = aircraft.groundSpeedKmh ?? 0;
  const trackDeg = normalizeDeg(aircraft.trackDeg ?? 0);
  const trackRad = (trackDeg * Math.PI) / 180;
  // Direction unitaire du déplacement et déplacement par milliseconde.
  const dirEast = Math.sin(trackRad);
  const dirNorth = Math.cos(trackRad);
  const kmPerMs = speedKmh / MS_PER_HOUR;

  const start = toLocalKm(observer, aircraft);
  const positionAt = (timeMs: number): LocalPoint => {
    const travelledKm = kmPerMs * (timeMs - takenAtMs);
    return { eastKm: start.eastKm + dirEast * travelledKm, northKm: start.northKm + dirNorth * travelledKm };
  };

  // Le point le plus proche est la projection de l'observateur sur la trajectoire.
  const closestTimeRawMs = takenAtMs - (start.eastKm * dirEast + start.northKm * dirNorth) / kmPerMs;
  const closestDistanceKm = Math.abs(start.eastKm * dirNorth - start.northKm * dirEast);
  const halfWindowMs = WINDOW_HALF_LENGTH_KM / kmPerMs;

  const passageTimeMs = Math.round(closestTimeRawMs - halfWindowMs);
  const arrival = positionAt(passageTimeMs);
  const arrivalBearingDeg = normalizeDeg((Math.atan2(arrival.eastKm, arrival.northKm) * 180) / Math.PI);
  const now = positionAt(nowMs);

  // Inverse de `toLocalKm`, pour rendre la position en degrés.
  const cosLat = Math.cos((observer.latitude * Math.PI) / 180);

  return {
    hex: aircraft.hex,
    callsign: aircraft.callsign,
    altitudeM: aircraft.altitudeM,
    groundSpeedKmh: speedKmh,
    trackDeg,
    trackCardinal: cardinalPoint(trackDeg),
    passageTimeMs,
    closestTimeMs: Math.round(closestTimeRawMs),
    windowEndMs: Math.round(closestTimeRawMs + halfWindowMs),
    closestDistanceKm,
    latitude: observer.latitude + now.northKm / KM_PER_DEGREE,
    longitude: observer.longitude + now.eastKm / (KM_PER_DEGREE * cosLat),
    groundDistanceKm: Math.hypot(now.eastKm, now.northKm),
    arrivalBearingDeg,
    arrivalCardinal: cardinalPoint(arrivalBearingDeg),
  };
}
