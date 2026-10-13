import { describe, expect, it } from "vitest";
import { createFakeErrorReporter } from "./index";
import { createNoopErrorReporter } from "./noop";

describe("fake error reporter", () => {
  it("keeps every reported event with its context, `{}` by default", () => {
    const monitoring = createFakeErrorReporter();
    const failure = new TypeError("boom");
    monitoring.report(failure, { screen: "home" });
    monitoring.report("plain failure");
    expect(monitoring.events).toEqual([
      { error: failure, context: { screen: "home" } },
      { error: "plain failure", context: {} },
    ]);
  });
});

describe("noop error reporter", () => {
  it("accepts a report without throwing", () => {
    expect(() => createNoopErrorReporter().report(new Error("boom"), { screen: "home" })).not.toThrow();
  });
});
