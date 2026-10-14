import { describe, expect, it } from "vitest";
import { DEFAULT_BUILD, scrubContext, scrubMessage, toReport } from "./scrub";

const BUILD = { release: "3f2a9c1", environment: "production" };

describe("scrubMessage", () => {
  it("masks coordinates", () => {
    expect(scrubMessage("near 45.764, -4.8357")).toBe("near [redacted], [redacted]");
  });

  it("leaves a message without coordinate unchanged", () => {
    expect(scrubMessage("took 4.5 s")).toBe("took 4.5 s");
  });
});

describe("scrubContext", () => {
  it("drops unknown keys", () => {
    expect(scrubContext({ feature: "sky", latitude: "45.764" })).toEqual({ feature: "sky" });
  });
});

describe("toReport", () => {
  it("keeps the error name and the allowed context", () => {
    const { error, context } = toReport(new RangeError("boom"), BUILD, "sky");
    expect(error.name).toBe("RangeError");
    expect(error.message).toBe("boom");
    expect(context).toEqual({ release: "3f2a9c1", environment: "production", feature: "sky" });
  });

  it("redacts a coordinate in the message and in the stack", () => {
    const thrown = new Error("at 45.764");
    thrown.stack = "Error: at 45.764\n    at f (lat=4.8357)";
    const { error } = toReport(thrown, BUILD, "sky");
    expect(error.message).toBe("at [redacted]");
    expect(error.stack).toBe("Error: at [redacted]\n    at f (lat=[redacted])");
  });

  it("wraps a thrown value that is not an Error", () => {
    const { error } = toReport("bad 45.764", BUILD, "sky");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("bad [redacted]");
  });

  it("exposes a development default build", () => {
    expect(DEFAULT_BUILD).toEqual({ release: "dev", environment: "development" });
  });
});
