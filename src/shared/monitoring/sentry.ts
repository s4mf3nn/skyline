import * as Sentry from "@sentry/react-native";
import { scrubBreadcrumb, scrubEvent } from "./event";
import type { ErrorReporter } from "./index";
import { createNoopErrorReporter } from "./noop";
import { type BuildInfo, scrubContext } from "./scrub";

interface SentryOptions extends BuildInfo {
  dsn: string | undefined;
}

/** Suivi des erreurs Sentry ; sans DSN (développement, tests), rien n'est initialisé ni transmis. */
export function createSentryErrorReporter({ dsn, release, environment }: SentryOptions): ErrorReporter {
  if (dsn === undefined || dsn === "") return createNoopErrorReporter();
  // `enableNetworkBreadcrumbs` (iOS natif) est documenté mais absent des types du SDK : variable, donc sans contrôle des propriétés en trop.
  const options = {
    dsn,
    release,
    environment,
    // La collecte automatique reste coupée : la position ne doit jamais partir avec une erreur.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    // Les breadcrumbs sont recopiés côté natif (plantages) sans passer par `beforeSend`.
    beforeBreadcrumb: scrubBreadcrumb,
    // Le SDK natif iOS enregistre ses propres breadcrumbs réseau, hors de `beforeBreadcrumb`.
    enableNetworkBreadcrumbs: false,
  };
  Sentry.init(options);
  return {
    report(error, context = {}) {
      Sentry.captureException(error, { tags: scrubContext(context) });
    },
  };
}
