import { z } from "zod";
import { AppError } from "../errors";
import type { Aircraft } from "./index";
import { advanceBySeenPos } from "./position-age";

// Hermes n'autorise pas `new Function` : on désactive la compilation rapide de Zod (ADR-0004).
z.config({ jitless: true });

const FEET_TO_M = 0.3048;
const KNOTS_TO_KMH = 1.852;

const responseSchema = z.object({ ac: z.array(z.unknown()) });

// Identité et position obligatoires ; chaque autre champ invalide ou absent vaut null (INV6).
const entrySchema = z.object({
  hex: z.string().regex(/^[0-9a-f]{6}$/i),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  flight: z.string().nullable().catch(null),
  alt_baro: z
    .union([z.number(), z.literal("ground")])
    .nullable()
    .catch(null),
  gs: z.number().min(0).nullable().catch(null),
  track: z.number().min(0).max(360).nullable().catch(null),
  seen_pos: z.number().min(0).catch(0),
});

type Entry = z.infer<typeof entrySchema>;

function unavailable(): AppError {
  return new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable");
}

function toAircraft(entry: Entry): Aircraft | null {
  if (entry.alt_baro === "ground") return null;
  const callsign = entry.flight?.trim() ?? "";
  const aircraft: Aircraft = {
    hex: entry.hex.toLowerCase(),
    callsign: callsign === "" ? null : callsign,
    latitude: entry.lat,
    longitude: entry.lon,
    altitudeM: entry.alt_baro === null ? null : entry.alt_baro * FEET_TO_M,
    groundSpeedKmh: entry.gs === null ? null : entry.gs * KNOTS_TO_KMH,
    trackDeg: entry.track,
  };
  return advanceBySeenPos(aircraft, entry.seen_pos);
}

/** Convertit le corps JSON d'adsb.lol en avions ; lève `ADSB_UNAVAILABLE` si le corps est illisible. */
export function parseAdsbLolBody(body: unknown): Aircraft[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw unavailable();

  const aircraft: Aircraft[] = [];
  for (const raw of parsed.data.ac) {
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) continue;
    const converted = toAircraft(entry.data);
    if (converted !== null) aircraft.push(converted);
  }
  return aircraft;
}
