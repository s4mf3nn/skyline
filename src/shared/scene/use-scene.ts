import { useSyncExternalStore } from "react";
import type { SceneView } from "./controller";
import { useSceneStore } from "./provider";

/** Liaison React du magasin de scène : toute la décision est dans `controller.ts`. */
export function useScene(): SceneView & { refresh(): void } {
  const store = useSceneStore();
  const view = useSyncExternalStore(store.subscribe, store.getView);
  return { ...view, refresh: store.refresh };
}
