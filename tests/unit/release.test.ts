import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Step {
  cmd: string;
  args: string[];
}
interface Release {
  readProfile(env: Record<string, string | undefined>): "preview" | "production";
  releaseSteps(profile: "preview" | "production", sha: string): Step[];
}

const release = (await import(pathToFileURL(path.resolve("scripts/release.mjs")).href)) as Release;

function line(step: Step): string {
  return step.args.join(" ");
}

describe("scripts/release.mjs readProfile", () => {
  it("defaults to preview so nothing is submitted by accident", () => {
    expect(release.readProfile({})).toBe("preview");
  });

  it("accepts production and preview", () => {
    expect(release.readProfile({ RELEASE_PROFILE: "production" })).toBe("production");
    expect(release.readProfile({ RELEASE_PROFILE: "preview" })).toBe("preview");
  });

  it("refuses an unknown profile", () => {
    expect(() => release.readProfile({ RELEASE_PROFILE: "staging" })).toThrow(/Unknown RELEASE_PROFILE/);
  });
});

describe("scripts/release.mjs releaseSteps", () => {
  it("builds with auto-submit and updates the production channel", () => {
    const steps = release.releaseSteps("production", "abc123").map(line);
    expect(steps[0]).toBe("eas build --platform all --profile production --non-interactive --auto-submit");
    expect(steps.find((step) => step.startsWith("eas update"))).toBe(
      "eas update --channel production --message abc123 --skip-bundler --non-interactive",
    );
  });

  it("builds without submission and updates the preview channel", () => {
    const steps = release.releaseSteps("preview", "abc123").map(line);
    expect(steps[0]).toBe("eas build --platform all --profile preview --non-interactive");
    expect(steps[0]).not.toContain("--auto-submit");
    expect(steps.find((step) => step.startsWith("eas update"))).toBe(
      "eas update --channel preview --message abc123 --skip-bundler --non-interactive",
    );
  });

  it("exports the bundle before publishing it with --skip-bundler", () => {
    const steps = release.releaseSteps("production", "abc123").map(line);
    const exportIndex = steps.findIndex((step) => step.startsWith("expo export"));
    const updateIndex = steps.findIndex((step) => step.startsWith("eas update"));
    expect(exportIndex).toBeGreaterThan(-1);
    expect(exportIndex).toBeLessThan(updateIndex);
  });

  it("uploads the sourcemaps and removes them before publishing, then finalizes the release", () => {
    const steps = release.releaseSteps("production", "abc123").map((step) => `${step.cmd} ${line(step)}`);
    const position = (needle: string) => steps.findIndex((step) => step.includes(needle));
    const order = [
      "expo export",
      "releases new abc123",
      "sentry-expo-upload-sourcemaps dist",
      ".map",
      "eas update",
      "releases finalize abc123",
    ].map(position);
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("exports the sourcemaps that the upload step reads", () => {
    const exportStep = release.releaseSteps("preview", "abc123").find((step) => step.args[0] === "expo");
    expect(exportStep?.args).toContain("--source-maps");
  });

  it("never passes a secret as an argument", () => {
    for (const profile of ["preview", "production"] as const) {
      const args = release.releaseSteps(profile, "abc123").flatMap((step) => step.args);
      expect(args.join(" ")).not.toMatch(/token|EXPO_TOKEN|SENTRY_AUTH_TOKEN|DSN/i);
    }
  });
});
