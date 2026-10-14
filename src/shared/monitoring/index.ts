// Point d'entrée : l'interface et le faux seulement. L'implémentation provisoire vit dans `noop.ts`.
export interface ErrorReporter {
  /** Le contexte ne doit contenir aucune donnée personnelle, position comprise. */
  report(error: unknown, context?: Record<string, string>): void;
}

export { createFakeErrorReporter } from "./fake";
export type { BuildInfo } from "./scrub";
export { DEFAULT_BUILD, scrubContext, scrubMessage, toReport } from "./scrub";
