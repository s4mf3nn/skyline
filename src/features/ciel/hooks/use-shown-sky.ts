import { useMemo, useSyncExternalStore } from "react";
import { useFlightInfo } from "../../../shared/routes/hooks";
import { useServices } from "../../../shared/services";
import { buildShownSky, flightKeyOf, type ShownSky } from "../service";
import { skyStoreFor } from "./sky-store";

/** Avion montré par l'écran : il reste affiché pendant la transition de retrait de la page. */
export function useShownSky(): ShownSky | null {
  const store = skyStoreFor(useServices());
  const { shown, shownAtMs } = useSyncExternalStore(store.subscribe, store.get);
  const { hex, callsign } = flightKeyOf(shown);
  const { aircraftType } = useFlightInfo(hex, callsign);
  return useMemo(() => buildShownSky(shown, shownAtMs, aircraftType), [shown, shownAtMs, aircraftType]);
}
