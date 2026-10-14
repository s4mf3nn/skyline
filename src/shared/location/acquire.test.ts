import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors";
import { acquireObserver, createFakeLocation, type LocationService } from "./index";

const position = { latitude: 48.85, longitude: 2.35 };

function serviceWith(overrides: Partial<LocationService>): LocationService {
  return { ...createFakeLocation({ permission: "granted", position }), ...overrides };
}

describe("acquireObserver", () => {
  it("returns the position when the permission is granted", async () => {
    const fix = await acquireObserver(createFakeLocation({ permission: "granted", position }));
    expect(fix).toEqual({ status: "granted", position });
  });

  it("returns denied without reading the position when the permission is refused", async () => {
    const getPosition = vi.fn();
    const fix = await acquireObserver(serviceWith({ requestPermission: async () => "denied", getPosition }));
    expect(fix).toEqual({ status: "denied" });
    expect(getPosition).not.toHaveBeenCalled();
  });

  it("returns denied when the read rejects with LOCATION_DENIED", async () => {
    const getPosition = async () => {
      throw new AppError("LOCATION_DENIED", "Location permission denied");
    };
    expect(await acquireObserver(serviceWith({ getPosition }))).toEqual({ status: "denied" });
  });

  it("propagates another AppError as is", async () => {
    const failure = new AppError("ADSB_UNAVAILABLE", "Unavailable");
    const getPosition = async () => {
      throw failure;
    };
    await expect(acquireObserver(serviceWith({ getPosition }))).rejects.toBe(failure);
  });

  it("propagates a raw Error as is", async () => {
    const failure = new Error("boom");
    const getPosition = async () => {
      throw failure;
    };
    await expect(acquireObserver(serviceWith({ getPosition }))).rejects.toBe(failure);
  });

  it("reads again on every call", async () => {
    const getPosition = vi.fn(async () => position);
    const location = serviceWith({ getPosition });
    await acquireObserver(location);
    await acquireObserver(location);
    expect(getPosition).toHaveBeenCalledTimes(2);
  });
});
