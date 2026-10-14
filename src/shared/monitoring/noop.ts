import type { ErrorReporter } from "./index";

/** Repli sans DSN (développement, tests, build non configuré) : ne transmet rien. */
export function createNoopErrorReporter(): ErrorReporter {
  return { report: () => {} };
}
