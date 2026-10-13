import type { ErrorReporter } from "./index";

/** Implémentation réelle provisoire : ne transmet rien, en attendant Sentry (SPEC-0001). */
export function createNoopErrorReporter(): ErrorReporter {
  return { report: () => {} };
}
