import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PluginEntry = string | [string, Record<string, unknown>];

interface AppConfig {
  expo: { plugins: PluginEntry[] };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function locationPluginOptions(): Record<string, unknown> {
  const { expo } = readJson<AppConfig>("app.json");
  const entry = expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-location");
  if (!Array.isArray(entry)) {
    throw new Error("expo-location plugin is not configured with options");
  }
  return entry[1];
}

describe("app.json location permission", () => {
  it("asks for the when-in-use permission with a text", () => {
    const options = locationPluginOptions();
    expect(options.locationWhenInUsePermission).toBe(
      "Skyline utilise ta position pour trouver les avions qui passent au-dessus de toi.",
    );
  });

  // Une option absente reçoit le texte par défaut du plugin : seule la valeur `false` retire la clé de l'Info.plist.
  it("removes the always and motion usage descriptions from the Info.plist", () => {
    const options = locationPluginOptions();
    expect(options.locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(options.locationAlwaysPermission).toBe(false);
    expect(options.motionUsagePermission).toBe(false);
  });

  it("never enables background location on iOS or Android", () => {
    const options = locationPluginOptions();
    expect(options.isIosBackgroundLocationEnabled).toBe(false);
    expect(options.isAndroidBackgroundLocationEnabled).toBe(false);
  });

  it("declares no application identifier", () => {
    const raw = readFileSync("app.json", "utf8");
    expect(raw).not.toMatch(/bundleIdentifier|"package"/);
  });
});

describe("package.json dev script", () => {
  it("starts Expo on $PORT without a hard-coded port", () => {
    const { scripts } = readJson<{ scripts: Record<string, string> }>("package.json");
    expect(scripts.dev).toContain("expo start");
    expect(scripts.dev).toContain("--port $PORT");
    expect(scripts.dev).not.toMatch(/--port\s+\d+/);
  });
});
