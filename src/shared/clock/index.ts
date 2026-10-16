// Point d'entrée : l'interface et le faux seulement. L'horloge système vit dans `system.ts`.
export interface Clock {
  /** Millisecondes depuis l'époque Unix. */
  now(): number;
}

export { createFakeClock } from "./fake";
export { formatClockTime } from "./format";
