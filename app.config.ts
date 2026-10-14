import type { ConfigContext, ExpoConfig } from "expo/config";
import type { BuildInfo } from "./src/shared/monitoring/scrub";

// Valeurs par défaut recopiées de `DEFAULT_BUILD` : le chargeur de config d'Expo ne résout pas les imports de valeurs
// locaux ; `tests/unit/app-config.test.ts` vérifie qu'elles restent égales.
/** Version et environnement livrés : runner GitHub d'abord, chez EAS ensuite, valeurs de développement sinon. */
export function buildExtra(env: Record<string, string | undefined>): BuildInfo {
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
