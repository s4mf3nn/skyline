import type { ReactElement } from "react";
import { Text, View } from "react-native";
import type { AirlineTheme } from "../airlines";
import type { Passage } from "../scene";
import { formatRouteCities, formatRouteCodes, skyRouteView } from "./estimate";
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

interface SkyRouteBlockProps {
  passage: Passage;
  /** Heure de scène à laquelle la position de `passage` a été calculée. */
  nowMs: number;
  theme: AirlineTheme;
}

/** Bloc route de Ciel : codes, villes, heures puis barre de progression, chaque partie seulement si elle est connue. */
export function SkyRouteBlock({ passage, nowMs, theme }: SkyRouteBlockProps): ReactElement | null {
  const { route } = useFlightInfo(passage.hex, passage.callsign);
  if (route === null) return null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const view = skyRouteView({
    route,
    position: passage,
    groundSpeedKmh: passage.groundSpeedKmh,
    nowMs,
    timeZone,
  });

  return (
    <View style={{ position: "absolute", right: 24, top: 140, left: 24, alignItems: "flex-end" }}>
      {view.codes === null ? null : (
        <Text
          testID="ciel-route-codes"
          className="font-archivo"
          style={{ color: theme.big, fontSize: 64, fontWeight: "800", lineHeight: 58, textAlign: "right" }}
        >
          {`${view.codes.origin}\n${view.codes.destination}`}
        </Text>
      )}
      {view.cities === null ? null : (
        <Text
          testID="ciel-route-cities"
          numberOfLines={1}
          className="font-archivo"
          style={{ color: theme.small, fontSize: 13, fontWeight: "700" }}
        >
          {view.cities}
        </Text>
      )}
      {view.arrival === null ? null : (
        <View testID="ciel-route-times" style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          <Text
            testID="ciel-route-departure"
            className="font-archivo"
            style={{ color: theme.small, fontSize: 16, fontWeight: "700" }}
          >
            —
          </Text>
          <Text
            testID="ciel-route-arrival"
            className="font-archivo"
            style={{ color: theme.small, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}
          >
            {view.arrival}
          </Text>
        </View>
      )}
      {view.progressPercent === null ? null : (
        <View
          testID="ciel-route-progress"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Progression du vol"
          accessibilityValue={{ min: 0, max: 100, now: view.progressPercent }}
          style={{
            marginTop: 8,
            width: "100%",
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.small,
            opacity: 0.35,
          }}
        >
          <View
            style={{
              width: `${view.progressPercent}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.big,
            }}
          />
        </View>
      )}
    </View>
  );
}
