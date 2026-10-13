import type { Clock } from "./index";

/** Horloge qui ne bouge que lorsqu'on l'avance. */
export function createFakeClock(startMs: number): Clock & { advance(ms: number): void } {
  let current = startMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
    },
  };
}
