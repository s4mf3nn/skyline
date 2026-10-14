import { describe, expect, it } from "vitest";
import { scrubEvent } from "./event";

describe("scrubEvent", () => {
  it("removes coordinates from every field that carries text", () => {
    const event = scrubEvent({
      message: "near 45.764, -4.8357",
      exception: { values: [{ value: "failed at 45.7640" }] },
      tags: { screen: "home", position: "45.764" },
      extra: { nested: { latitude: "-4.8357" }, list: ["45.7640"] },
      user: { geo: "45.764" },
      breadcrumbs: [{ message: "moved to 45.764", data: { lng: "-4.8357" } }],
    });
    expect(JSON.stringify(event)).not.toMatch(/\d\.\d{3,}/);
    expect(event.message).toBe("near [redacted], [redacted]");
    expect(event.breadcrumbs?.[0]?.message).toBe("moved to [redacted]");
  });

  it("keeps values that are not coordinates", () => {
    const event = scrubEvent({ message: "took 4.5 s", tags: { screen: "home" }, extra: { count: 3 } });
    expect(event).toEqual({ message: "took 4.5 s", tags: { screen: "home" }, extra: { count: 3 } });
  });

  it("does not modify the original event", () => {
    const original = { message: "45.764" };
    scrubEvent(original);
    expect(original.message).toBe("45.764");
  });

  it("accepts an event without optional fields", () => {
    expect(scrubEvent({})).toEqual({});
  });
});
