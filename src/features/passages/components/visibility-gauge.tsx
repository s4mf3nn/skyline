import { memo } from "react";
import { View } from "react-native";
import type { AirlineTheme } from "../../../shared/airlines";
import { gaugePercent } from "../service";

const GAUGE_HEIGHT_PT = 8;
const GAUGE_RADIUS_PT = 4;
const GAUGE_MAX = 100;

interface VisibilityGaugeProps {
  progress: number;
  theme: AirlineTheme;
}

function VisibilityGaugeView({ progress, theme }: VisibilityGaugeProps) {
  const percent = gaugePercent(progress);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Visibilité"
      accessibilityValue={{ min: 0, max: GAUGE_MAX, now: percent }}
      style={{
        height: GAUGE_HEIGHT_PT,
        borderRadius: GAUGE_RADIUS_PT,
        backgroundColor: theme.track,
        overflow: "hidden",
      }}
    >
      <View style={{ width: `${percent}%`, height: GAUGE_HEIGHT_PT, backgroundColor: theme.big }} />
    </View>
  );
}

// Le thème est recréé à chaque tick : on compare ses couleurs, pas sa référence.
function samePropsIgnoringThemeIdentity(previous: VisibilityGaugeProps, next: VisibilityGaugeProps): boolean {
  return (
    previous.progress === next.progress &&
    previous.theme.track === next.theme.track &&
    previous.theme.big === next.theme.big
  );
}

export const VisibilityGauge = memo(VisibilityGaugeView, samePropsIgnoringThemeIdentity);
