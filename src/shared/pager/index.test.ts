import { describe, expect, it } from "vitest";
import type { Feature } from "../feature";
import {
  draggedOffset,
  indicatorTraits,
  lockAxis,
  PAGER_LAYOUT,
  PAGER_METRICS,
  pagerRoot,
  pageValueText,
  restOffset,
  selectPages,
  settlePage,
  stepPage,
} from "./index";

const Screen = () => null;
const feature = (name: string, order: number): Feature => ({ name, order, screen: Screen });

describe("PAGER_METRICS", () => {
  it("holds the design handoff values", () => {
    expect(PAGER_METRICS).toEqual({
      swipeThresholdPt: 60,
      edgeResistance: 0.3,
      axisLockPt: 8,
      transitionMs: 380,
      easing: [0.2, 0.8, 0.2, 1],
      indicatorTransitionMs: 300,
    });
    expect(PAGER_LAYOUT.defaultAccent).toBe("#F4F1EA");
  });
});

describe("lockAxis", () => {
  it("returns null under 8 pt and locks from 8 pt", () => {
    expect(lockAxis(7.99, 0)).toBeNull();
    expect(lockAxis(0, -7.99)).toBeNull();
    expect(lockAxis(8, 0)).toBe("horizontal");
    expect(lockAxis(0, -8)).toBe("vertical");
  });

  it("treats |dx| == |dy| as vertical", () => {
    expect(lockAxis(10, 10)).toBe("vertical");
    expect(lockAxis(-10, 10)).toBe("vertical");
    expect(lockAxis(10.1, 10)).toBe("horizontal");
  });
});

describe("draggedOffset", () => {
  it("follows the finger toward an existing page", () => {
    expect(draggedOffset(0, -100)).toBe(-100);
    expect(draggedOffset(1, 100)).toBe(100);
  });

  it("resists beyond the edges", () => {
    expect(draggedOffset(0, 100)).toBeCloseTo(30);
    expect(draggedOffset(1, -400)).toBeCloseTo(-120);
  });
});

describe("settlePage", () => {
  it("changes page from 60 pt, not before", () => {
    expect(settlePage(0, -59.9)).toBe(0);
    expect(settlePage(0, -60)).toBe(1);
    expect(settlePage(1, 59.9)).toBe(1);
    expect(settlePage(1, 60)).toBe(0);
  });

  it("stays put when swiping toward the outside", () => {
    expect(settlePage(0, 400)).toBe(0);
    expect(settlePage(1, -400)).toBe(1);
  });
});

describe("restOffset", () => {
  it("is minus the page times the width", () => {
    expect(restOffset(0, 390)).toBe(-0);
    expect(restOffset(1, 390)).toBe(-390);
  });
});

describe("indicatorTraits", () => {
  it("makes the active trait wide and opaque", () => {
    expect(indicatorTraits(0)).toEqual([
      { width: 18, height: 4, opacity: 1 },
      { width: 6, height: 4, opacity: 0.4 },
    ]);
    expect(indicatorTraits(1)).toEqual([
      { width: 6, height: 4, opacity: 0.4 },
      { width: 18, height: 4, opacity: 1 },
    ]);
  });
});

describe("pageValueText and stepPage", () => {
  it("describes the page", () => {
    expect(pageValueText(0)).toBe("Page 1 sur 2");
    expect(pageValueText(1)).toBe("Page 2 sur 2");
  });

  it("clamps at both edges", () => {
    expect(stepPage(0, "increment")).toBe(1);
    expect(stepPage(1, "increment")).toBe(1);
    expect(stepPage(1, "decrement")).toBe(0);
    expect(stepPage(0, "decrement")).toBe(0);
  });
});

describe("selectPages", () => {
  it("returns an empty list and a single feature as is", () => {
    expect(selectPages([])).toEqual([]);
    expect(selectPages([feature("a", 1)])).toEqual([feature("a", 1)]);
  });

  it("keeps the two smallest orders, sorted", () => {
    const names = selectPages([feature("c", 3), feature("a", 1), feature("b", 2)]).map((f) => f.name);
    expect(names).toEqual(["a", "b"]);
  });

  it("keeps the received order on equal order", () => {
    const names = selectPages([feature("x", 1), feature("y", 1), feature("z", 1)]).map((f) => f.name);
    expect(names).toEqual(["x", "y"]);
  });

  it("does not modify its input", () => {
    const input = [feature("b", 2), feature("a", 1), feature("c", 3)];
    selectPages(input);
    expect(input.map((f) => f.name)).toEqual(["b", "a", "c"]);
  });
});

describe("pagerRoot", () => {
  it("returns home, single or pager by feature count", () => {
    expect(pagerRoot([])).toEqual({ kind: "home" });
    expect(pagerRoot([feature("a", 1)])).toEqual({ kind: "single", feature: feature("a", 1) });
    const root = pagerRoot([feature("c", 3), feature("b", 2), feature("a", 1)]);
    expect(root.kind).toBe("pager");
    if (root.kind === "pager") expect(root.pages.map((f) => f.name)).toEqual(["a", "b"]);
  });
});
