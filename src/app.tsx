import type { ComponentType } from "react";
import { features as registry } from "./features.gen";
import { HomeScreen } from "./HomeScreen";
import { guardFeatures, guardScreen } from "./ScreenGuard";
import type { Feature } from "./shared/feature";
import { type BuildInfo, DEFAULT_BUILD } from "./shared/monitoring";
import { type PagerRoot, pagerRoot } from "./shared/pager";
import { Pager } from "./shared/pager/pager";
import { type AppServices, ServicesProvider } from "./shared/services";

export type { Feature } from "./shared/feature";
export type { AppServices } from "./shared/services";

export interface AppOptions {
  services: AppServices;
  /** Registre des features ; celui de `src/features.gen.ts` par défaut. */
  features?: readonly Feature[];
  /** Version et environnement joints aux erreurs transmises ; `DEFAULT_BUILD` par défaut. */
  build?: BuildInfo;
}

/** Construit le composant racine : les services sont donnés par l'appelant, jamais lus dans un module global. */
export function createApp({ services, features, build }: AppOptions): ComponentType {
  const buildInfo = build ?? DEFAULT_BUILD;
  // Chaque écran est gardé avant la sélection : la sélection n'a rien à savoir du suivi des erreurs.
  const root = pagerRoot(guardFeatures(features ?? registry, buildInfo));
  const Screen = rootScreen(root, buildInfo);
  return function App() {
    return (
      <ServicesProvider services={services}>
        <Screen />
      </ServicesProvider>
    );
  };
}

/** Écran racine selon le nombre de features : accueil, écran seul ou pager à deux pages. */
function rootScreen(root: PagerRoot, build: BuildInfo): ComponentType {
  if (root.kind === "home") return guardScreen(HomeScreen, "home", build);
  if (root.kind === "single") return root.feature.screen;
  const pages = root.pages;
  return function PagedApp() {
    return <Pager pages={pages} />;
  };
}
