import { describe, expect, it } from "vitest";
import { readBuildInfo } from "./build";
import { DEFAULT_BUILD } from "./scrub";

describe("readBuildInfo", () => {
  it("reads release and environment from extra.build", () => {
    const extra = { build: { release: "3f2a9c1", environment: "production" } };
    expect(readBuildInfo(extra)).toEqual({ release: "3f2a9c1", environment: "production" });
  });

  it.each([
    ["undefined extra", undefined],
    ["null extra", null],
    ["missing build", {}],
    ["build that is not an object", { build: "3f2a9c1" }],
    ["missing environment", { build: { release: "3f2a9c1" } }],
    ["release that is not a string", { build: { release: 3, environment: "production" } }],
    ["empty release", { build: { release: "", environment: "production" } }],
  ])("falls back to the default for %s", (_name, extra) => {
    expect(readBuildInfo(extra)).toEqual(DEFAULT_BUILD);
  });
});
