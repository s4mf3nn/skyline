import { createApp } from "./app";
import { createEmptyAdsbSource } from "./shared/adsb/empty";
import { createSystemClock } from "./shared/clock/system";
import { createExpoLocation } from "./shared/location/expo";
import { createNoopErrorReporter } from "./shared/monitoring/noop";

// Seul fichier qui construit les services réels ; la route `app/index.tsx` le réexporte.
export default createApp({
  services: {
    clock: createSystemClock(),
    location: createExpoLocation(),
    adsb: createEmptyAdsbSource(),
    monitoring: createNoopErrorReporter(),
  },
});
