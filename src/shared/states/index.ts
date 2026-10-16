import { formatClockTime } from "../clock";
import type { SceneState } from "../scene";

/** Délai sans réponse au bout duquel les données affichées sont dites périmées (3 minutes). */
export const STALE_AFTER_MS = 180_000;

export type NoticeKind = "loading" | "denied" | "unavailable" | "empty";

export interface StateNotice {
  kind: NoticeKind;
  title: string;
  detail: string | null;
  action: string | null;
}

export interface StaleNotice {
  text: string;
}

const LOADING: StateNotice = { kind: "loading", title: "Recherche des avions…", detail: null, action: null };

const DENIED: StateNotice = {
  kind: "denied",
  title: "Localisation désactivée",
  detail: "Skyline a besoin de votre position pour savoir quels avions passent au-dessus de vous.",
  action: "Ouvrir les réglages",
};

const UNAVAILABLE: StateNotice = {
  kind: "unavailable",
  title: "Hors ligne",
  detail: "Impossible de joindre les avions pour le moment. Nouvelle tentative automatique.",
  action: null,
};

const EMPTY: StateNotice = {
  kind: "empty",
  title: "Aucun passage prévu",
  detail: "Aucun avion ne devrait passer près de vous pour le moment. La liste se met à jour toute seule.",
  action: null,
};

/** Vrai dès que l'instantané a atteint le délai ; un instantané daté du futur n'est jamais périmé. */
export function isStale(snapshotAtMs: number, nowMs: number): boolean {
  return nowMs - snapshotAtMs >= STALE_AFTER_MS;
}

/** `HH:MM` sur 24 h dans le fuseau reçu. */
export function formatDataTime(timestampMs: number, timeZone: string): string {
  return formatClockTime(timestampMs, timeZone);
}

/** Notice de l'état d'attente, ou `null` quand il y a des avions à montrer. */
export function stateNotice(state: SceneState): StateNotice | null {
  switch (state.status) {
    case "loading":
      return LOADING;
    case "denied":
      return DENIED;
    case "unavailable":
      return UNAVAILABLE;
    case "ready":
      return state.scene.overhead === null && state.scene.upcoming.length === 0 ? EMPTY : null;
  }
}

/** Ligne « Données de HH:MM » quand la scène prête n'a pas été rafraîchie depuis le délai. */
export function staleNotice(state: SceneState, timeZone: string): StaleNotice | null {
  if (state.status !== "ready" || !isStale(state.snapshotAtMs, state.nowMs)) {
    return null;
  }
  return { text: `Données de ${formatDataTime(state.snapshotAtMs, timeZone)} : mise à jour impossible` };
}
