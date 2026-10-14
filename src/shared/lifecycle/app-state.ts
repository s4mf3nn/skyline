import { AppState, type AppStateStatus } from "react-native";
import type { AppLifecycle } from "./index";

/** Cycle de vie réel, fondé sur `AppState` de React Native. Importé par `main.tsx` seul (module natif). */
export function createAppStateLifecycle(): AppLifecycle {
  return {
    onForeground(listener) {
      let previous: AppStateStatus = AppState.currentState;
      const subscription = AppState.addEventListener("change", (next) => {
        // Seul un retour depuis `inactive` ou `background` compte : `active → active` n'est pas un retour.
        const comesBack = next === "active" && (previous === "background" || previous === "inactive");
        previous = next;
        if (comesBack) listener();
      });
      return () => subscription.remove();
    },
  };
}
