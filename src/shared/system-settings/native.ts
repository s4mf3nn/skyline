import { Linking } from "react-native";
import type { SystemSettings } from "./index";

/** Réglages réels, fondés sur `Linking.openSettings()` de React Native. Importé par `main.tsx` seul (module natif). */
export function createLinkingSystemSettings(): SystemSettings {
  return {
    openSettings: () => Linking.openSettings(),
  };
}
