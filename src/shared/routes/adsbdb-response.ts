import { z } from "zod";
import { AppError } from "../errors";
import type { Airport, FlightRoute } from "./index";

// Hermes n'autorise pas `new Function` : on désactive la compilation rapide de Zod (ADR-0004).
z.config({ jitless: true });

const MAX_TYPE_LENGTH = 40;

const bodySchema = z.object({ response: z.unknown() });
const recordSchema = z.record(z.string(), z.unknown());

// Chaque champ invalide ou absent vaut null sans rejeter l'aéroport (INV6).
const airportSchema = z.object({
  iata_code: z
    .string()
    .regex(/^[A-Z0-9]{3}$/)
    .nullable()
    .catch(null),
  municipality: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .catch(null),
  latitude: z.number().min(-90).max(90).nullable().catch(null),
  longitude: z.number().min(-180).max(180).nullable().catch(null),
});

const EMPTY_AIRPORT: Airport = { iata: null, city: null, latitude: null, longitude: null };

// Message fixe : ni l'URL ni le corps reçu dans une erreur (INV7).
export function routeUnavailable(): AppError {
  return new AppError("ROUTE_UNAVAILABLE", "Route source unavailable");
}

/**
 * Contenu de `response.<key>` ; `null` pour la réponse définitive « inconnu ».
 * Lève `ROUTE_UNAVAILABLE` pour tout autre corps.
 */
function readEntry(body: unknown, key: string, unknownText: string): Record<string, unknown> | null {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw routeUnavailable();
  const { response } = parsed.data;
  if (response === unknownText) return null;
  const container = recordSchema.safeParse(response);
  if (!container.success) throw routeUnavailable();
  const entry = recordSchema.safeParse(container.data[key]);
  if (!entry.success) throw routeUnavailable();
  return entry.data;
}

function toAirport(raw: unknown): Airport {
  const parsed = airportSchema.safeParse(raw);
  if (!parsed.success) return EMPTY_AIRPORT;
  const { iata_code, municipality, latitude, longitude } = parsed.data;
  return { iata: iata_code, city: municipality, latitude, longitude };
}

/** Route d'un corps adsbdb ; `null` si l'indicatif est inconnu, lève `ROUTE_UNAVAILABLE` si le corps est illisible. */
export function parseRouteBody(body: unknown): FlightRoute | null {
  const entry = readEntry(body, "flightroute", "unknown callsign");
  if (entry === null) return null;
  return { origin: toAirport(entry.origin), destination: toAirport(entry.destination) };
}

/** Type d'appareil d'un corps adsbdb ; `null` si inconnu ou invalide, lève `ROUTE_UNAVAILABLE` si le corps est illisible. */
export function parseAircraftBody(body: unknown): string | null {
  const entry = readEntry(body, "aircraft", "unknown aircraft");
  if (entry === null) return null;
  const type = z.string().safeParse(entry.type);
  if (!type.success) return null;
  const trimmed = type.data.trim();
  return trimmed !== "" && trimmed.length <= MAX_TYPE_LENGTH ? trimmed : null;
}
