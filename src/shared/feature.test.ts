import { describe, expect, it } from "vitest";
import { type Feature, pickScreen } from "./feature";

const Fallback = () => null;
const ScreenA = () => null;
const ScreenB = () => null;
const ScreenC = () => null;

describe("pickScreen", () => {
  it("returns the fallback when there is no feature", () => {
    expect(pickScreen([], Fallback)).toBe(Fallback);
  });

  it("returns the screen of the feature with the smallest order", () => {
    const features: Feature[] = [
      { name: "b", order: 2, screen: ScreenB },
      { name: "a", order: 1, screen: ScreenA },
      { name: "c", order: 3, screen: ScreenC },
    ];
    expect(pickScreen(features, Fallback)).toBe(ScreenA);
  });

  it("keeps the first feature when two share the smallest order", () => {
    const features: Feature[] = [
      { name: "b", order: 1, screen: ScreenB },
      { name: "a", order: 1, screen: ScreenA },
    ];
    expect(pickScreen(features, Fallback)).toBe(ScreenB);
  });

  it("does not modify its input", () => {
    const features: Feature[] = [
      { name: "b", order: 2, screen: ScreenB },
      { name: "a", order: 1, screen: ScreenA },
    ];
    pickScreen(features, Fallback);
    expect(features.map((f) => f.name)).toEqual(["b", "a"]);
  });
});
