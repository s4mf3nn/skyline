import type { AdsbQuery } from "../adsb";
import type { Position } from "../location";
import { acquireObserver } from "../location";
import type { AppServices } from "../services";
import { normalizeDeg } from "./geo";
import { FORECAST_RADIUS_KM, type Scene } from "./model";
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
  let stopped = false;
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
      if (stopped || id !== requestId) return;
      snapshot = { aircraft, takenAtMs: clock.now() };
      problem = null;
      publish();
    } catch {
      if (stopped || id !== requestId) return;
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
      if (stopped || id !== requestId) return;
      if (fix.status === "denied") {
        clearData();
        publish();
        return;
      }
      observer = fix.position;
      await query(fix.position, id);
    } catch {
      if (stopped || id !== requestId) return;
      fail();
    }
  }

  function refresh(): void {
    if (stopped) return;
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
  const unsubscribeForeground = lifecycle?.onForeground(() => void acquire());
  const timer = setInterval(publish, TICK_MS);

  void acquire();

  return {
    refresh,
    stop() {
      stopped = true;
      clearInterval(timer);
      unsubscribeHeading();
      unsubscribeForeground?.();
    },
  };
}
