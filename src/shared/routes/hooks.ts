import { useEffect, useState } from "react";
import { useScene } from "../scene";
import { useServices } from "../services";
import type { FlightRoute, LookupResult } from "./index";

export interface FlightInfo {
  route: FlightRoute | null;
  aircraftType: string | null;
}

interface Answer {
  /** Avion pour lequel la réponse a été reçue (hex et indicatif). */
  key: string;
  info: FlightInfo;
  /** Vrai quand ni la route ni le type ne seront redemandés. */
  settled: boolean;
}

const NO_INFO: FlightInfo = { route: null, aircraftType: null };

function foundValue<T>(result: LookupResult<T>): T | null {
  return result.status === "found" ? result.value : null;
}

/**
 * Route et type d'appareil d'un avion. La demande part hors du cycle de la scène : l'affichage n'attend jamais.
 * Elle est renouvelée à chaque nouvel instantané tant qu'une réponse n'est pas définitive (le cache applique le délai).
 */
export function useFlightInfo(hex: string | null, callsign: string | null): FlightInfo {
  const { routes } = useServices();
  const { state } = useScene();
  const snapshotAtMs = state.status === "ready" ? state.snapshotAtMs : null;
  const key = `${hex ?? ""}|${callsign ?? ""}`;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const settledKey = answer?.settled ? answer.key : null;

  useEffect(() => {
    // Rien à demander sans service, sans avion, avant la première scène ou une fois les réponses définitives.
    if (routes === undefined || hex === null || snapshotAtMs === null || settledKey === key) return;
    let active = true;
    const routeRequest = callsign === null ? null : routes.route(callsign);
    Promise.all([routeRequest, routes.aircraftType(hex)]).then(([route, type]) => {
      if (!active) return;
      const results = [route, type].filter((result) => result !== null);
      setAnswer({
        key,
        info: { route: route === null ? null : foundValue(route), aircraftType: foundValue(type) },
        settled: results.every((result) => result.status !== "unavailable"),
      });
    });
    return () => {
      active = false;
    };
  }, [routes, hex, callsign, key, settledKey, snapshotAtMs]);

  return answer?.key === key ? answer.info : NO_INFO;
}
