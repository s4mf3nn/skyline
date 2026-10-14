import { describe, expect, it } from "vitest";
import appConfig, { buildExtra } from "../../app.config";

describe("buildExtra", () => {
  it("uses the GitHub runner variables first", () => {
    const env = {
      GITHUB_SHA: "abc",
      RELEASE_PROFILE: "preview",
      EAS_BUILD_GIT_COMMIT_HASH: "eas",
      EAS_BUILD_PROFILE: "production",
    };
    expect(buildExtra(env)).toEqual({ release: "abc", environment: "preview" });
  });

  it("falls back to the EAS build variables", () => {
    const env = { EAS_BUILD_GIT_COMMIT_HASH: "eas", EAS_BUILD_PROFILE: "production" };
    expect(buildExtra(env)).toEqual({ release: "eas", environment: "production" });
  });

  it("falls back to the development defaults", () => {
    expect(buildExtra({})).toEqual({ release: "dev", environment: "development" });
  });
});

describe("app.config.ts", () => {
  it("adds extra.build without dropping the app.json keys", () => {
    const base = { name: "Skyline", slug: "skyline", extra: { eas: { projectId: "id" } } };
    const config = appConfig({ config: base, projectRoot: ".", staticConfigPath: null, packageJsonPath: null });
    expect(config.extra?.eas).toEqual({ projectId: "id" });
    expect(config.extra?.build).toEqual(buildExtra(process.env));
    expect(config.slug).toBe("skyline");
  });
});
