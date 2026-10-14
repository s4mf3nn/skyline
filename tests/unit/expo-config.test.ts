import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PluginEntry = string | [string, Record<string, unknown>];

interface AppConfig {
  expo: {
    plugins: PluginEntry[];
    ios: { bundleIdentifier: string };
    android: { package: string };
    runtimeVersion: { policy: string };
    updates: { url: string };
    extra: { eas: { projectId: string } };
  };
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

  it("declares the application identifiers and the EAS project", () => {
    const { expo } = readJson<AppConfig>("app.json");
    expect(expo.ios.bundleIdentifier).toBe("com.samfenn.skyline");
    expect(expo.android.package).toBe("com.samfenn.skyline");
    expect(expo.extra.eas.projectId).toBe("47fe4ec7-fa70-4a37-943a-8cdddb7a0c61");
  });

  it("ties updates to the app version and the EAS project", () => {
    const { expo } = readJson<AppConfig>("app.json");
    expect(expo.runtimeVersion.policy).toBe("appVersion");
    expect(expo.updates.url).toBe("https://u.expo.dev/47fe4ec7-fa70-4a37-943a-8cdddb7a0c61");
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

describe("eas.json profiles", () => {
  interface EasConfig {
    build: {
      preview: { channel: string; android?: { buildType: string }; ios?: { simulator: boolean } };
      production: { channel: string };
    };
    submit: { production: { ios?: { ascAppId?: string } } };
  }

  it("keeps preview out of the stores and on its own channel", () => {
    const { build } = readJson<EasConfig>("eas.json");
    expect(build.preview.channel).toBe("preview");
    expect(build.preview.android?.buildType).toBe("apk");
    expect(build.preview.ios?.simulator).toBe(true);
  });

  it("publishes production on the production channel without an invented ascAppId", () => {
    const { build, submit } = readJson<EasConfig>("eas.json");
    expect(build.production.channel).toBe("production");
    expect(submit.production.ios?.ascAppId).toBeUndefined();
  });
});
