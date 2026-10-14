import { type BuildInfo, DEFAULT_BUILD } from "./scrub";

/** Lit `expoConfig.extra` : le bloc `build` est validé ici, à la frontière ; invalide ou absent, on prend le défaut. */
export function readBuildInfo(extra: unknown): BuildInfo {
  if (typeof extra !== "object" || extra === null) return DEFAULT_BUILD;
  const build = (extra as Record<string, unknown>).build;
  if (typeof build !== "object" || build === null) return DEFAULT_BUILD;
  const { release, environment } = build as Record<string, unknown>;
  if (typeof release !== "string" || release === "") return DEFAULT_BUILD;
  if (typeof environment !== "string" || environment === "") return DEFAULT_BUILD;
  return { release, environment };
}
