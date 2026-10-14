import type { ConfigContext, ExpoConfig } from "expo/config";

interface BuildExtra {
  release: string;
  environment: string;
}

/** Version et environnement livrés : runner GitHub d'abord, chez EAS ensuite, valeurs de développement sinon. */
export function buildExtra(env: Record<string, string | undefined>): BuildExtra {
  return {
    release: env.GITHUB_SHA ?? env.EAS_BUILD_GIT_COMMIT_HASH ?? "dev",
    environment: env.RELEASE_PROFILE ?? env.EAS_BUILD_PROFILE ?? "development",
  };
}

// Étend app.json : seule `extra.build` est calculée, le reste du fichier est conservé.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Skyline",
  slug: config.slug ?? "skyline",
  extra: { ...config.extra, build: buildExtra(process.env) },
});
