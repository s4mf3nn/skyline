import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0001, partie logique (Vitest) : le filtre des données personnelles. Le rendu est dans
// SPEC-0001.native.test.tsx (Jest). CA1 à CA3 et CA6 se prouvent sur la cible (workflow release, job e2e).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Module posé par cette spec : chargé par chemin, avec les types du contrat d'interface recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface MonitoringModule {
  scrubContext(context: Record<string, string>): Record<string, string>;
  scrubMessage(message: string): string;
}
const monitoring = () => load<MonitoringModule>("src/shared/monitoring/index.ts");

describe("SPEC-0001 delivery", () => {
  it("CA5 : keeps only the allowed context keys", async () => {
    const { scrubContext } = await monitoring();
    const context = {
      release: "3f2a9c1",
      environment: "production",
      feature: "sky",
      screen: "SkyScreen",
      latitude: "45.764",
      longitude: "4.8357",
      heading: "205",
      callsign: "AFR1506",
    };
    expect(scrubContext(context)).toEqual({
      release: "3f2a9c1",
      environment: "production",
      feature: "sky",
      screen: "SkyScreen",
    });
  });

  it("CA5 : returns an empty context when no key is allowed", async () => {
    const { scrubContext } = await monitoring();
    expect(scrubContext({ latitude: "45.764", note: "harmless" })).toEqual({});
  });

  it("CA5 : masks coordinates in an error message", async () => {
    const { scrubMessage } = await monitoring();
    expect(scrubMessage("no aircraft near 45.764, 4.8357")).toBe("no aircraft near [redacted], [redacted]");
    expect(scrubMessage("lat=-33.86882;lon=151.20929")).toBe("lat=[redacted];lon=[redacted]");
  });

  it("CA5 : leaves a message without coordinates unchanged", async () => {
    const { scrubMessage } = await monitoring();
    expect(scrubMessage("render failed after 10 s at 4.5 km")).toBe("render failed after 10 s at 4.5 km");
    expect(scrubMessage("")).toBe("");
  });
});
