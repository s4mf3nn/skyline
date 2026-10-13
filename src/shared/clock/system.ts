import type { Clock } from "./index";

/** Horloge réelle, importée par `src/main.tsx` seulement. */
export function createSystemClock(): Clock {
  return { now: () => Date.now() };
}
