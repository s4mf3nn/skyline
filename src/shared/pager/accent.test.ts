import { describe, expect, it } from "vitest";
import { activeAccent, withAccent } from "./accent";

describe("activeAccent", () => {
  it("returns the accent of the active page", () => {
    expect(activeAccent(["#112233", "#AABBCC"], 1, "#F4F1EA")).toBe("#AABBCC");
  });

  it("falls back to the default when the page has no accent", () => {
    expect(activeAccent([null, "#AABBCC"], 0, "#F4F1EA")).toBe("#F4F1EA");
  });

  it("keeps the case of the color", () => {
    expect(activeAccent(["#aBcDeF", null], 0, "#F4F1EA")).toBe("#aBcDeF");
  });
});

describe("withAccent", () => {
  it("returns a new tuple with only the given page changed", () => {
    const accents = ["#111111", "#222222"] as const;
    const next = withAccent(accents, 0, "#333333");
    expect(next).toEqual(["#333333", "#222222"]);
    expect(next).not.toBe(accents);
    expect(accents).toEqual(["#111111", "#222222"]);
  });

  it("changes the second page and accepts null", () => {
    expect(withAccent(["#111111", "#222222"], 1, null)).toEqual(["#111111", null]);
  });
});
