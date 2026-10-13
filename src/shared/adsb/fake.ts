import { AppError } from "../errors";
import type { AdsbQuery, AdsbSource, Aircraft } from "./index";

/** Source ADS-B factice : liste fixée, requêtes enregistrées, indisponibilité à la demande. */
export function createFakeAdsbSource(aircraft: Aircraft[]): AdsbSource & {
  queries: AdsbQuery[];
  setAircraft(aircraft: Aircraft[]): void;
  setUnavailable(unavailable: boolean): void;
} {
  let current = [...aircraft];
  let unavailable = false;
  const queries: AdsbQuery[] = [];

  return {
    queries,
    async fetchAircraft(query) {
      queries.push({ ...query });
      if (unavailable) {
        throw new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable");
      }
      return [...current];
    },
    setAircraft(next) {
      current = [...next];
    },
    setUnavailable(value) {
      unavailable = value;
    },
  };
}
