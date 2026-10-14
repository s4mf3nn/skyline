import type { Aircraft } from "../adsb";
import type { Position } from "../location";

export type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";

export interface AircraftSnapshot {
  aircraft: readonly Aircraft[];
  takenAtMs: number;
}

export interface Passage {
  hex: string;
  callsign: string | null;
  altitudeM: number | null;
  groundSpeedKmh: number;
  trackDeg: number;
  trackCardinal: CardinalPoint;
  /** Entrée dans la fenêtre : cible du compte à rebours. */
  passageTimeMs: number;
  closestTimeMs: number;
  windowEndMs: number;
  closestDistanceKm: number;
  /** Distance au sol à `nowMs`. */
  groundDistanceKm: number;
  /** Gisement d'arrivée, dans [0, 360). */
  arrivalBearingDeg: number;
  arrivalCardinal: CardinalPoint;
}

export interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}

export interface SceneInput {
  snapshot: AircraftSnapshot;
  observer: Position;
  nowMs: number;
  previousOverheadHex: string | null;
}

// Constantes du brief, non réglables en v0.
export const OVERHEAD_THRESHOLD_KM = 4;
export const FORECAST_RADIUS_KM = 80;
export const MAX_UPCOMING = 10;
export const WINDOW_HALF_LENGTH_KM = 5;
export const REFRESH_INTERVAL_MS = 10_000;
