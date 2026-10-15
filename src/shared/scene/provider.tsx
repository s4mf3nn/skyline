import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from "react";
import { useServices } from "../services";
import { createSceneStore, type SceneStore } from "./store";

const SceneStoreContext = createContext<SceneStore | null>(null);

/** Fournit le magasin de scène de l'application ; à monter sous `ServicesProvider`. */
export function SceneProvider({ children }: { children: ReactNode }): ReactElement {
  const services = useServices();
  const store = useMemo(() => createSceneStore(services), [services]);
  return <SceneStoreContext.Provider value={store}>{children}</SceneStoreContext.Provider>;
}

/** Magasin de l'application ; échoue hors d'un `SceneProvider` (erreur de programmation). */
export function useSceneStore(): SceneStore {
  const store = useContext(SceneStoreContext);
  if (store === null) throw new Error("useScene must be used inside a SceneProvider");
  return store;
}
