import type { ReactElement } from "react";
import { Text, View } from "react-native";
import { AirlineLivery, getLiverySource } from "../../../shared/airlines/livery";
import { AirlineTail } from "../../../shared/airlines/tail";
import { usePagerAccent } from "../../../shared/pager";
import { SkyRouteBlock } from "../../../shared/routes/block";
import { useScene } from "../../../shared/scene";
import { staleNotice } from "../../../shared/states";
import { StaleNoticeView } from "../../../shared/states/notice";
import { useShownSky } from "../hooks/use-shown-sky";
import { CIEL_METRICS, type SkyRow, STALE_NOTICE_TOP_PT } from "../service";

/** Écran Ciel : l'avion survolant (ou retenu), sur les couleurs de sa compagnie. */
export function SkyScreen(): ReactElement | null {
  const shown = useShownSky();
  const { state } = useScene();
  usePagerAccent(shown?.view.theme.small ?? null);

  if (shown === null) return null;
  const { view, passage, shownAtMs } = shown;
  const { theme } = view;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stale = staleNotice(state, timeZone);

  const valueText = (row: SkyRow) => (
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
  );

  return (
    <View testID="sky-screen" style={{ flex: 1, backgroundColor: theme.bg, overflow: "hidden" }}>
      <View testID="sky-tail" style={{ position: "absolute", left: CIEL_METRICS.tailLeftPt, bottom: 0 }}>
        {getLiverySource(view.airline) !== null ? (
          <AirlineLivery
            airline={view.airline}
            testID="ciel-livery"
            width={CIEL_METRICS.tailWidthPt}
            height={CIEL_METRICS.tailHeightPt}
          />
        ) : (
          <View testID="ciel-tail">
            <AirlineTail
              palette={view.airline.tail}
              width={CIEL_METRICS.tailWidthPt}
              height={CIEL_METRICS.tailHeightPt}
            />
          </View>
        )}
      </View>
      {stale === null ? null : (
        <View style={{ position: "absolute", top: STALE_NOTICE_TOP_PT, left: 0, right: 0 }}>
          <StaleNoticeView screen="ciel" notice={stale} color={theme.small} />
        </View>
      )}
      <SkyRouteBlock passage={passage} nowMs={shownAtMs} theme={theme} />
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
            {row.key === "aircraft" ? <View testID="ciel-aircraft-type">{valueText(row)}</View> : valueText(row)}
          </View>
        ))}
      </View>
    </View>
  );
}
