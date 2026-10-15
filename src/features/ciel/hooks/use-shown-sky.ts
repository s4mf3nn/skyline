import { useMemo, useSyncExternalStore } from "react";
import { useServices } from "../../../shared/services";
import { buildSkyView, type SkyView } from "../service";
import { skyStoreFor } from "./sky-store";

/** Avion montré par l'écran : il reste affiché pendant la transition de retrait de la page. */
export function useShownSky(): SkyView | null {
  const store = skyStoreFor(useServices());
  const { shown } = useSyncExternalStore(store.subscribe, store.get);
  return useMemo(() => (shown === null ? null : buildSkyView(shown)), [shown]);
}
