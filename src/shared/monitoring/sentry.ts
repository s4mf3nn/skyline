import * as Sentry from "@sentry/react-native";
import { scrubEvent } from "./event";
import type { ErrorReporter } from "./index";
import { createNoopErrorReporter } from "./noop";
import { type BuildInfo, scrubContext } from "./scrub";

interface SentryOptions extends BuildInfo {
  dsn: string | undefined;
}

/** Suivi des erreurs Sentry ; sans DSN (développement, tests), rien n'est initialisé ni transmis. */
export function createSentryErrorReporter({ dsn, release, environment }: SentryOptions): ErrorReporter {
  if (dsn === undefined || dsn === "") return createNoopErrorReporter();
  Sentry.init({
    dsn,
    release,
    environment,
    // La collecte automatique reste coupée : la position ne doit jamais partir avec une erreur.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
  return {
    report(error, context = {}) {
      Sentry.captureException(error, { tags: scrubContext(context) });
    },
  };
}
