import * as Location from "expo-location";
import { AppError } from "../errors";
import type { LocationPermission, LocationService } from "./index";

// `trueHeading` vaut -1 quand le cap vrai est indisponible : on prend alors le cap magnétique.
const TRUE_HEADING_UNAVAILABLE = -1;

function toPermission(response: Location.LocationPermissionResponse): LocationPermission {
  return response.status === Location.PermissionStatus.GRANTED ? "granted" : "denied";
}

/** Localisation réelle « pendant l'utilisation », importée par `src/main.tsx` seulement. */
export function createExpoLocation(): LocationService {
  return {
    async requestPermission() {
      return toPermission(await Location.requestForegroundPermissionsAsync());
    },

    async getPosition() {
      // Lecture de l'état sans déclencher la demande : seule `requestPermission` la déclenche.
      const permission = toPermission(await Location.getForegroundPermissionsAsync());
      if (permission !== "granted") {
        throw new AppError("LOCATION_DENIED", "Location permission denied");
      }
      const { coords } = await Location.getCurrentPositionAsync();
      return { latitude: coords.latitude, longitude: coords.longitude };
    },

    watchHeading(onHeading) {
      let active = true;
      let subscription: Location.LocationSubscription | undefined;

      // L'abonnement est asynchrone alors que le désabonnement est synchrone : si on se désabonne avant
      // la résolution, l'abonnement est retiré dès qu'il arrive.
      Location.watchHeadingAsync((heading) => {
        if (!active) return;
        const degrees = heading.trueHeading === TRUE_HEADING_UNAVAILABLE ? heading.magHeading : heading.trueHeading;
        onHeading(degrees);
      }).then(
        (created) => {
          if (active) subscription = created;
          else created.remove();
        },
        () => {
          // Permission refusée ou capteur absent : aucune valeur n'est transmise, pas de rejet non attrapé.
          active = false;
        },
      );

      return () => {
        active = false;
        subscription?.remove();
        subscription = undefined;
      };
    },
  };
}
