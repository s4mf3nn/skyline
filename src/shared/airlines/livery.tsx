import type { ReactElement } from "react";
import { Image, type ImageSourcePropType } from "react-native";
import { LIVERY_SOURCES } from "./liveries.gen";
import { hasLivery } from "./livery-rules";
import type { Airline } from "./types";

/** Image de la livrée de la compagnie, ou `null` sans livrée (jamais l'image d'une autre compagnie). */
export function getLiverySource(airline: Airline): ImageSourcePropType | null {
  return hasLivery(airline) ? (LIVERY_SOURCES[airline.code] ?? null) : null;
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
