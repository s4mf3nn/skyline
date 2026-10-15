import type { AdsbQuery } from "../adsb";
import type { Position } from "../location";
import { acquireObserver } from "../location";
import type { AppServices } from "../services";
import { normalizeDeg } from "./geo";
import { FORECAST_RADIUS_KM, REFRESH_INTERVAL_MS, type Scene } from "./model";
import { computeScene } from "./scene";

export type SceneState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; scene: Scene; snapshotAtMs: number; nowMs: number };

export interface SceneView {
  state: SceneState;
  headingDeg: number | null;
}

export interface SceneController {
  /** Interroge de nouveau la source (relit d'abord la position si elle n'est pas connue). */
  refresh(): void;
  /** Coupe les abonnements et le minuteur ; plus aucune mise à jour ni requête ensuite. */
  stop(): void;
}

export type SceneServices = Pick<AppServices, "clock" | "location" | "adsb" | "lifecycle">;

const TICK_MS = 1000;

// Arrondi à 3 décimales (environ 110 m) : la position exacte ne quitte jamais l'appareil (INV7).
// `+ 0` remplace un `-0` par `0`.
const roundCoordinate = (value: number): number => Math.round(value * 1000) / 1000 + 0;

export function adsbQueryFor(position: Position): AdsbQuery {
  return {
    latitude: roundCoordinate(position.latitude),
    longitude: roundCoordinate(position.longitude),
    radiusKm: FORECAST_RADIUS_KM,
  };
}

type Problem = "loading" | "denied" | "unavailable";

interface Snapshot {
  aircraft: Awaited<ReturnType<SceneServices["adsb"]["fetchAircraft"]>>;
  takenAtMs: number;
}

/**
 * Logique du crochet `useScene`, sans React. Démarre à la création.
 * Aucun log ni suivi d'erreur ici : la position ne doit pas fuiter (INV7).
 */
export function createSceneController(services: SceneServices, onChange: (view: SceneView) => void): SceneController {
  const { clock, location, adsb, lifecycle } = services;

  // Raison pour laquelle aucune scène n'est exposée ; `null` quand un instantané et un observateur existent.
  let problem: Problem | null = "loading";
  let observer: Position | null = null;
  let snapshot: Snapshot | null = null;
  let overheadHex: string | null = null;
  let headingDeg: number | null = null;
  let requestId = 0;
  // Identifiant de la requête la plus récente dont la réponse a été prise en compte (succès ou échec).
  let settledId = 0;
  let stopped = false;
  let paused = false;
  // Début de la cadence de 10 s : le montage, puis chaque retour au premier plan.
  let cadenceOriginMs = clock.now();
  let nextDueMs = cadenceOriginMs + REFRESH_INTERVAL_MS;
  let lastState: SceneState = { status: "loading" };

  function emit(state: SceneState): void {
    lastState = state;
    onChange({ state, headingDeg });
  }

  // Recalcule la scène à l'heure courante avec le survol précédent (INV1).
  function publish(): void {
    if (stopped) return;
    if (problem !== null || observer === null || snapshot === null) {
      emit({ status: problem ?? "loading" });
      return;
    }
    const nowMs = clock.now();
    const scene = computeScene({ snapshot, observer, nowMs, previousOverheadHex: overheadHex });
    overheadHex = scene.overhead?.hex ?? null;
    emit({ status: "ready", scene, snapshotAtMs: snapshot.takenAtMs, nowMs });
  }

  // Vrai si la réponse de la requête `id` doit être ignorée (démontage, pause ou requête plus récente).
  function isObsolete(id: number): boolean {
    return stopped || paused || id !== requestId;
  }

  // Sans instantané antérieur la source est indisponible ; avec, on garde la dernière scène (CA17).
  function fail(): void {
    problem = snapshot === null ? "unavailable" : null;
    publish();
  }

  function clearData(): void {
    observer = null;
    snapshot = null;
    overheadHex = null;
    problem = "denied";
  }

  async function query(position: Position, id: number): Promise<void> {
    try {
      const aircraft = await adsb.fetchAircraft(adsbQueryFor(position));
      if (isObsolete(id)) return;
      settledId = id;
      snapshot = { aircraft, takenAtMs: clock.now() };
      problem = null;
      publish();
    } catch {
      if (isObsolete(id)) return;
      settledId = id;
      fail();
    }
  }

  async function acquire(): Promise<void> {
    requestId += 1;
    const id = requestId;
    if (problem === "denied") {
      problem = "loading";
      publish();
    }
    try {
      const fix = await acquireObserver(location);
      if (isObsolete(id)) return;
      if (fix.status === "denied") {
        settledId = id;
        clearData();
        publish();
        return;
      }
      observer = fix.position;
      await query(fix.position, id);
    } catch {
      if (isObsolete(id)) return;
      settledId = id;
      fail();
    }
  }

  function refresh(): void {
    if (stopped || paused) return;
    if (observer === null) {
      void acquire();
      return;
    }
    requestId += 1;
    void query(observer, requestId);
  }

  const unsubscribeHeading = location.watchHeading((degrees) => {
    if (stopped) return;
    headingDeg = normalizeDeg(degrees);
    emit(lastState);
  });

  // Chaque seconde : recalcul de la scène, puis requête si l'échéance de 10 s est atteinte.
  function tick(): void {
    publish();
    const nowMs = clock.now();
    if (nowMs < nextDueMs) return;
    // Pas de rattrapage : on saute les échéances manquées et on reprend à la suivante.
    const elapsedPeriods = Math.floor((nowMs - cadenceOriginMs) / REFRESH_INTERVAL_MS);
    nextDueMs = cadenceOriginMs + (elapsedPeriods + 1) * REFRESH_INTERVAL_MS;
    // Jamais deux requêtes en parallèle, et aucune requête tant que la permission est refusée.
    if (settledId !== requestId || problem === "denied") return;
    refresh();
  }

  let timer = setInterval(tick, TICK_MS);

  const unsubscribeForeground = lifecycle?.onForeground(() => {
    if (stopped) return;
    paused = false;
    cadenceOriginMs = clock.now();
    nextDueMs = cadenceOriginMs + REFRESH_INTERVAL_MS;
    clearInterval(timer);
    timer = setInterval(tick, TICK_MS);
    void acquire();
  });
  const unsubscribeBackground = lifecycle?.onBackground?.(() => {
    if (stopped) return;
    paused = true;
    clearInterval(timer);
  });

  void acquire();

  return {
    refresh,
    stop() {
      stopped = true;
      clearInterval(timer);
      unsubscribeHeading();
      unsubscribeForeground?.();
      unsubscribeBackground?.();
    },
  };
}
