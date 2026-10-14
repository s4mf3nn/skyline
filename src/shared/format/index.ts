import type { Airline } from "../airlines";

const NO_VALUE = "—";
const NBSP = " ";
// Trois lettres ASCII suivies d'un chiffre : forme OACI d'un indicatif.
const ICAO_CALLSIGN = /^[A-Z]{3}[0-9]/;

/**
 * Vol en forme IATA : le préfixe OACI est remplacé par le premier code IATA de la compagnie.
 * Tout autre indicatif est rendu nettoyé tel quel.
 */
export function flightLabel(callsign: string | null, airline: Airline): string {
  const clean = callsign?.trim().toUpperCase() ?? "";
  if (clean === "") {
    return NO_VALUE;
  }
  const iata = airline.iata[0];
  if (iata === undefined || !ICAO_CALLSIGN.test(clean)) {
    return clean;
  }
  return iata + clean.slice(3);
}

/** Entier arrondi, milliers séparés par une espace insécable, `—` quand la valeur est inconnue. */
export function formatMetric(value: number | null): string {
  if (value === null) {
    return NO_VALUE;
  }
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  // Séparateur fait à la main : le rendu d'`Intl` varie selon la locale de l'appareil.
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return sign + digits;
}
