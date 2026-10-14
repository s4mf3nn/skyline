import Constants from "expo-constants";
import { createApp } from "./app";
import { createEmptyAdsbSource } from "./shared/adsb/empty";
import { createSystemClock } from "./shared/clock/system";
import { createAppStateLifecycle } from "./shared/lifecycle/app-state";
import { createExpoLocation } from "./shared/location/expo";
import { readBuildInfo } from "./shared/monitoring/build";
import { createSentryErrorReporter } from "./shared/monitoring/sentry";

const build = readBuildInfo(Constants.expoConfig?.extra);

// Seul fichier qui construit les services réels ; la route `app/index.tsx` le réexporte.
export default createApp({
  services: {
    clock: createSystemClock(),
    location: createExpoLocation(),
    adsb: createEmptyAdsbSource(),
    monitoring: createSentryErrorReporter({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, ...build }),
    lifecycle: createAppStateLifecycle(),
  },
  build,
});
