import { describe, expect, it, vi } from "vitest";

// `react-native` est natif : il est remplacé, le module réel n'est jamais chargé.
const reactNative = vi.hoisted(() => ({
  Linking: { openSettings: vi.fn() },
}));
vi.mock("react-native", () => reactNative);

import { createFakeSystemSettings, openSettingsQuietly } from "./index";
import { createLinkingSystemSettings } from "./native";

describe("createFakeSystemSettings", () => {
  it("starts with no open", () => {
    expect(createFakeSystemSettings().openCount).toBe(0);
  });

  it("resolves and counts each openSettings call", async () => {
    const settings = createFakeSystemSettings();
    await expect(settings.openSettings()).resolves.toBeUndefined();
    await settings.openSettings();
    expect(settings.openCount).toBe(2);
  });

  it("rejects and still counts when failing", async () => {
    const settings = createFakeSystemSettings({ failing: true });
    await expect(settings.openSettings()).rejects.toThrow();
    expect(settings.openCount).toBe(1);
  });
});

describe("openSettingsQuietly", () => {
  it("calls openSettings once", () => {
    const settings = createFakeSystemSettings();
    openSettingsQuietly(settings);
    expect(settings.openCount).toBe(1);
  });

  it("swallows a rejection and logs nothing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    openSettingsQuietly(createFakeSystemSettings({ failing: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });
});

describe("createLinkingSystemSettings", () => {
  it("delegates to Linking.openSettings", async () => {
    reactNative.Linking.openSettings.mockResolvedValue(undefined);
    await createLinkingSystemSettings().openSettings();
    expect(reactNative.Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it("propagates a Linking rejection", async () => {
    reactNative.Linking.openSettings.mockRejectedValue(new Error("denied"));
    await expect(createLinkingSystemSettings().openSettings()).rejects.toThrow("denied");
  });
});
