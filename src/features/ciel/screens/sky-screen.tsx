import type { ReactElement } from "react";
import { Text, View } from "react-native";
import { AirlineTail } from "../../../shared/airlines/tail";
import { usePagerAccent } from "../../../shared/pager";
import { useScene } from "../../../shared/scene";
import { staleNotice } from "../../../shared/states";
import { StaleNoticeView } from "../../../shared/states/notice";
import { useShownSky } from "../hooks/use-shown-sky";
import { CIEL_METRICS, STALE_NOTICE_TOP_PT } from "../service";

/** Écran Ciel : l'avion survolant (ou retenu), sur les couleurs de sa compagnie. */
export function SkyScreen(): ReactElement | null {
  const view = useShownSky();
  const { state } = useScene();
  usePagerAccent(view?.theme.small ?? null);

  if (view === null) return null;
  const { theme } = view;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stale = staleNotice(state, timeZone);

  return (
    <View testID="sky-screen" style={{ flex: 1, backgroundColor: theme.bg, overflow: "hidden" }}>
      <View testID="sky-tail" style={{ position: "absolute", left: CIEL_METRICS.tailLeftPt, bottom: 0 }}>
        <AirlineTail palette={view.airline.tail} width={CIEL_METRICS.tailWidthPt} height={CIEL_METRICS.tailHeightPt} />
      </View>
      {stale === null ? null : (
        <View style={{ position: "absolute", top: STALE_NOTICE_TOP_PT, left: 0, right: 0 }}>
          <StaleNoticeView screen="ciel" notice={stale} color={theme.small} />
        </View>
      )}
      <View
        style={{
          position: "absolute",
          right: CIEL_METRICS.infoColumnRightPt,
          top: CIEL_METRICS.infoColumnTopPt,
          alignItems: "flex-end",
          gap: CIEL_METRICS.infoColumnGapPt,
        }}
      >
        {view.rows.map((row) => (
          <View key={row.key} style={{ alignItems: "flex-end" }}>
            <Text
              testID={`sky-label-${row.key}`}
              className="font-archivo"
              style={{
                color: theme.big,
                opacity: CIEL_METRICS.labelOpacity,
                fontSize: CIEL_METRICS.labelSizePt,
                fontWeight: "700",
              }}
            >
              {row.label}
            </Text>
            <Text
              testID={`sky-value-${row.key}`}
              numberOfLines={1}
              className="font-archivo"
              style={{
                color: theme.big,
                fontSize: CIEL_METRICS.valueSizePt,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
