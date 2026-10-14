import { describe, expect, it } from "vitest";
import { contrastRatio, fit as fitColor, mix } from "./color";

const invalidColor = expect.objectContaining({ code: "INVALID_COLOR" });

describe("mix", () => {
  it("interpolates channel by channel in uppercase", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#c8102e", "#000000", 0)).toBe("#C8102E");
    expect(mix("#C8102E", "#00a1de", 1)).toBe("#00A1DE");
  });

  it("rejects invalid colors", () => {
    expect(() => mix("rouge", "#000000", 0.5)).toThrow(invalidColor);
    expect(() => mix("#000000", "#FFF", 0.5)).toThrow(invalidColor);
    expect(() => mix("#000000", "", 0.5)).toThrow(invalidColor);
  });
});

describe("contrastRatio", () => {
  it("is symmetric and spans 1 to 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.478, 3);
  });

  it("uses the low-value branch of the luminance below 0.03928", () => {
    // 10/255 = 0.0392 : branche linéaire ; 11/255 = 0.0431 : branche puissance.
    expect(contrastRatio("#0A0A0A", "#000000")).toBeCloseTo(1.0607, 3);
    expect(contrastRatio("#0B0B0B", "#000000")).toBeCloseTo(1.0667, 3);
  });

  it("rejects an invalid color", () => {
    expect(() => contrastRatio("", "#000000")).toThrow(invalidColor);
  });
});

describe("fit", () => {
  it("keeps the foreground, case included, when the target is reached", () => {
    expect(fitColor("#f6c344", "#C8102E", 3)).toBe("#f6c344");
    expect(fitColor("#000000", "#FFFFFF", 21)).toBe("#000000");
  });

  it("moves toward white or black in steps of 0.02", () => {
    expect(fitColor("#808080", "#FFFFFF", 4.5)).toBe("#767676");
    expect(fitColor("#777777", "#FFFFFF", 4.5)).toBe("#757575");
    expect(fitColor("#336699", "#336699", 3)).toBe("#A5BCD2");
  });

  it("accumulates t by floating-point addition", () => {
    expect(fitColor("#C0B12C", "#59EF48", 4.5)).toBe("#605816");
    expect(fitColor("#748CC1", "#9B9658", 3)).toBe("#3A4660");
  });

  it("falls back to cream or ink, ink on a tie", () => {
    expect(fitColor("#101010", "#101010", 15)).toBe("#F4F1EA");
    expect(fitColor("#FFFFFF", "#FF6600", 3)).toBe("#1D1D1B");
    expect(fitColor("#808080", "#7F7F7F", 4.5)).toBe("#1D1D1B");
  });

  it("rejects an invalid color", () => {
    expect(() => fitColor("#12345G", "#000000", 3)).toThrow(invalidColor);
  });
});
