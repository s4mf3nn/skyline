import { View } from "react-native";
import Animated from "react-native-reanimated";
import { indicatorTraits, PAGER_LAYOUT, PAGER_METRICS, type PageIndex, pageValueText, traitRadius } from "./index";

export interface PageIndicatorProps {
  page: PageIndex;
  /** Couleur `#RRGGBB` du trait de la page active, appliquée telle quelle. */
  accent: string;
  onStep(action: "increment" | "decrement"): void;
}

/** Les deux traits du pager : un seul élément accessible, réglable, distinct des pages. */
export function PageIndicator({ page, accent, onStep }: PageIndicatorProps) {
  const traits = indicatorTraits(page);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Indicateur de page"
      accessibilityValue={{ text: pageValueText(page) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName;
        if (action === "increment" || action === "decrement") onStep(action);
      }}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: PAGER_LAYOUT.indicatorTopPt,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: PAGER_LAYOUT.indicatorGapPt,
      }}
    >
      {traits.map((trait, index) => (
        <Animated.View
          // Deux traits fixes, jamais réordonnés : l'index est une clé stable.
          key={index === 0 ? "first" : "second"}
          testID={`pager-indicator-trait-${index}`}
          style={{
            width: trait.width,
            height: trait.height,
            opacity: trait.opacity,
            borderRadius: traitRadius(trait),
            backgroundColor: accent,
            transitionProperty: ["width", "opacity", "backgroundColor"],
            transitionDuration: PAGER_METRICS.indicatorTransitionMs,
          }}
        />
      ))}
    </View>
  );
}
