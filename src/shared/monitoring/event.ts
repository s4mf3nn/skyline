// Filtre de `beforeSend` : pur et sans import Sentry, le type de l'événement est structurel.
import { scrubMessage } from "./scrub";

interface ScrubbableException {
  value?: string;
}

interface ScrubbableBreadcrumb {
  message?: string;
  data?: Record<string, unknown>;
}

export interface ScrubbableEvent {
  message?: string;
  exception?: { values?: ScrubbableException[] };
  tags?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  user?: Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
}

// Valeur inconnue : les chaînes sont filtrées, les objets et tableaux parcourus, le reste est gardé tel quel.
function scrubValue(value: unknown): unknown {
  if (typeof value === "string") return scrubMessage(value);
  // Une coordonnée numérique (45.764) se reconnaît à sa forme texte.
  if (typeof value === "number") return scrubNumber(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (typeof value === "object" && value !== null) return scrubRecord(value as Record<string, unknown>);
  return value;
}

function scrubNumber(value: number): number | string {
  const text = String(value);
  return scrubMessage(text) === text ? value : "[redacted]";
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    scrubbed[key] = scrubValue(value);
  }
  return scrubbed;
}

/** Aussi branché sur `beforeBreadcrumb` : le SDK recopie les breadcrumbs côté natif, hors de `beforeSend`. */
export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(breadcrumb: B): B {
  const scrubbed: ScrubbableBreadcrumb = { ...breadcrumb };
  if (breadcrumb.message !== undefined) scrubbed.message = scrubMessage(breadcrumb.message);
  if (breadcrumb.data !== undefined) scrubbed.data = scrubRecord(breadcrumb.data);
  return scrubbed as B;
}

/** Renvoie une copie de l'événement dont chaque champ porteur de texte est débarrassé des coordonnées. */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const scrubbed: ScrubbableEvent = { ...event };
  if (event.message !== undefined) scrubbed.message = scrubMessage(event.message);
  if (event.exception?.values !== undefined) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((entry) =>
        entry.value === undefined ? entry : { ...entry, value: scrubMessage(entry.value) },
      ),
    };
  }
  if (event.tags !== undefined) scrubbed.tags = scrubRecord(event.tags);
  if (event.extra !== undefined) scrubbed.extra = scrubRecord(event.extra);
  if (event.user !== undefined) scrubbed.user = scrubRecord(event.user);
  if (event.breadcrumbs !== undefined) scrubbed.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  return scrubbed as E;
}
