import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0010 (Vitest) : parcours de la table des compagnies et des fichiers embarqués avec
// d'autres données que le contrat de tests.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Airline {
  code: string;
  name: string;
  iata: readonly string[];
  icao: readonly string[];
}
interface AirlinesModule {
  AIRLINES: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  LIVERY_CODES: readonly string[];
  resolveAirline(callsign: string | null): Airline;
  hasLivery(airline: Airline): boolean;
}
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");
const TAILS_DIR = path.resolve("assets/tails");

/** Les premiers octets disent le vrai format : PNG ou WebP (RIFF....WEBP). */
function imageKind(bytes: Buffer): "png" | "webp" | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") {
    return "webp";
  }
  return null;
}

describe("SPEC-0010 holdout : dérives réelles (logique pure)", () => {
  it("gives the same livery whatever the code form of the callsign, and none to a lookalike", async () => {
    const { resolveAirline, hasLivery } = await airlines();
    // Forme OACI, forme IATA et immatriculation : la livrée suit la compagnie résolue, jamais la chaîne reçue.
    for (const callsign of ["KLM1234", "KL1234", " klm1234 "]) {
      expect(resolveAirline(callsign).name).toBe(resolveAirline("KLM1234").name);
      expect(hasLivery(resolveAirline(callsign))).toBe(true);
    }
    for (const callsign of ["VIR3", "VS3", "KLM", "F-HBXA", "N123AB", "", "KLM 1234"]) {
      expect(hasLivery(resolveAirline(callsign))).toBe(false);
    }
  });

  it("covers every airline of the table consistently, with the unknown airline and the excluded four without image", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE, LIVERY_CODES, hasLivery } = await airlines();
    const withLivery = AIRLINES.filter((airline) => hasLivery(airline));
    expect(withLivery.map((airline) => airline.code).sort()).toEqual([...LIVERY_CODES].sort());
    expect(hasLivery(UNKNOWN_AIRLINE)).toBe(false);
    for (const code of ["JAF", "TOM", "VIR", "VOZ"]) {
      const airline = AIRLINES.find((candidate) => candidate.code === code);
      expect(airline).toBeDefined();
      expect(hasLivery(airline as Airline)).toBe(false);
    }
    // Les compagnies sans livrée existent (le catalogue n'en a pas pour toutes) : le repli reste utile.
    expect(AIRLINES.length).toBeGreaterThan(withLivery.length);
  });

  it("embeds a real, non-empty image for every airline with a livery, named after its code", async () => {
    const { LIVERY_CODES } = await airlines();
    const files = fs.readdirSync(TAILS_DIR);
    expect(files).toHaveLength(LIVERY_CODES.length);
    for (const code of LIVERY_CODES) {
      const matches = files.filter((name) => name.replace(/\.[a-z]+$/, "") === code);
      expect(matches).toHaveLength(1);
      const bytes = fs.readFileSync(path.join(TAILS_DIR, matches[0] as string));
      expect(bytes.length).toBeGreaterThan(1000);
      expect(imageKind(bytes)).toBe(matches[0]?.endsWith(".webp") ? "webp" : "png");
    }
  });
});
