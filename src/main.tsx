import Constants from "expo-constants";
import { createApp } from "./app";
import { createAdsbLolSource } from "./shared/adsb/adsblol";
import { createDemoAdsbSource } from "./shared/adsb/demo";
import { chooseAdsbSource } from "./shared/adsb/select";
import { createSystemClock } from "./shared/clock/system";
import { createAppStateLifecycle } from "./shared/lifecycle/app-state";
import { createExpoLocation } from "./shared/location/expo";
import { readBuildInfo } from "./shared/monitoring/build";
import { createSentryErrorReporter } from "./shared/monitoring/sentry";
import { createLinkingSystemSettings } from "./shared/system-settings/native";

const build = readBuildInfo(Constants.expoConfig?.extra);
// La même horloge sert à la source de démonstration et à l'application.
const clock = createSystemClock();
const adsbSource = chooseAdsbSource({
  isDev: __DEV__,
  requested: process.env.EXPO_PUBLIC_ADSB_SOURCE,
});

// Seul fichier qui construit les services réels ; la route `app/index.tsx` le réexporte.
export default createApp({
  services: {
    clock,
    location: createExpoLocation(),
    // La démonstration ne sert qu'en développement et sur demande : jamais dans un build livré.
    adsb: adsbSource === "demo" ? createDemoAdsbSource(clock) : createAdsbLolSource({ fetch }),
    monitoring: createSentryErrorReporter({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, ...build }),
    lifecycle: createAppStateLifecycle(),
    systemSettings: createLinkingSystemSettings(),
  },
  build,
});
