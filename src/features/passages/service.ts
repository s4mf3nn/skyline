import { type Airline, type AirlineTheme, airlineTheme, resolveAirline } from "../../shared/airlines";
import { formatClockTime } from "../../shared/clock";
import { flightLabel, formatMetric } from "../../shared/format";
import { arrowAngleDeg, type CardinalPoint, type Passage, type Scene, type SceneView } from "../../shared/scene";
import { type StaleNotice, type StateNotice, staleNotice, stateNotice } from "../../shared/states";

// Les formats vivent dans `shared/format` (Ciel les partage) ; ce module les ré-exporte.
export { flightLabel, formatMetric };

/** Valeurs du handoff de design, en points. */
export const PASSAGES_METRICS = {
  cardHeightPt: 650,
  gapPt: 12,
  snapIntervalPt: 662,
  marginHorizontalPt: 12,
  cardRadiusPt: 36,
  paddingTopPt: 100,
  paddingBottomPt: 200,
} as const;

/** Position de la ligne de données périmées, sous la barre d'état (hors `PASSAGES_METRICS` : ses valeurs sont figées par contrat). */
export const STALE_NOTICE_TOP_PT = 56;

export interface PassageCard {
  kind: "overhead" | "upcoming";
  hex: string;
  callsign: string | null;
  airline: Airline;
  theme: AirlineTheme;
  airlineName: string;
  flightLabel: string;
  aircraftType: string;
  altitude: string;
  speed: string;
  cardinal: CardinalPoint;
  arrowAngleDeg: number | null;
  countdown: string | null;
  passTime: string | null;
  visibility: { progress: number; remaining: string } | null;
}

interface CardsInput {
  scene: Scene;
  nowMs: number;
  headingDeg: number | null;
  timeZone: string;
}

type WindowOfPassage = Pick<Passage, "passageTimeMs" | "windowEndMs">;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const NO_VALUE = "—";

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** `MM:SS`, arrondi à la seconde supérieure ; `00:00` pour un reste nul ou négatif. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  return `${twoDigits(minutes)}:${twoDigits(totalSeconds % SECONDS_PER_MINUTE)}`;
}

/** `HH:MM` sur 24 h dans le fuseau reçu. */
export function formatLocalTime(timestampMs: number, timeZone: string): string {
  return formatClockTime(timestampMs, timeZone);
}

/** Avancement dans la fenêtre de visibilité, borné à [0, 1]. */
export function visibilityProgress(passage: WindowOfPassage, nowMs: number): number {
  const durationMs = passage.windowEndMs - passage.passageTimeMs;
  if (durationMs <= 0) {
    return nowMs >= passage.passageTimeMs ? 1 : 0;
  }
  const progress = (nowMs - passage.passageTimeMs) / durationMs;
  return Math.min(1, Math.max(0, progress));
}

/** Temps restant dans la fenêtre de visibilité, jamais négatif. */
export function visibilityRemainingMs(passage: WindowOfPassage, nowMs: number): number {
  return Math.max(0, passage.windowEndMs - nowMs);
}

/** Valeur de la jauge, en pourcentage entier. */
export function gaugePercent(progress: number): number {
  return Math.round(100 * progress);
}

type CommonFields = Pick<
  PassageCard,
  "hex" | "callsign" | "airline" | "theme" | "airlineName" | "flightLabel" | "aircraftType" | "altitude" | "speed"
>;

function commonFields(passage: Passage): CommonFields {
  const airline = resolveAirline(passage.callsign);
  return {
    hex: passage.hex,
    callsign: passage.callsign,
    airline,
    theme: airlineTheme(airline),
    airlineName: airline.name,
    flightLabel: flightLabel(passage.callsign, airline),
    // Repli : le vrai type arrive de `useFlightInfo` (SPEC-0009), hors du cycle de la scène.
    aircraftType: NO_VALUE,
    altitude: formatMetric(passage.altitudeM),
    speed: formatMetric(passage.groundSpeedKmh),
  };
}

function overheadCard(passage: Passage, input: CardsInput): PassageCard {
  return {
    ...commonFields(passage),
    kind: "overhead",
    cardinal: passage.trackCardinal,
    arrowAngleDeg: arrowAngleDeg(passage.trackDeg, input.headingDeg),
    countdown: null,
    passTime: null,
    visibility: {
      progress: visibilityProgress(passage, input.nowMs),
      remaining: formatCountdown(visibilityRemainingMs(passage, input.nowMs)),
    },
  };
}

function upcomingCard(passage: Passage, input: CardsInput): PassageCard {
  return {
    ...commonFields(passage),
    kind: "upcoming",
    cardinal: passage.arrivalCardinal,
    arrowAngleDeg: arrowAngleDeg(passage.arrivalBearingDeg, input.headingDeg),
    countdown: formatCountdown(passage.passageTimeMs - input.nowMs),
    passTime: formatLocalTime(passage.passageTimeMs, input.timeZone),
    visibility: null,
  };
}

/** Cartes du carrousel : l'avion en survol d'abord, puis les passages à venir dans leur ordre. */
export function buildCards(input: CardsInput): PassageCard[] {
  const cards: PassageCard[] = [];
  if (input.scene.overhead !== null) {
    cards.push(overheadCard(input.scene.overhead, input));
  }
  for (const passage of input.scene.upcoming) {
    cards.push(upcomingCard(passage, input));
  }
  return cards;
}

/** Cartes d'une vue de la scène : vide tant que la scène n'est pas prête. */
export function cardsOf(view: SceneView, timeZone: string): PassageCard[] {
  const { state, headingDeg } = view;
  if (state.status !== "ready") {
    return [];
  }
  return buildCards({ scene: state.scene, nowMs: state.nowMs, headingDeg, timeZone });
}

export interface PassagesScreenModel {
  cards: PassageCard[];
  notice: StateNotice | null;
  stale: StaleNotice | null;
}

/** Ce que montre Prochains passages : les cartes, la notice d'attente éventuelle et la ligne périmée. */
export function passagesScreenOf(view: SceneView, timeZone: string): PassagesScreenModel {
  return {
    cards: cardsOf(view, timeZone),
    notice: stateNotice(view.state),
    stale: staleNotice(view.state, timeZone),
  };
}
