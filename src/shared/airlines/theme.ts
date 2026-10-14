import { fit as fitColor, mix } from "./color";
import type { Airline, AirlineTheme } from "./types";

/** Couleurs d'affichage d'une compagnie : texte corrigé pour rester lisible sur le fond (INV5). */
export function airlineTheme(airline: Airline): AirlineTheme {
  const bg = airline.primary;
  const big = fitColor(airline.secondary, bg, 3);
  const small = fitColor(airline.secondary, bg, 4.5);
  return { bg, big, small, track: mix(bg, small, 0.3) };
}
