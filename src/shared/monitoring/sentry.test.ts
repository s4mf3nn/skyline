import * as Sentry from "@sentry/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scrubBreadcrumb, scrubEvent } from "./event";
import { createSentryErrorReporter } from "./sentry";

vi.mock("@sentry/react-native", () => ({ init: vi.fn(), captureException: vi.fn() }));

const BUILD = { release: "3f2a9c1", environment: "production" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSentryErrorReporter without DSN", () => {
  it("does not initialise Sentry and reports nothing", () => {
    const reporter = createSentryErrorReporter({ dsn: undefined, ...BUILD });
    reporter.report(new Error("boom"), { feature: "sky" });
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("treats an empty DSN as missing", () => {
    createSentryErrorReporter({ dsn: "", ...BUILD });
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});

describe("createSentryErrorReporter with DSN", () => {
  it("initialises Sentry without default PII, with release, environment and the filter", () => {
    createSentryErrorReporter({ dsn: "https://public@example.invalid/0", ...BUILD });
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: "https://public@example.invalid/0",
      release: "3f2a9c1",
      environment: "production",
      sendDefaultPii: false,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  });

  it("sends only the allowed context keys as tags", () => {
    const reporter = createSentryErrorReporter({ dsn: "https://public@example.invalid/0", ...BUILD });
    const error = new Error("boom");
    reporter.report(error, { feature: "sky", latitude: "45.764" });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { feature: "sky" } });
  });
});
