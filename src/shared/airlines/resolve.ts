import { AIRLINES, UNKNOWN_AIRLINE } from "./table";
import type { Airline } from "./types";

// Trois lettres ASCII suivies d'un chiffre : la suite après ce chiffre est ignorée.
const ICAO_CALLSIGN = /^([A-Z]{3})[0-9]/;
// Deux caractères alphanumériques puis 1 à 4 chiffres, et rien d'autre.
const IATA_CALLSIGN = /^([A-Z0-9]{2})[0-9]{1,4}$/;

function indexByCode(codesOf: (airline: Airline) => readonly string[]): ReadonlyMap<string, Airline> {
  const index = new Map<string, Airline>();
  for (const airline of AIRLINES) {
    for (const code of codesOf(airline)) {
      if (!index.has(code)) {
        index.set(code, airline);
      }
    }
  }
  return index;
}

const BY_ICAO = indexByCode((airline) => airline.icao);
const BY_IATA = indexByCode((airline) => airline.iata);

/**
 * Compagnie d'un indicatif ADS-B : préfixe OACI d'abord, forme IATA ensuite.
 * Rend `UNKNOWN_AIRLINE` quand rien ne correspond ; ne lève jamais.
 */
export function resolveAirline(callsign: string | null): Airline {
  if (callsign === null) {
    return UNKNOWN_AIRLINE;
  }
  const clean = callsign.trim().toUpperCase();

  const icaoPrefix = ICAO_CALLSIGN.exec(clean)?.[1];
  const byIcao = icaoPrefix === undefined ? undefined : BY_ICAO.get(icaoPrefix);
  if (byIcao !== undefined) {
    return byIcao;
  }

  const iataPrefix = IATA_CALLSIGN.exec(clean)?.[1];
  const byIata = iataPrefix === undefined ? undefined : BY_IATA.get(iataPrefix);
  return byIata ?? UNKNOWN_AIRLINE;
}
