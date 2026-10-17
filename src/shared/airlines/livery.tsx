import type { ReactElement } from "react";
import { Image, type ImageSourcePropType } from "react-native";
import { hasLivery } from "./livery-rules";
import type { Airline } from "./types";

type LiverySources = Readonly<Record<string, ImageSourcePropType>>;

// Chargement à l'appel : les `require()` d'images de liveries.gen ne sont lisibles que sous Metro et Jest,
// pas sous Vitest, qui importe les écrans via le registre des features.
function liverySources(): LiverySources {
  return (require("./liveries.gen") as { LIVERY_SOURCES: LiverySources }).LIVERY_SOURCES;
}

/** Image de la livrée de la compagnie, ou `null` sans livrée (jamais l'image d'une autre compagnie). */
export function getLiverySource(airline: Airline): ImageSourcePropType | null {
  return hasLivery(airline) ? (liverySources()[airline.code] ?? null) : null;
}

interface AirlineLiveryProps {
  airline: Airline;
  width: number;
  height: number;
  testID: string;
}

/** Livrée réelle de la compagnie ; `null` quand elle n'en a pas (l'appelant dessine alors la dérive générique). */
export function AirlineLivery({ airline, width, height, testID }: AirlineLiveryProps): ReactElement | null {
  const source = getLiverySource(airline);
  if (source === null) return null;
  return (
    <Image
      source={source}
      testID={testID}
      accessibilityLabel={`Livrée ${airline.name}`}
      resizeMode="contain"
      style={{ width, height }}
    />
  );
}
