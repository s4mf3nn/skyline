import { describe, expect, it } from "vitest";
import { chooseAdsbSource } from "./select";

describe("chooseAdsbSource", () => {
  it("returns demo only in dev with the exact value", () => {
    expect(chooseAdsbSource({ isDev: true, requested: "demo" })).toBe("demo");
  });

  it("returns real in every other case", () => {
    expect(chooseAdsbSource({ isDev: false, requested: "demo" })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: undefined })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: "DEMO" })).toBe("real");
    expect(chooseAdsbSource({ isDev: true, requested: " demo" })).toBe("real");
  });
});
