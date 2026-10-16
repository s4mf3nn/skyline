import type { FetchLike } from "../adsb/adsblol";
import { AppError } from "../errors";
import { parseAircraftBody, parseRouteBody } from "./adsbdb-response";
import { normalizeCallsign, normalizeHex, ROUTE_REQUEST_TIMEOUT_MS, type RouteSource } from "./index";

const BASE_URL = "https://api.adsbdb.com/v0";
const STATUS_NOT_FOUND = 404;

// Message fixe : ni l'URL ni le corps reçu dans une erreur (INV7).
function unavailable(): AppError {
  return new AppError("ROUTE_UNAVAILABLE", "Route source unavailable");
}

/** URL de l'indicatif : hôte et chemin fixes, indicatif normalisé ; `null` si l'indicatif est refusé. */
export function buildCallsignUrl(callsign: string): string | null {
  const normalized = normalizeCallsign(callsign);
  return normalized === null ? null : `${BASE_URL}/callsign/${normalized}`;
}

/** URL de l'appareil : hôte et chemin fixes, `hex` en minuscules ; `null` si l'adresse est refusée. */
export function buildAircraftUrl(hex: string): string | null {
  const normalized = normalizeHex(hex);
  return normalized === null ? null : `${BASE_URL}/aircraft/${normalized}`;
}

/** Source réelle des routes (adsbdb.com) ; `fetch` est injecté pour les tests. */
export function createAdsbdbRouteSource(options: { fetch: FetchLike }): RouteSource {
  // Rend le corps JSON, ou `undefined` pour un 404 (réponse définitive « inconnu »).
  async function request(url: string): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // La course garantit le rejet même si `fetch` ignore le signal.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(unavailable());
        }, ROUTE_REQUEST_TIMEOUT_MS);
      });
      const read = async () => {
        const response = await options.fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (response.status === STATUS_NOT_FOUND) return undefined;
        if (!response.ok) throw unavailable();
        return await response.json();
      };
      return await Promise.race([read(), timeout]);
    } catch {
      throw unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async fetchRoute(callsign) {
      const url = buildCallsignUrl(callsign);
      if (url === null) return null;
      const body = await request(url);
      return body === undefined ? null : parseRouteBody(body);
    },
    async fetchAircraftType(hex) {
      const url = buildAircraftUrl(hex);
      if (url === null) return null;
      const body = await request(url);
      return body === undefined ? null : parseAircraftBody(body);
    },
  };
}
