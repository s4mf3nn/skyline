import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Contrat de SPEC-0000, partie logique (Vitest). Le rendu est dans SPEC-0000.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Les modules de `src/` sont posés par cette spec : ils sont chargés par chemin, avec les types du contrat
// d'interface recopiés ici, pour que le typage passe avant leur création.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface FakeClock {
  now(): number;
  advance(ms: number): void;
}
interface ClockModule {
  createFakeClock(startMs: number): FakeClock;
}

type LocationPermission = "granted" | "denied";
interface Position {
  latitude: number;
  longitude: number;
}
interface FakeLocation {
  requestPermission(): Promise<LocationPermission>;
  getPosition(): Promise<Position>;
  watchHeading(onHeading: (degrees: number) => void): () => void;
  setHeading(degrees: number): void;
}
interface LocationModule {
  createFakeLocation(options: { permission: LocationPermission; position: Position }): FakeLocation;
}

interface Aircraft {
  hex: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  groundSpeedKmh: number | null;
  trackDeg: number | null;
}
interface AdsbQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
}
interface FakeAdsbSource {
  fetchAircraft(query: AdsbQuery): Promise<Aircraft[]>;
  queries: AdsbQuery[];
  setAircraft(aircraft: Aircraft[]): void;
  setUnavailable(unavailable: boolean): void;
}
interface AdsbModule {
  createFakeAdsbSource(aircraft: Aircraft[]): FakeAdsbSource;
}

interface FakeErrorReporter {
  report(error: unknown, context?: Record<string, string>): void;
  events: { error: unknown; context: Record<string, string> }[];
}
interface MonitoringModule {
  createFakeErrorReporter(): FakeErrorReporter;
}

const LYON: Position = { latitude: 45.764, longitude: 4.8357 };
const AROUND_LYON: AdsbQuery = { ...LYON, radiusKm: 80 };
const AIRLINER: Aircraft = {
  hex: "3944ef",
  callsign: "AFR1506",
  latitude: 45.91,
  longitude: 4.95,
  altitudeM: 11200,
  groundSpeedKmh: 830,
  trackDeg: 62,
};
const SILENT_GLIDER: Aircraft = {
  hex: "39ac45",
  callsign: null,
  latitude: 45.7,
  longitude: 4.6,
  altitudeM: null,
  groundSpeedKmh: null,
  trackDeg: null,
};

let tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

describe.skip("SPEC-0000 bootstrap", () => {
  it("CA3 : lists a new feature in the generated registry without touching any other file", () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "spec-0000-"));
    tmpDirs.push(src);
    fs.mkdirSync(path.join(src, "features", "probe"), { recursive: true });
    fs.writeFileSync(path.join(src, "features", "probe", "index.ts"), 'export const feature = { name: "probe" };\n');

    execFileSync("node", [path.resolve("scripts/gen-features.mjs"), src], { stdio: "pipe" });

    const registry = fs.readFileSync(path.join(src, "features.gen.ts"), "utf8");
    expect(registry).toContain('import { feature as probeFeature } from "./features/probe/index";');
    expect(registry).toContain("export const features = [probeFeature] as const;");
    expect(fs.readdirSync(src).sort()).toEqual(["features", "features.gen.ts"]);
    expect(fs.readdirSync(path.join(src, "features", "probe"))).toEqual(["index.ts"]);
  });

  it("CA3 : exposes the generated registry of the application as a list", async () => {
    const registry = await load<{ features: readonly unknown[] }>("src/features.gen.ts");
    expect(Array.isArray(registry.features)).toBe(true);
  });

  it("CA4 : starts the Expo bundler on $PORT without a hard-coded port", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    const dev = pkg.scripts.dev ?? "";
    expect(dev).toContain("expo start");
    expect(dev).toContain("$PORT");
    expect(dev).not.toMatch(/--port[ =]\d/);
  });

  it("CA5 : the fake clock returns the time it was given and moves only when advanced", async () => {
    const { createFakeClock } = await load<ClockModule>("src/shared/clock/index.ts");
    const clock = createFakeClock(1_760_000_000_000);
    expect(clock.now()).toBe(1_760_000_000_000);
    expect(clock.now()).toBe(1_760_000_000_000);
    clock.advance(10_000);
    expect(clock.now()).toBe(1_760_000_010_000);
  });

  it("CA5 : the fake location returns the configured permission and position", async () => {
    const { createFakeLocation } = await load<LocationModule>("src/shared/location/index.ts");
    const location = createFakeLocation({ permission: "granted", position: LYON });
    await expect(location.requestPermission()).resolves.toBe("granted");
    await expect(location.getPosition()).resolves.toEqual(LYON);
  });

  it("CA5 : the fake location rejects the position with LOCATION_DENIED when permission is denied", async () => {
    const { createFakeLocation } = await load<LocationModule>("src/shared/location/index.ts");
    const location = createFakeLocation({ permission: "denied", position: LYON });
    await expect(location.requestPermission()).resolves.toBe("denied");
    await expect(location.getPosition()).rejects.toMatchObject({ code: "LOCATION_DENIED" });
  });

  it("CA5 : the fake location delivers headings until the watcher unsubscribes", async () => {
    const { createFakeLocation } = await load<LocationModule>("src/shared/location/index.ts");
    const location = createFakeLocation({ permission: "granted", position: LYON });
    const received: number[] = [];
    const unsubscribe = location.watchHeading((degrees) => received.push(degrees));
    location.setHeading(205);
    location.setHeading(90);
    unsubscribe();
    location.setHeading(10);
    expect(received).toEqual([205, 90]);
  });

  it("CA5 : the fake ADS-B source returns the configured aircraft and records each query", async () => {
    const { createFakeAdsbSource } = await load<AdsbModule>("src/shared/adsb/index.ts");
    const adsb = createFakeAdsbSource([AIRLINER, SILENT_GLIDER]);
    await expect(adsb.fetchAircraft(AROUND_LYON)).resolves.toEqual([AIRLINER, SILENT_GLIDER]);
    adsb.setAircraft([]);
    await expect(adsb.fetchAircraft({ ...AROUND_LYON, radiusKm: 4 })).resolves.toEqual([]);
    expect(adsb.queries).toEqual([AROUND_LYON, { ...AROUND_LYON, radiusKm: 4 }]);
  });

  it("CA5 : the fake ADS-B source rejects with ADSB_UNAVAILABLE while it is unavailable", async () => {
    const { createFakeAdsbSource } = await load<AdsbModule>("src/shared/adsb/index.ts");
    const adsb = createFakeAdsbSource([AIRLINER]);
    adsb.setUnavailable(true);
    await expect(adsb.fetchAircraft(AROUND_LYON)).rejects.toMatchObject({ code: "ADSB_UNAVAILABLE" });
    adsb.setUnavailable(false);
    await expect(adsb.fetchAircraft(AROUND_LYON)).resolves.toEqual([AIRLINER]);
  });

  it("CA5 : the fake error reporter keeps every reported event with its context", async () => {
    const { createFakeErrorReporter } = await load<MonitoringModule>("src/shared/monitoring/index.ts");
    const monitoring = createFakeErrorReporter();
    const failure = new TypeError("boom");
    monitoring.report(failure, { screen: "home" });
    monitoring.report("plain failure");
    expect(monitoring.events).toEqual([
      { error: failure, context: { screen: "home" } },
      { error: "plain failure", context: {} },
    ]);
  });
});
