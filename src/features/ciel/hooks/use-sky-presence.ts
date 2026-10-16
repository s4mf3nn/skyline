import { useEffect, useSyncExternalStore } from "react";
import type { PageName } from "../../../shared/feature";
import { useScene } from "../../../shared/scene";
import { useServices } from "../../../shared/services";
import { nextSkyState, sceneTimeOf, skyInputOf } from "../service";
import { skyStoreFor } from "./sky-store";

/** `presence` de la feature : vrai quand Ciel doit être une page du pager. Appelé par la sonde du pager. */
export function useSkyPresence(displayedPage: PageName): boolean {
  const store = skyStoreFor(useServices());
  const view = useScene();

  useEffect(() => {
    const next = nextSkyState({ previous: store.get().state, ...skyInputOf(view.state), displayedPage });
    store.update(next, sceneTimeOf(view.state));
  }, [store, view.state, displayedPage]);

  const { state } = useSyncExternalStore(store.subscribe, store.get);
  return state.presence !== "absent";
}
