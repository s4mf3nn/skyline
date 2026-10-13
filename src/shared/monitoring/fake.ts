import type { ErrorReporter } from "./index";

interface ReportedEvent {
  error: unknown;
  context: Record<string, string>;
}

/** Suivi des erreurs factice : garde chaque événement avec son contexte (`{}` par défaut). */
export function createFakeErrorReporter(): ErrorReporter & { events: ReportedEvent[] } {
  const events: ReportedEvent[] = [];
  return {
    events,
    report(error, context = {}) {
      events.push({ error, context });
    },
  };
}
