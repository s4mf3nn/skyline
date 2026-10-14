import { memo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

const ARROW_SIZE_PT = 36;
// Flèche pleine pointant vers le haut : la rotation l'oriente vers l'avion.
const ARROW_PATH = "M 18 2 L 32 32 L 18 25 L 4 32 Z";

interface DirectionArrowProps {
  hex: string;
  /** Angle en degrés ; `null` tant que le cap du téléphone est inconnu. */
  angleDeg: number | null;
  color: string;
}

function DirectionArrowView({ hex, angleDeg, color }: DirectionArrowProps) {
  if (angleDeg === null) {
    return null;
  }
  // Décorative : le point cardinal affiché à côté porte l'information.
  return (
    <View
      testID={`passage-arrow-${hex}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: ARROW_SIZE_PT, height: ARROW_SIZE_PT, transform: [{ rotate: `${angleDeg}deg` }] }}
    >
      <Svg viewBox="0 0 36 36" width={ARROW_SIZE_PT} height={ARROW_SIZE_PT}>
        <Path d={ARROW_PATH} fill={color} />
      </Svg>
    </View>
  );
}

export const DirectionArrow = memo(DirectionArrowView);
