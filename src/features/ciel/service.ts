import { type Airline, type AirlineTheme, airlineTheme, resolveAirline } from "../../shared/airlines";
import { flightLabel, formatMetric } from "../../shared/format";
import type { Passage, Scene, SceneState } from "../../shared/scene";

// Mêmes valeurs que `PageName` (src/shared/feature.ts) : 0 = Ciel, 1 = Prochains passages.
export type SkyPage = "ciel" | "passages";
export type SkyPresence = "absent" | "survol" | "retenu";
export type SkyRowKey = "speed" | "altitude" | "heading" | "airline" | "flight" | "aircraft";

export interface SkyState {
  presence: SkyPresence;
  passage: Passage | null;
}

export interface SkyRow {
  key: SkyRowKey;
  label: string;
  value: string;
}

export interface SkyView {
  hex: string;
  airline: Airline;
  theme: AirlineTheme;
  rows: readonly SkyRow[];
}

/** Valeurs du handoff de design (écran Ciel), en points. */
export const CIEL_METRICS = {
  infoColumnRightPt: 24,
  infoColumnTopPt: 448,
  infoColumnGapPt: 10,
  labelSizePt: 13,
  labelOpacity: 0.7,
  valueSizePt: 40,
  tailWidthPt: 272,
  tailHeightPt: 399,
  tailLeftPt: -60,
} as const;

export const SKY_ABSENT: SkyState = { presence: "absent", passage: null };

// Type d'appareil non fourni avant SPEC-0009.
const NO_VALUE = "—";

/** Vue de l'avion montré : six lignes dans l'ordre du handoff, sans unité. */
export function buildSkyView(passage: Passage): SkyView {
  const airline = resolveAirline(passage.callsign);
  return {
    hex: passage.hex,
    airline,
    theme: airlineTheme(airline),
    rows: [
      { key: "speed", label: "Vitesse", value: formatMetric(passage.groundSpeedKmh) },
      { key: "altitude", label: "Altitude", value: formatMetric(passage.altitudeM) },
      { key: "heading", label: "Cap", value: passage.trackCardinal },
      { key: "airline", label: "Compagnie", value: airline.name },
      { key: "flight", label: "Vol", value: flightLabel(passage.callsign, airline) },
      { key: "aircraft", label: "Appareil", value: NO_VALUE },
    ],
  };
}

/**
 * Présence de Ciel (INV9). La première règle qui s'applique l'emporte.
 * Fonction pure : ne modifie pas ses entrées et ne lit aucune horloge.
 */
export function nextSkyState(input: {
  previous: SkyState;
  scene: Scene | null;
  denied: boolean;
  displayedPage: SkyPage;
}): SkyState {
  const { previous, scene, denied, displayedPage } = input;
  // 1. Position refusée : tout est effacé.
  if (denied) return SKY_ABSENT;
  // 2. Survol en cours : il prime sur l'état précédent et sur la page affichée.
  if (scene?.overhead != null) return { presence: "survol", passage: scene.overhead };
  // 3. Aucun avion n'est retenu s'il n'a pas été montré.
  if (previous.passage === null) return SKY_ABSENT;
  // 4. Sur Prochains passages, Ciel n'est plus montré.
  if (displayedPage === "passages") return SKY_ABSENT;
  // 5. L'avion redevient un passage à venir.
  const hex = previous.passage.hex;
  if (scene?.upcoming.some((upcoming) => upcoming.hex === hex)) return SKY_ABSENT;
  // 6. Sinon l'avion est retenu, même objet.
  return { presence: "retenu", passage: previous.passage };
}

/** Entrées de `nextSkyState` tirées de l'état de la scène : `null` tant qu'il n'y a pas de scène. */
export function skyInputOf(state: SceneState): { scene: Scene | null; denied: boolean } {
  if (state.status === "ready") return { scene: state.scene, denied: false };
  return { scene: null, denied: state.status === "denied" };
}
