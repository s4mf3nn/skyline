import { beforeEach, describe, expect, it, vi } from "vitest";

// `expo-location` est natif : il est remplacé, le module réel n'est jamais chargé.
const expoLocation = vi.hoisted(() => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  requestForegroundPermissionsAsync: vi.fn(),
  getForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  watchHeadingAsync: vi.fn(),
}));
vi.mock("expo-location", () => expoLocation);

import { createExpoLocation } from "./expo";

type HeadingCallback = (heading: { trueHeading: number; magHeading: number }) => void;

/** Branche `watchHeadingAsync` sur une promesse que le test résout ou rejette à sa guise. */
function controlWatch() {
  const remove = vi.fn();
  let callback: HeadingCallback = () => {};
  let resolve: (subscription: { remove: () => void }) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  expoLocation.watchHeadingAsync.mockImplementation((onHeading: HeadingCallback) => {
    callback = onHeading;
    return new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
  });
  return {
    remove,
    emit: (heading: { trueHeading: number; magHeading: number }) => callback(heading),
    establish: () => resolve({ remove }),
    fail: () => reject(new Error("sensor missing")),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("expo location permission", () => {
  it("maps granted to granted", async () => {
    expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    await expect(createExpoLocation().requestPermission()).resolves.toBe("granted");
  });

  it.each(["denied", "undetermined"])("maps the %s status to denied", async (status) => {
    expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status });
    await expect(createExpoLocation().requestPermission()).resolves.toBe("denied");
  });
});

describe("expo location position", () => {
  it("returns the latitude and longitude only when permission is granted", async () => {
    expoLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    expoLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 45.764, longitude: 4.8357, altitude: 200, accuracy: 5 },
      timestamp: 1,
    });
    await expect(createExpoLocation().getPosition()).resolves.toEqual({ latitude: 45.764, longitude: 4.8357 });
  });

  it.each(["denied", "undetermined"])(
    "rejects with LOCATION_DENIED for the %s status, without asking",
    async (status) => {
      expoLocation.getForegroundPermissionsAsync.mockResolvedValue({ status });
      await expect(createExpoLocation().getPosition()).rejects.toMatchObject({ code: "LOCATION_DENIED" });
      expect(expoLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    },
  );
});

describe("expo location heading", () => {
  it("forwards the true heading", async () => {
    const watch = controlWatch();
    const received: number[] = [];
    createExpoLocation().watchHeading((degrees) => received.push(degrees));
    watch.establish();
    await flush();
    watch.emit({ trueHeading: 120, magHeading: 118 });
    expect(received).toEqual([120]);
  });

  it("forwards the magnetic heading when the true heading is unavailable (-1)", async () => {
    const watch = controlWatch();
    const received: number[] = [];
    createExpoLocation().watchHeading((degrees) => received.push(degrees));
    watch.establish();
    await flush();
    watch.emit({ trueHeading: -1, magHeading: 118 });
    expect(received).toEqual([118]);
  });

  it("removes the subscription and stops delivering after unsubscribe", async () => {
    const watch = controlWatch();
    const received: number[] = [];
    const unsubscribe = createExpoLocation().watchHeading((degrees) => received.push(degrees));
    watch.establish();
    await flush();
    unsubscribe();
    watch.emit({ trueHeading: 50, magHeading: 50 });
    expect(watch.remove).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);
  });

  it("removes the subscription when unsubscribe is called before it is established", async () => {
    const watch = controlWatch();
    const received: number[] = [];
    const unsubscribe = createExpoLocation().watchHeading((degrees) => received.push(degrees));
    unsubscribe();
    watch.emit({ trueHeading: 50, magHeading: 50 });
    watch.establish();
    await flush();
    expect(watch.remove).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);
  });

  it("delivers nothing and keeps unsubscribe callable when the subscription is rejected", async () => {
    const watch = controlWatch();
    const received: number[] = [];
    const unsubscribe = createExpoLocation().watchHeading((degrees) => received.push(degrees));
    watch.fail();
    await flush();
    watch.emit({ trueHeading: 50, magHeading: 50 });
    expect(() => unsubscribe()).not.toThrow();
    expect(received).toEqual([]);
  });

  it("keeps unsubscribe callable before a rejection arrives", async () => {
    const watch = controlWatch();
    const unsubscribe = createExpoLocation().watchHeading(() => {});
    expect(() => unsubscribe()).not.toThrow();
    watch.fail();
    await flush();
  });
});
