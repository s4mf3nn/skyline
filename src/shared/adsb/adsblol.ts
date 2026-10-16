import { AppError } from "../errors";
import { parseAdsbLolBody } from "./adsblol-response";
import type { AdsbQuery, AdsbSource } from "./index";

/** Délai maximal d'une requête, en millisecondes. */
export const ADSB_REQUEST_TIMEOUT_MS = 8000;

const HOST_AND_PATH = "https://api.adsb.lol/v2/point";
const KM_PER_NAUTICAL_MILE = 1.852;
const MAX_RADIUS_NM = 250;

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

interface FetchInit {
  method: "GET";
  headers: Record<string, string>;
  signal: AbortSignal;
}

export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>;

// Message fixe : jamais de coordonnée dans une erreur (INV7).
function unavailable(): AppError {
  return new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable");
}

// Arrondi à 3 décimales ; `-0` et les zéros de fin disparaissent à la conversion en texte.
function formatCoordinate(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** URL de la requête : hôte et chemin fixes, position arrondie, rayon en milles nautiques. */
export function buildAdsbLolUrl(query: AdsbQuery): string {
  const { latitude, longitude, radiusKm } = query;
  if (
    !isInRange(latitude, -90, 90) ||
    !isInRange(longitude, -180, 180) ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0
  ) {
    throw unavailable();
  }
  const radiusNm = Math.min(Math.ceil(radiusKm / KM_PER_NAUTICAL_MILE), MAX_RADIUS_NM);
  return `${HOST_AND_PATH}/${formatCoordinate(latitude)}/${formatCoordinate(longitude)}/${radiusNm}`;
}

/** Source ADS-B réelle (adsb.lol) ; `fetch` est injecté pour les tests. */
export function createAdsbLolSource(options: { fetch: FetchLike }): AdsbSource {
  return {
    async fetchAircraft(query) {
      // Lève avant tout appel réseau si la requête est invalide.
      const url = buildAdsbLolUrl(query);
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // La course garantit le rejet même si `fetch` ignore le signal.
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(unavailable());
          }, ADSB_REQUEST_TIMEOUT_MS);
        });
        const read = async () => {
          const response = await options.fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          if (!response.ok) throw unavailable();
          return parseAdsbLolBody(await response.json());
        };
        return await Promise.race([read(), timeout]);
      } catch {
        throw unavailable();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
