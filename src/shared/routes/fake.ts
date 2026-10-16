import { AppError } from "../errors";
import type { FlightRoute, RouteSource } from "./index";

interface FakeRouteData {
  /** Clé : indicatif normalisé ; `null` : inconnu. */
  routes?: Record<string, FlightRoute | null>;
  /** Clé : `hex` en minuscules ; `null` : inconnu. */
  aircraftTypes?: Record<string, string | null>;
}

/** Source de routes factice : données fixées, demandes enregistrées, indisponibilité et retenue à la demande. */
export function createFakeRouteSource(data: FakeRouteData = {}): RouteSource & {
  readonly routeRequests: string[];
  readonly typeRequests: string[];
  setUnavailable(unavailable: boolean): void;
  holdResponses(): void;
  releaseResponses(): void;
} {
  const routeRequests: string[] = [];
  const typeRequests: string[] = [];
  let unavailable = false;
  // Tant que les réponses sont retenues, chaque demande attend cette promesse.
  let gate: Promise<void> | null = null;
  let openGate: () => void = () => {};

  // L'état `unavailable` est lu au moment de la réponse, après la libération éventuelle.
  async function respond<T>(value: T | null): Promise<T | null> {
    if (gate !== null) await gate;
    if (unavailable) throw new AppError("ROUTE_UNAVAILABLE", "Route source unavailable");
    return value;
  }

  return {
    routeRequests,
    typeRequests,
    fetchRoute(callsign) {
      routeRequests.push(callsign);
      return respond(data.routes?.[callsign] ?? null);
    },
    fetchAircraftType(hex) {
      typeRequests.push(hex);
      return respond(data.aircraftTypes?.[hex] ?? null);
    },
    setUnavailable(value) {
      unavailable = value;
    },
    holdResponses() {
      if (gate !== null) return;
      gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
    },
    releaseResponses() {
      openGate();
      gate = null;
    },
  };
}
