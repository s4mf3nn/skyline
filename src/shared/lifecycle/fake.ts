import type { AppLifecycle } from "./index";

/** Cycle de vie factice : les passages au premier plan et en arrière-plan sont poussés à la main. */
export function createFakeLifecycle(): Required<AppLifecycle> & { enterForeground(): void; enterBackground(): void } {
  const foregroundListeners = new Set<() => void>();
  const backgroundListeners = new Set<() => void>();

  function subscribe(listeners: Set<() => void>, listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    onForeground: (listener) => subscribe(foregroundListeners, listener),
    onBackground: (listener) => subscribe(backgroundListeners, listener),
    enterForeground() {
      for (const listener of [...foregroundListeners]) listener();
    },
    enterBackground() {
      for (const listener of [...backgroundListeners]) listener();
    },
  };
}
