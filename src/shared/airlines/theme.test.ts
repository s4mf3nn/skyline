import { describe, expect, it } from "vitest";
import { airlineTheme } from "./theme";
import type { Airline } from "./types";

const tail = { base: "#FFFFFF", stripe1: null, stripe2: null, disc: null };

function airline(code: string, primary: string, secondary: string): Airline {
  return { code, name: code, country: null, primary, secondary, iata: [], icao: [code], tail };
}

describe("airlineTheme", () => {
  it("keeps a readable secondary color (Iberia)", () => {
    expect(airlineTheme(airline("IBE", "#C8102E", "#F6C344"))).toEqual({
      bg: "#C8102E",
      big: "#F6C344",
      small: "#FADF9A",
      track: "#D74E4E",
    });
  });

  it("keeps cream on navy (Air France)", () => {
    expect(airlineTheme(airline("AFR", "#0B1F4B", "#F4F1EA"))).toEqual({
      bg: "#0B1F4B",
      big: "#F4F1EA",
      small: "#F4F1EA",
      track: "#515E7B",
    });
  });

  it("corrects a low-contrast secondary color to ink (easyJet)", () => {
    expect(airlineTheme(airline("EZY", "#FF6600", "#FFFFFF"))).toEqual({
      bg: "#FF6600",
      big: "#1D1D1B",
      small: "#1D1D1B",
      track: "#BB5008",
    });
  });

  it("rejects an invalid color in the airline", () => {
    const invalidColor = expect.objectContaining({ code: "INVALID_COLOR" });
    expect(() => airlineTheme(airline("XXX", "nope", "#FFFFFF"))).toThrow(invalidColor);
    expect(() => airlineTheme(airline("XXX", "#FFFFFF", "#F2E8D"))).toThrow(invalidColor);
  });
});
