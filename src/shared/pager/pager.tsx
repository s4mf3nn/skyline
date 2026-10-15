import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Feature, PageName } from "../feature";
import {
  activeAccent,
  dragPosition,
  initialPage,
  initialPresence,
  keepsMounted,
  lockAxis,
  PAGER_LAYOUT,
  PAGER_METRICS,
  PageAccentContext,
  type PageAccents,
  type PageIndex,
  type PagePresence,
  pageAfterPresence,
  pageName,
  restOffset,
  settlePage,
  stepPage,
  stripWidth,
  swipeAllowed,
  withAccent,
} from "./index";
import { PageIndicator } from "./indicator";
import { PresenceProbe } from "./presence-probe";

export interface PagerProps {
  pages: readonly [Feature, Feature];
}

/** Deux écrans côte à côte, glissement horizontal entre eux et indicateur de page. */
export function Pager({ pages }: PagerProps) {
  const { width } = useWindowDimensions();
  const [present, setPresent] = useState<PagePresence>(() => initialPresence(pages));
  const [page, setPage] = useState<PageIndex>(() => initialPage(initialPresence(pages)));
  // Page en cours de retrait : reste montée jusqu'à la fin de la transition.
  const [leaving, setLeaving] = useState<PageIndex | null>(null);
  const [mounted, setMounted] = useState<PagePresence>(present);
  // Faux jusqu'au premier rapport des sondes : la page d'ouverture n'est connue qu'à ce moment.
  const [reported, setReported] = useState<PagePresence>(() => initialPresence(pages));
  const [opened, setOpened] = useState(false);
  const previousPresent = useRef<PagePresence>(present);
  const [accents, setAccents] = useState<PageAccents>([null, null]);

  const offset = useSharedValue(restOffset(page, width));
  const restingPage = useSharedValue<PageIndex>(page);
  const swipeEnabled = useSharedValue(swipeAllowed(present));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    restingPage.value = page;
    offset.value = withTiming(restOffset(page, width), {
      duration: PAGER_METRICS.transitionMs,
      easing: Easing.bezier(...PAGER_METRICS.easing),
    });
  }, [page, width, offset, restingPage]);

  useEffect(() => {
    swipeEnabled.value = swipeAllowed(present);
  }, [present, swipeEnabled]);

  // Ouverture : une fois les sondes rapportées, la bande se place sur la première page présente sans animation.
  useEffect(() => {
    if (opened || !reported[0] || !reported[1]) return;
    const opening = initialPage(present);
    restingPage.value = opening;
    offset.value = restOffset(opening, width);
    setPage(opening);
    setOpened(true);
  }, [opened, reported, present, width, offset, restingPage]);

  // Quand la page affichée disparaît, la bande rejoint l'autre page et l'écran retiré reste monté le temps de la transition.
  useEffect(() => {
    const next = pageAfterPresence(page, present);
    const other: PageIndex = page === 0 ? 1 : 0;
    // Page non affichée dont la présence vient de tomber (glissement déjà fait) : même transition de retrait.
    const droppedAside = next === page && previousPresent.current[other] && !present[other];
    let gone = leaving;
    if (next !== page) {
      gone = page;
      setPage(next);
      setLeaving(page);
    } else if (droppedAside) {
      gone = other;
      setLeaving(other);
    }
    previousPresent.current = present;
    setMounted((current) => [
      keepsMounted(present[0], current[0], gone === 0),
      keepsMounted(present[1], current[1], gone === 1),
    ]);
  }, [present, page, leaving]);

  useEffect(() => {
    if (leaving === null) return;
    const timer = setTimeout(() => setLeaving(null), PAGER_METRICS.transitionMs);
    return () => clearTimeout(timer);
  }, [leaving]);

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
          if (!swipeEnabled.value) return;
          offset.value = dragPosition(restingPage.value, width, event.translationX);
        })
        .onEnd((event) => {
          // Une page a disparu pendant le glissement : retour à la page restante, sans changement de page.
          const target = swipeEnabled.value ? settlePage(restingPage.value, event.translationX) : restingPage.value;
          offset.value = withTiming(restOffset(target, width), {
            duration: PAGER_METRICS.transitionMs,
            easing: Easing.bezier(...PAGER_METRICS.easing),
          });
          if (target !== restingPage.value) scheduleOnRN(setPage, target);
        }),
    [width, offset, restingPage, swipeEnabled, startX, startY],
  );

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const bothMounted = mounted[0] && mounted[1];

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
              mounted={mounted[index === 0 ? 0 : 1]}
              setAccents={setAccents}
            />
          ))}
        </Animated.View>
      </GestureDetector>
      {pages.map((feature, index) =>
        feature.presence === undefined ? null : (
          <PageProbe
            key={feature.name}
            presence={feature.presence}
            displayedPage={pageName(page)}
            index={index === 0 ? 0 : 1}
            setPresent={setPresent}
            setReported={setReported}
          />
        ),
      )}
      {bothMounted ? (
        <PageIndicator
          page={page}
          accent={activeAccent(accents, page, PAGER_LAYOUT.defaultAccent)}
          onStep={(action) => setPage(stepPage(page, action))}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

interface PageSlotProps {
  width: number;
  feature: Feature;
  index: PageIndex;
  mounted: boolean;
  setAccents: Dispatch<SetStateAction<PageAccents>>;
}

function PageSlot({ width, feature, index, mounted, setAccents }: PageSlotProps) {
  // Emplacement stable : un nouvel objet à chaque rendu relancerait l'effet de `usePagerAccent`.
  const slot = useMemo(
    () => ({ setAccent: (color: string | null) => setAccents((current) => withAccent(current, index, color)) }),
    [index, setAccents],
  );
  const Screen = feature.screen;
  // Page absente : emplacement vide de même largeur, les décalages de la bande ne changent pas.
  if (!mounted) return <View style={{ width }} />;
  return (
    <PageAccentContext.Provider value={slot}>
      <Animated.View style={{ width }}>
        <Screen />
      </Animated.View>
    </PageAccentContext.Provider>
  );
}

interface PageProbeProps {
  presence: (displayedPage: PageName) => boolean;
  displayedPage: PageName;
  index: PageIndex;
  setPresent: Dispatch<SetStateAction<PagePresence>>;
  setReported: Dispatch<SetStateAction<PagePresence>>;
}

function PageProbe({ presence, displayedPage, index, setPresent, setReported }: PageProbeProps) {
  const onChange = useCallback(
    (value: boolean) => {
      setPresent((current) => withValue(current, index, value));
      setReported((current) => withValue(current, index, true));
    },
    [index, setPresent, setReported],
  );
  return <PresenceProbe presence={presence} displayedPage={displayedPage} onChange={onChange} />;
}

/** Copie de `current` avec la page `index` à `value` ; la même instance si rien ne change. */
function withValue(current: PagePresence, index: PageIndex, value: boolean): PagePresence {
  if (current[index] === value) return current;
  return index === 0 ? [value, current[1]] : [current[0], value];
}
