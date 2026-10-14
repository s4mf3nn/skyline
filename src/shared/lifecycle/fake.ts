import type { AppLifecycle } from "./index";

/** Cycle de vie factice : le retour au premier plan est poussé à la main par `enterForeground`. */
export function createFakeLifecycle(): AppLifecycle & { enterForeground(): void } {
  const listeners = new Set<() => void>();

  return {
    onForeground(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    enterForeground() {
      for (const listener of [...listeners]) listener();
    },
  };
}
