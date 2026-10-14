import type { Aircraft } from "../adsb";
import {
  FORECAST_RADIUS_KM,
  MAX_UPCOMING,
  OVERHEAD_THRESHOLD_KM,
  type Passage,
  type Scene,
  type SceneInput,
} from "./model";
import { isUsable, predictPassage } from "./passage";

/** Un seul avion par `hex` : la première occurrence, avant tout autre contrôle (CA6). */
function firstOccurrences(aircraft: readonly Aircraft[]): Aircraft[] {
  const seen = new Set<string>();
  return aircraft.filter((item) => {
    if (seen.has(item.hex)) {
      return false;
    }
    seen.add(item.hex);
    return true;
  });
}

// Tolérance (1 mm) : le passage par des degrés et des flottants ne retombe pas exactement sur 4 ou 80 km.
const EPSILON_KM = 1e-6;
const isWithinThresholds = (passage: Passage): boolean =>
  passage.closestDistanceKm <= OVERHEAD_THRESHOLD_KM + EPSILON_KM &&
  passage.groundDistanceKm <= FORECAST_RADIUS_KM + EPSILON_KM;

const isInWindow = (passage: Passage, nowMs: number): boolean =>
  passage.passageTimeMs <= nowMs && nowMs < passage.windowEndMs;

const compareByHex = (a: Passage, b: Passage): number => (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0);

/** Maintien : l'ancien survol reste tant que sa fenêtre contient `nowMs`, sans seuils (CA8). */
function heldOverhead(passages: Passage[], previousHex: string | null, nowMs: number): Passage | null {
  if (previousHex === null) {
    return null;
  }
  const previous = passages.find((passage) => passage.hex === previousHex);
  return previous !== undefined && isInWindow(previous, nowMs) ? previous : null;
}

/** Entrée : fenêtre en cours, point le plus proche à 4 km ou moins, puis le plus proche au sol (CA7). */
function enteringOverhead(passages: Passage[], nowMs: number): Passage | null {
  const candidates = passages
    .filter((passage) => isInWindow(passage, nowMs))
    .filter(isWithinThresholds)
    .sort((a, b) => a.groundDistanceKm - b.groundDistanceKm || compareByHex(a, b));
  return candidates[0] ?? null;
}

/** Calcule le survol en cours et les prochains passages à `nowMs` (fonction pure). */
export function computeScene(input: SceneInput): Scene {
  const { snapshot, observer, nowMs, previousOverheadHex } = input;
  const passages = firstOccurrences(snapshot.aircraft)
    .filter(isUsable)
    .map((aircraft) => predictPassage(aircraft, observer, snapshot.takenAtMs, nowMs))
    .filter((passage) => passage.windowEndMs > nowMs);

  const overhead = heldOverhead(passages, previousOverheadHex, nowMs) ?? enteringOverhead(passages, nowMs);

  const upcoming = passages
    .filter((passage) => passage.passageTimeMs > nowMs)
    .filter(isWithinThresholds)
    .filter((passage) => passage.hex !== overhead?.hex)
    .sort((a, b) => a.passageTimeMs - b.passageTimeMs || compareByHex(a, b))
    .slice(0, MAX_UPCOMING);

  return { overhead, upcoming };
}
