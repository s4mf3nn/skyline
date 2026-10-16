import type { Passage } from "../../../shared/scene";
import type { AppServices } from "../../../shared/services";
import { SKY_ABSENT, type SkyState } from "../service";

/**
 * `shown` : dernier avion montré, distinct de la présence (il survit jusqu'au retrait de la page).
 * `shownAtMs` : heure de scène à laquelle sa position a été calculée (l'avion retenu reste figé, INV9).
 */
export interface SkySnapshot {
  state: SkyState;
  shown: Passage | null;
  shownAtMs: number | null;
}

export interface SkyStore {
  get(): SkySnapshot;
  update(state: SkyState, nowMs: number): void;
  subscribe(listener: () => void): () => void;
}

export function createSkyStore(): SkyStore {
  let snapshot: SkySnapshot = { state: SKY_ABSENT, shown: null, shownAtMs: null };
  const listeners = new Set<() => void>();

  return {
    get: () => snapshot,
    update(state, nowMs) {
      const { state: current, shown, shownAtMs } = snapshot;
      // État identique : aucune notification.
      if (state.presence === current.presence && state.passage === current.passage) return;
      // État `absent` : `passage` est nul, on garde le dernier avion montré (CA13).
      snapshot =
        state.passage === null ? { state, shown, shownAtMs } : { state, shown: state.passage, shownAtMs: nowMs };
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Un magasin par application : deux `createApp` ne partagent rien (CA17).
const stores = new WeakMap<AppServices, SkyStore>();

export function skyStoreFor(services: AppServices): SkyStore {
  let store = stores.get(services);
  if (store === undefined) {
    store = createSkyStore();
    stores.set(services, store);
  }
  return store;
}
