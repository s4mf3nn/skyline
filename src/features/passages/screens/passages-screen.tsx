import type { ReactElement } from "react";
import { FlatList } from "react-native";
import { useScene } from "../../../shared/scene";
import { PassageCardView } from "../components/passage-card";
import { cardsOf, PASSAGES_METRICS, type PassageCard } from "../service";

function keyOf(card: PassageCard): string {
  return card.hex;
}

function renderCard({ item }: { item: PassageCard }): ReactElement {
  return <PassageCardView card={item} />;
}

/** Carrousel vertical calé : une carte par avion, la scène et l'heure viennent de `useScene`. */
export function PassagesScreen(): ReactElement {
  const view = useScene();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cards = cardsOf(view, timeZone);

  return (
    <FlatList
      testID="passages-list"
      data={cards}
      keyExtractor={keyOf}
      renderItem={renderCard}
      snapToInterval={PASSAGES_METRICS.snapIntervalPt}
      decelerationRate="fast"
      disableIntervalMomentum
      contentContainerStyle={{
        paddingTop: PASSAGES_METRICS.paddingTopPt,
        paddingBottom: PASSAGES_METRICS.paddingBottomPt,
      }}
    />
  );
}
