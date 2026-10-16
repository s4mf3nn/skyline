import type { ReactElement } from "react";
import { Text, View } from "react-native";
import type { AirlineTheme } from "../airlines";
import { formatRouteCities, formatRouteCodes } from "./estimate";
import { useFlightInfo } from "./hooks";

interface RouteBlockProps {
  hex: string;
  callsign: string | null;
  theme: AirlineTheme;
}

/** Bloc route des cartes : codes empilés puis villes, chaque ligne seulement si elle est complète ; rien sans route. */
export function RouteBlock({ hex, callsign, theme }: RouteBlockProps): ReactElement | null {
  const { route } = useFlightInfo(hex, callsign);
  if (route === null) return null;
  const codes = formatRouteCodes(route);
  const cities = formatRouteCities(route);
  if (codes === null && cities === null) return null;

  return (
    <View
      testID={`passage-route-${hex}`}
      style={{ position: "absolute", right: 22, bottom: 90, alignItems: "flex-end" }}
    >
      {codes === null ? null : (
        <>
          <Text className="font-archivo" style={{ color: theme.big, fontSize: 64, fontWeight: "800", lineHeight: 58 }}>
            {codes.origin}
          </Text>
          <Text className="font-archivo" style={{ color: theme.big, fontSize: 64, fontWeight: "800", lineHeight: 58 }}>
            {codes.destination}
          </Text>
        </>
      )}
      {cities === null ? null : (
        <Text
          numberOfLines={1}
          className="font-archivo"
          style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}
        >
          {cities}
        </Text>
      )}
    </View>
  );
}
