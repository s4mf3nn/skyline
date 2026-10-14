import { describe, expect, it } from "vitest";
import { AppError } from "./errors";

describe("AppError", () => {
  it("carries its code and message", () => {
    const error = new AppError("LOCATION_DENIED", "Location permission denied");
    expect(error.code).toBe("LOCATION_DENIED");
    expect(error.message).toBe("Location permission denied");
  });

  it("is an Error named AppError", () => {
    const error = new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
  });

  it("carries the INVALID_COLOR code", () => {
    const error = new AppError("INVALID_COLOR", "Invalid color: rouge");
    expect(error.code).toBe("INVALID_COLOR");
  });
});
