// Filtre des données personnelles : fonctions pures, sans React ni Sentry, partagées avec `beforeSend`.
export interface BuildInfo {
  release: string;
  environment: string;
}

export const DEFAULT_BUILD: BuildInfo = { release: "dev", environment: "development" };

const ALLOWED_CONTEXT_KEYS = ["release", "environment", "feature", "screen"];

// Un nombre décimal à trois décimales ou plus est pris pour une coordonnée.
const COORDINATE = /-?\d+\.\d{3,}/g;

/** Ne garde que les clés de contexte autorisées. */
export function scrubContext(context: Record<string, string>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const key of ALLOWED_CONTEXT_KEYS) {
    const value = context[key];
    if (value !== undefined) kept[key] = value;
  }
  return kept;
}

/** Remplace chaque coordonnée du message par `[redacted]`. */
export function scrubMessage(message: string): string {
  return message.replace(COORDINATE, "[redacted]");
}

/** Prépare une erreur levée pour le suivi : message et pile filtrés, contexte réduit aux clés autorisées. */
export function toReport(
  thrown: unknown,
  build: BuildInfo,
  feature: string,
): { error: Error; context: Record<string, string> } {
  const source = thrown instanceof Error ? thrown : new Error(String(thrown));
  const error = new Error(scrubMessage(source.message));
  error.name = source.name;
  if (source.stack !== undefined) error.stack = scrubMessage(source.stack);
  const context = scrubContext({ release: build.release, environment: build.environment, feature });
  return { error, context };
}
