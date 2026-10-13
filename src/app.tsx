import type { ComponentType } from "react";
import { features as registry } from "./features.gen";
import { HomeScreen } from "./HomeScreen";
import { type Feature, pickScreen } from "./shared/feature";
import { type AppServices, ServicesProvider } from "./shared/services";

export type { Feature } from "./shared/feature";
export type { AppServices } from "./shared/services";

export interface AppOptions {
  services: AppServices;
  /** Registre des features ; celui de `src/features.gen.ts` par défaut. */
  features?: readonly Feature[];
}

/** Construit le composant racine : les services sont donnés par l'appelant, jamais lus dans un module global. */
export function createApp({ services, features }: AppOptions): ComponentType {
  const Screen = pickScreen(features ?? registry, HomeScreen);
  return function App() {
    return (
      <ServicesProvider services={services}>
        <Screen />
      </ServicesProvider>
    );
  };
}
