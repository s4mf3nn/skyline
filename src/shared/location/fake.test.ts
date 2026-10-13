import { describe, expect, it } from "vitest";
import { createFakeLocation } from "./index";

const LYON = { latitude: 45.764, longitude: 4.8357 };

describe("fake location", () => {
  it("returns the configured permission and position", async () => {
    const location = createFakeLocation({ permission: "granted", position: LYON });
    await expect(location.requestPermission()).resolves.toBe("granted");
    await expect(location.getPosition()).resolves.toEqual(LYON);
  });

  it("rejects the position with LOCATION_DENIED when permission is denied", async () => {
    const location = createFakeLocation({ permission: "denied", position: LYON });
    await expect(location.requestPermission()).resolves.toBe("denied");
    await expect(location.getPosition()).rejects.toMatchObject({ code: "LOCATION_DENIED" });
  });

  it("delivers headings until the watcher unsubscribes", () => {
    const location = createFakeLocation({ permission: "granted", position: LYON });
    const received: number[] = [];
    const unsubscribe = location.watchHeading((degrees) => received.push(degrees));
    location.setHeading(205);
    location.setHeading(90);
    unsubscribe();
    location.setHeading(10);
    expect(received).toEqual([205, 90]);
  });

  it("keeps delivering to other watchers after one unsubscribes", () => {
    const location = createFakeLocation({ permission: "granted", position: LYON });
    const first: number[] = [];
    const second: number[] = [];
    const unsubscribeFirst = location.watchHeading((degrees) => first.push(degrees));
    location.watchHeading((degrees) => second.push(degrees));
    unsubscribeFirst();
    location.setHeading(45);
    expect(first).toEqual([]);
    expect(second).toEqual([45]);
  });
});
