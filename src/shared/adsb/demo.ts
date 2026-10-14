import type { Clock } from "../clock";
import type { AdsbQuery, AdsbSource, Aircraft } from "./index";

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = (EARTH_RADIUS_KM * Math.PI) / 180;
const MS_PER_HOUR = 3_600_000;

// Même vitesse pour toutes les voies : les phases réparties gardent alors un écart constant entre avions.
const GROUND_SPEED_KMH = 800;
// Marge laissée entre l'extrémité d'une voie et le bord du rayon (décalage latéral compris).
const RADIUS_MARGIN_KM = 4;
const MAX_HALF_LENGTH_KM = 60;
const HEX_BASE = 0xa00000;
const HEX_LANE_STEP = 0x1000;

/** Une voie rectiligne qui passe à `offsetKm` de la position demandée, parcourue en boucle. */
interface DemoLane {
  callsign: string | null;
  /** Écart latéral à la position demandée, sous le seuil de survol (4 km). */
  offsetKm: number;
  trackDeg: number;
  altitudeM: number;
  /** Position de départ dans le cycle, de 0 à 1. */
  phase: number;
}

const LANE_COUNT = 8;

// Phases réparties de période / 8 ; caps variés pour que l'écran montre des arrivées de toutes parts.
const DEMO_LANES: readonly DemoLane[] = [
  { callsign: "AFR1234", offsetKm: 0.5, trackDeg: 90, altitudeM: 10_500, phase: 0 / LANE_COUNT },
  { callsign: "IBE3456", offsetKm: 2, trackDeg: 200, altitudeM: 9_800, phase: 1 / LANE_COUNT },
  { callsign: "RYR78AB", offsetKm: 1, trackDeg: 315, altitudeM: 11_000, phase: 2 / LANE_COUNT },
  { callsign: "KLM1234", offsetKm: 3, trackDeg: 20, altitudeM: 8_500, phase: 3 / LANE_COUNT },
  { callsign: "ZZZ9999", offsetKm: 1.5, trackDeg: 150, altitudeM: 7_200, phase: 4 / LANE_COUNT },
  { callsign: "AFR5678", offsetKm: 2.5, trackDeg: 270, altitudeM: 10_000, phase: 5 / LANE_COUNT },
  { callsign: "IBE9012", offsetKm: 0.8, trackDeg: 45, altitudeM: 9_000, phase: 6 / LANE_COUNT },
  { callsign: "KLM5678", offsetKm: 1.8, trackDeg: 240, altitudeM: 11_500, phase: 7 / LANE_COUNT },
];

/** Position d'une voie à l'heure `nowMs`, dans le plan local autour de la requête. */
function laneAircraft(lane: DemoLane, index: number, query: AdsbQuery, nowMs: number): Aircraft {
  const halfLengthKm = Math.min(MAX_HALF_LENGTH_KM, query.radiusKm - RADIUS_MARGIN_KM);
  const cycleLengthKm = 2 * halfLengthKm;
  const cycles = (nowMs * GROUND_SPEED_KMH) / MS_PER_HOUR / cycleLengthKm + lane.phase;
  const cycleIndex = Math.floor(cycles);
  const alongKm = -halfLengthKm + (cycles - cycleIndex) * cycleLengthKm;

  const trackRad = (lane.trackDeg * Math.PI) / 180;
  const eastKm = alongKm * Math.sin(trackRad) + lane.offsetKm * Math.cos(trackRad);
  const northKm = alongKm * Math.cos(trackRad) - lane.offsetKm * Math.sin(trackRad);
  const cosLat = Math.cos((query.latitude * Math.PI) / 180);

  // Un nouvel avion à chaque cycle : le `hex` dépend de la voie et du numéro de cycle.
  const hexValue = HEX_BASE + index * HEX_LANE_STEP + (cycleIndex % HEX_LANE_STEP);

  return {
    hex: hexValue.toString(16).padStart(6, "0"),
    callsign: lane.callsign,
    latitude: query.latitude + northKm / KM_PER_DEGREE,
    longitude: query.longitude + eastKm / (KM_PER_DEGREE * cosLat),
    altitudeM: lane.altitudeM,
    groundSpeedKmh: GROUND_SPEED_KMH,
    trackDeg: lane.trackDeg,
  };
}

/**
 * Source de démonstration pour le développement : huit avions sur des voies fixes,
 * positionnés à l'heure de l'horloge reçue. Aucun réseau, aucun log, aucune position conservée.
 */
export function createDemoAdsbSource(clock: Clock): AdsbSource {
  return {
    async fetchAircraft(query) {
      const nowMs = clock.now();
      return DEMO_LANES.map((lane, index) => laneAircraft(lane, index, query, nowMs));
    },
  };
}
