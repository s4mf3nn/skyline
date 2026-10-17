import { describe, expect, it } from "vitest";
import { createFakeLocation } from "./fake";
import { chooseLocation, parseManualPosition } from "./manual";

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const real = createFakeLocation({ permission: "denied", position: { latitude: 0, longitude: 0 } });

describe("parseManualPosition", () => {
  it("reads latitude and longitude", () => {
    expect(parseManualPosition("48.8566, 2.3522")).toEqual(PARIS);
  });

  it.each([undefined, "", "48.8566", "a,b", "48.8566,", "91,0", "0,181", "1,2,3"])("rejects %j", (raw) => {
    expect(parseManualPosition(raw)).toBeUndefined();
  });
});

describe("chooseLocation", () => {
  it("uses the manual position in development", async () => {
    const location = chooseLocation({ isDev: true, requested: "48.8566,2.3522", real });
    expect(await location.requestPermission()).toBe("granted");
    expect(await location.getPosition()).toEqual(PARIS);
  });

  it("ignores the manual position outside development", () => {
    expect(chooseLocation({ isDev: false, requested: "48.8566,2.3522", real })).toBe(real);
  });

  it("falls back to the real service when the value is invalid", () => {
    expect(chooseLocation({ isDev: true, requested: "nope", real })).toBe(real);
  });
});
