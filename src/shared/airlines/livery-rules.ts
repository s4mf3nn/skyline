import { LIVERY_CODES } from "./livery-codes.gen";
import type { Airline } from "./types";

export { LIVERY_CODES };

/** Notice de crédit des images de compagnies, affichée dans l'application par le propriétaire. */
export const LIVERY_CREDIT =
  "Images des compagnies : Inflight Feed (inflightfeed.com) ; livrées © leurs compagnies. Utilisées pour identifier les vols, sans affiliation.";

/** Vrai si une livrée réelle est disponible pour cette compagnie. */
export function hasLivery(airline: Airline): boolean {
  return LIVERY_CODES.includes(airline.code);
}
