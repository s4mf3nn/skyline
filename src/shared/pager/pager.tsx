import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Feature } from "../feature";
import {
  activeAccent,
  dragPosition,
  lockAxis,
  PAGER_LAYOUT,
  PAGER_METRICS,
  PageAccentContext,
  type PageAccents,
  type PageIndex,
  restOffset,
  settlePage,
  stepPage,
  stripWidth,
  withAccent,
} from "./index";
import { PageIndicator } from "./indicator";

export interface PagerProps {
  pages: readonly [Feature, Feature];
}

/** Deux écrans côte à côte, glissement horizontal entre eux et indicateur de page. */
export function Pager({ pages }: PagerProps) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState<PageIndex>(0);
  const [accents, setAccents] = useState<PageAccents>([null, null]);

  const offset = useSharedValue(restOffset(0, width));
  const restingPage = useSharedValue<PageIndex>(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    restingPage.value = page;
    offset.value = withTiming(restOffset(page, width), {
      duration: PAGER_METRICS.transitionMs,
      easing: Easing.bezier(...PAGER_METRICS.easing),
    });
  }, [page, width, offset, restingPage]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId("pager-pan")
        .manualActivation(true)
        .onTouchesDown((event) => {
          const touch = event.allTouches[0];
          if (touch === undefined) return;
          startX.value = touch.absoluteX;
          startY.value = touch.absoluteY;
        })
        .onTouchesMove((event, state) => {
          const touch = event.allTouches[0];
          if (touch === undefined) return;
          const axis = lockAxis(touch.absoluteX - startX.value, touch.absoluteY - startY.value);
          if (axis === "horizontal") state.activate();
          if (axis === "vertical") state.fail();
        })
        .onUpdate((event) => {
          offset.value = dragPosition(restingPage.value, width, event.translationX);
        })
        .onEnd((event) => {
          const target = settlePage(restingPage.value, event.translationX);
          offset.value = withTiming(restOffset(target, width), {
            duration: PAGER_METRICS.transitionMs,
            easing: Easing.bezier(...PAGER_METRICS.easing),
          });
          if (target !== restingPage.value) scheduleOnRN(setPage, target);
        }),
    [width, offset, restingPage, startX, startY],
  );

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1, flexDirection: "row", width: stripWidth(width) }, stripStyle]}>
          {pages.map((feature, index) => (
            <PageSlot
              key={feature.name}
              width={width}
              feature={feature}
              index={index === 0 ? 0 : 1}
              setAccents={setAccents}
            />
          ))}
        </Animated.View>
      </GestureDetector>
      <PageIndicator
        page={page}
        accent={activeAccent(accents, page, PAGER_LAYOUT.defaultAccent)}
        onStep={(action) => setPage(stepPage(page, action))}
      />
    </GestureHandlerRootView>
  );
}

interface PageSlotProps {
  width: number;
  feature: Feature;
  index: PageIndex;
  setAccents: Dispatch<SetStateAction<PageAccents>>;
}

function PageSlot({ width, feature, index, setAccents }: PageSlotProps) {
  // Emplacement stable : un nouvel objet à chaque rendu relancerait l'effet de `usePagerAccent`.
  const slot = useMemo(
    () => ({ setAccent: (color: string | null) => setAccents((current) => withAccent(current, index, color)) }),
    [index, setAccents],
  );
  const Screen = feature.screen;
  return (
    <PageAccentContext.Provider value={slot}>
      <Animated.View style={{ width }}>
        <Screen />
      </Animated.View>
    </PageAccentContext.Provider>
  );
}
