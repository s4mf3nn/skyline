import { AppState, type AppStateStatus } from "react-native";
import type { AppLifecycle } from "./index";

/** Vrai pour une transition qui doit appeler le listener, d'après l'état précédent et le nouveau. */
type Transition = (previous: AppStateStatus, next: AppStateStatus) => boolean;

// Seul un retour depuis `inactive` ou `background` compte : `active → active` n'est pas un retour.
const isForeground: Transition = (previous, next) =>
  next === "active" && (previous === "background" || previous === "inactive");

// Seule une sortie de `active` compte : `background → background` ou `inactive → background` ne rappellent rien.
const isBackground: Transition = (previous, next) =>
  previous === "active" && (next === "background" || next === "inactive");

function subscribe(listener: () => void, matches: Transition): () => void {
  let previous: AppStateStatus = AppState.currentState;
  const subscription = AppState.addEventListener("change", (next) => {
    const hit = matches(previous, next);
    previous = next;
    if (hit) listener();
  });
  return () => subscription.remove();
}

/** Cycle de vie réel, fondé sur `AppState` de React Native. Importé par `main.tsx` seul (module natif). */
export function createAppStateLifecycle(): Required<AppLifecycle> {
  return {
    onForeground: (listener) => subscribe(listener, isForeground),
    onBackground: (listener) => subscribe(listener, isBackground),
  };
}
