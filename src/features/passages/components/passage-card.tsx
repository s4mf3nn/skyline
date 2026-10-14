import { memo } from "react";
import { View } from "react-native";
import { PASSAGES_METRICS, type PassageCard } from "../service";
import { OverheadCard } from "./overhead-card";
import { UpcomingCard } from "./upcoming-card";

interface PassageCardViewProps {
  card: PassageCard;
}

function PassageCardViewBase({ card }: PassageCardViewProps) {
  return (
    <View
      testID={`passage-card-${card.hex}`}
      style={{
        height: PASSAGES_METRICS.cardHeightPt,
        marginHorizontal: PASSAGES_METRICS.marginHorizontalPt,
        borderRadius: PASSAGES_METRICS.cardRadiusPt,
        backgroundColor: card.theme.bg,
        overflow: "hidden",
      }}
    >
      {card.kind === "overhead" ? <OverheadCard card={card} /> : <UpcomingCard card={card} />}
    </View>
  );
}

/** Carte du carrousel : la seule entrée lue par l'écran. */
export const PassageCardView = memo(PassageCardViewBase);
