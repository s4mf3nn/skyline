import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0010 (Vitest) : partie pure des dérives réelles (codes avec livrée, notice de crédit, contenu de
// assets/tails/). L'affichage sur Ciel et sur les cartes est joué par SPEC-0010.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Module posé par cette spec et par SPEC-0002 : chargé par chemin, avec les types du contrat recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Airline {
  code: string;
  name: string;
}
interface AirlinesModule {
  AIRLINES: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  resolveAirline(callsign: string | null): Airline;
  LIVERY_CODES: readonly string[];
  hasLivery(airline: Airline): boolean;
  LIVERY_CREDIT: string;
}
interface LiveryEntry {
  code: string;
  name: string;
  file: string;
  bytes: number;
  sha256: string;
}
interface Snapshot {
  excluded: Array<{ code: string; name: string }>;
  liveries: LiveryEntry[];
}

// Instantané des images autorisées, versionné avec la spec (« Autorisation consignée »).
const snapshot: Snapshot = JSON.parse(
  fs.readFileSync(path.resolve("tests/acceptance/SPEC-0010.liveries.json"), "utf8"),
);
const SNAPSHOT_CODES = snapshot.liveries.map((entry) => entry.code);
const SHARED_PAIRS = [
  ["JAF", "TOM"],
  ["VIR", "VOZ"],
];
const HANDOFF_CODES = ["IBE", "AFR", "EZY", "DLH", "KLM", "RYR", "VLG", "TAP"];
const TAILS_DIR = path.resolve("assets/tails");
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");

describe.skip("SPEC-0010 Dérives réelles (logique pure)", () => {
  it("CA1 : lists exactly the codes of the authorized liveries, among the table airlines", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE, LIVERY_CODES } = await airlines();
    expect(SNAPSHOT_CODES).toHaveLength(137);
    expect(new Set(LIVERY_CODES).size).toBe(LIVERY_CODES.length);
    expect([...LIVERY_CODES].sort()).toEqual([...SNAPSHOT_CODES].sort());
    const tableCodes = new Set(AIRLINES.map((airline) => airline.code));
    for (const code of LIVERY_CODES) expect(tableCodes.has(code)).toBe(true);
    for (const code of SHARED_PAIRS.flat()) expect(LIVERY_CODES).toContain(code);
    expect(LIVERY_CODES).not.toContain(UNKNOWN_AIRLINE.code);
    for (const code of HANDOFF_CODES) expect(LIVERY_CODES).toContain(code);
  });

  it("CA2 : hasLivery is true only for airlines of the list, and never for the unknown airline", async () => {
    const { AIRLINES, UNKNOWN_AIRLINE, LIVERY_CODES, resolveAirline, hasLivery } = await airlines();
    expect(hasLivery(resolveAirline("AFR1506"))).toBe(true);
    expect(hasLivery(resolveAirline("EZY4617"))).toBe(true);
    expect(hasLivery(resolveAirline("VIR3"))).toBe(true);
    expect(hasLivery(resolveAirline("TOM123"))).toBe(true);
    expect(hasLivery(resolveAirline("ZZZ123"))).toBe(false);
    expect(hasLivery(resolveAirline(null))).toBe(false);
    expect(hasLivery(UNKNOWN_AIRLINE)).toBe(false);
    for (const airline of AIRLINES) expect(hasLivery(airline)).toBe(LIVERY_CODES.includes(airline.code));
    const withoutLivery = AIRLINES.filter((airline) => !LIVERY_CODES.includes(airline.code));
    expect(withoutLivery.length).toBeGreaterThan(0);
  });

  it("CA3 : assets/tails holds exactly the authorized files, byte for byte, with only the declared shared images", () => {
    const names = fs.readdirSync(TAILS_DIR).sort();
    expect(names).toEqual(snapshot.liveries.map((entry) => entry.file).sort());
    for (const entry of snapshot.liveries) {
      expect(entry.file).toMatch(new RegExp(`^${entry.code}\\.(png|webp)$`));
      const file = path.join(TAILS_DIR, entry.file);
      expect(fs.statSync(file).isFile()).toBe(true);
      const bytes = fs.readFileSync(file);
      expect(bytes.length).toBe(entry.bytes);
      expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    }
    // Seules les paires déclarées partagent une image : tout autre doublon serait l'image d'une autre compagnie.
    const byHash = new Map<string, string[]>();
    for (const entry of snapshot.liveries) byHash.set(entry.sha256, [...(byHash.get(entry.sha256) ?? []), entry.code]);
    const shared = [...byHash.values()].filter((codes) => codes.length > 1).map((codes) => [...codes].sort());
    expect(shared.sort()).toEqual(SHARED_PAIRS.map((pair) => [...pair].sort()).sort());
  });

  it("CA4 : exposes the credit notice verbatim", async () => {
    const { LIVERY_CREDIT } = await airlines();
    expect(LIVERY_CREDIT).toBe(
      "Images des compagnies : Inflight Feed (inflightfeed.com) ; livrées © leurs compagnies. Utilisées pour identifier les vols, sans affiliation.",
    );
  });
});
