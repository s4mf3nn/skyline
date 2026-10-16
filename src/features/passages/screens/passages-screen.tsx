import type { ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useScene } from "../../../shared/scene";
import { useServices } from "../../../shared/services";
import { StaleNoticeView, StateNoticeView } from "../../../shared/states/notice";
import { openSettingsQuietly } from "../../../shared/system-settings";
import { PassageCardView } from "../components/passage-card";
import { PASSAGES_METRICS, type PassageCard, passagesScreenOf, STALE_NOTICE_TOP_PT } from "../service";

function keyOf(card: PassageCard): string {
  return card.hex;
}

function renderCard({ item }: { item: PassageCard }): ReactElement {
  return <PassageCardView card={item} />;
}

/** Carrousel vertical calé : une carte par avion, ou la notice de l'état d'attente à sa place. */
export function PassagesScreen(): ReactElement {
  const view = useScene();
  const { systemSettings } = useServices();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { cards, notice, stale } = passagesScreenOf(view, timeZone);
  const openSettings = systemSettings === undefined ? undefined : () => openSettingsQuietly(systemSettings);

  return (
    <View style={{ flex: 1 }}>
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
      {notice === null ? null : (
        // La liste reste montée (vide) sous la notice : les contrats de SPEC-0005 la retrouvent dans tous les états.
        <View style={StyleSheet.absoluteFill}>
          <StateNoticeView notice={notice} {...(openSettings === undefined ? {} : { onAction: openSettings })} />
        </View>
      )}
      {stale === null ? null : (
        <View style={{ position: "absolute", top: STALE_NOTICE_TOP_PT, left: 0, right: 0 }}>
          <StaleNoticeView screen="passages" notice={stale} />
        </View>
      )}
    </View>
  );
}
