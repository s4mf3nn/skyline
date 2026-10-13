import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { createApp, type Feature } from "../../src/app";
import { createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0003, partie rendu (Jest) : le pager monté par `createApp`, sa valeur accessible et son indicateur.
// Le geste de glissement lui-même (Gesture Handler) n'est pas rejoué ici : sa logique l'est dans SPEC-0003.test.ts.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

const CREAM = "#F4F1EA";

// Module posé par cette spec : chargé à l'appel (donc seulement quand les tests tournent), types du contrat recopiés ici.
interface PagerModule {
  usePagerAccent(color: string | null): void;
}
function usePagerAccent(color: string | null): void {
  jest.requireActual<PagerModule>("../../src/shared/pager").usePagerAccent(color);
}

function fakeServices() {
  return {
    clock: createFakeClock(1_760_000_000_000),
    location: createFakeLocation({ permission: "granted", position: { latitude: 45.764, longitude: 4.8357 } }),
    adsb: createFakeAdsbSource([]),
    monitoring: createFakeErrorReporter(),
  };
}

function textScreen(label: string) {
  return function TextScreen() {
    return <Text>{label}</Text>;
  };
}

function accentScreen(label: string, color: string | null) {
  return function AccentScreen() {
    usePagerAccent(color);
    return <Text>{label}</Text>;
  };
}

// Écran dont l'accent change pendant qu'il est affiché, comme Ciel quand l'avion survolant change de compagnie.
function ChangingAccentScreen() {
  const [color, setColor] = useState<string | null>("#F6C344");
  usePagerAccent(color);
  return (
    <>
      <Text>changing screen</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Change accent" onPress={() => setColor("#0B1F4B")} />
      <Pressable accessibilityRole="button" accessibilityLabel="Reset accent" onPress={() => setColor(null)} />
    </>
  );
}

// Écran qui garde un état local : il prouve que changer de page ne le démonte pas.
function CounterScreen() {
  const [count, setCount] = useState(0);
  return (
    <>
      <Text>{`count ${count}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Count" onPress={() => setCount(count + 1)} />
    </>
  );
}

function feature(name: string, order: number, screenComponent: Feature["screen"]): Feature {
  return { name, order, screen: screenComponent };
}

async function renderApp(features: readonly Feature[]) {
  const App = createApp({ services: fakeServices(), features });
  await render(<App />);
}

const pagerElement = () => screen.getByRole("adjustable", { name: "Indicateur de page" });
const fireAccessibilityAction = (name: "increment" | "decrement") =>
  fireEvent(pagerElement(), "accessibilityAction", { nativeEvent: { actionName: name } });
const trait = (index: 0 | 1) => screen.getByTestId(`pager-indicator-trait-${index}`);

describe.skip("SPEC-0003 pager (rendering)", () => {
  it("CA7 : mounts the screens of the two first features side by side, by increasing order", async () => {
    await renderApp([
      feature("passages", 2, textScreen("screen passages")),
      feature("sky", 1, textScreen("screen sky")),
    ]);
    const texts = screen.getAllByText(/^screen /).map((element) => element.props.children);
    expect(texts).toEqual(["screen sky", "screen passages"]);
    expect(screen.queryByText("Skyline")).toBeNull();
  });

  it("CA7 : opens on the first page", async () => {
    await renderApp([
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });

  it("CA7 : opens on the first page at every mount, the current page is never persisted", async () => {
    const features = [
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ];
    await renderApp(features);
    await fireAccessibilityAction("increment");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    await screen.unmount();

    await renderApp(features);
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });

  it("CA7 : does not mount a third feature", async () => {
    await renderApp([
      feature("later", 9, textScreen("screen later")),
      feature("passages", 2, textScreen("screen passages")),
      feature("sky", 1, textScreen("screen sky")),
    ]);
    expect(screen.getByText("screen sky")).toBeOnTheScreen();
    expect(screen.getByText("screen passages")).toBeOnTheScreen();
    expect(screen.queryByText("screen later")).toBeNull();
  });

  it("CA8 : renders a single feature alone, with neither pager nor indicator", async () => {
    await renderApp([feature("sky", 1, textScreen("screen sky"))]);
    expect(screen.getByText("screen sky")).toBeOnTheScreen();
    expect(screen.queryByRole("adjustable", { name: "Indicateur de page" })).toBeNull();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
  });

  it("CA8 : renders the home screen without any feature", async () => {
    await renderApp([]);
    expect(screen.getByText("Skyline")).toBeOnTheScreen();
    expect(screen.queryByRole("adjustable", { name: "Indicateur de page" })).toBeNull();
  });

  it("CA9 : moves to the next page, then back to the previous one, with the accessibility actions", async () => {
    await renderApp([
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    await fireAccessibilityAction("increment");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    await fireAccessibilityAction("decrement");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });

  it("CA9 : stays on the first page on `decrement` and on the last page on `increment`", async () => {
    await renderApp([
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    await fireAccessibilityAction("decrement");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    await fireAccessibilityAction("increment");
    await fireAccessibilityAction("increment");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
  });

  it("CA9 : keeps both screens mounted when the page changes", async () => {
    await renderApp([
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    await fireAccessibilityAction("increment");
    expect(screen.getByText("screen sky")).toBeOnTheScreen();
    expect(screen.getByText("screen passages")).toBeOnTheScreen();
  });

  it("CA9 : does not unmount a screen when the page changes, its local state survives", async () => {
    await renderApp([feature("sky", 1, CounterScreen), feature("passages", 2, textScreen("screen passages"))]);
    await fireEvent.press(screen.getByRole("button", { name: "Count" }));
    expect(screen.getByText("count 1")).toBeOnTheScreen();

    await fireAccessibilityAction("increment");
    await fireAccessibilityAction("decrement");
    expect(screen.getByText("count 1")).toBeOnTheScreen();
  });

  it("CA9 : keeps the screens of the pages accessible apart from the indicator", async () => {
    await renderApp([feature("sky", 1, CounterScreen), feature("passages", 2, textScreen("screen passages"))]);
    expect(screen.getByRole("button", { name: "Count" })).toBeOnTheScreen();
    expect(screen.getByRole("adjustable", { name: "Indicateur de page" })).toBeOnTheScreen();
  });

  it("CA10 : sizes the traits as indicatorTraits does for the active page", async () => {
    await renderApp([
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    expect(trait(0)).toHaveStyle({ width: 18, height: 4, opacity: 1 });
    expect(trait(1)).toHaveStyle({ width: 6, height: 4, opacity: 0.4 });

    await fireAccessibilityAction("increment");
    expect(trait(0)).toHaveStyle({ width: 6, height: 4, opacity: 0.4 });
    expect(trait(1)).toHaveStyle({ width: 18, height: 4, opacity: 1 });
  });

  it("CA10 : names the indicator and gives it two traits in the cream accent by default", async () => {
    await renderApp([
      feature("sky", 1, textScreen("screen sky")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    expect(screen.getByLabelText("Indicateur de page")).toBeOnTheScreen();
    expect(trait(0)).toHaveStyle({ backgroundColor: CREAM });
    expect(trait(1)).toHaveStyle({ backgroundColor: CREAM });
  });

  it("CA10 : colors the traits with the accent of the active page", async () => {
    await renderApp([
      feature("sky", 1, accentScreen("screen sky", "#F6C344")),
      feature("passages", 2, textScreen("screen passages")),
    ]);
    expect(trait(0)).toHaveStyle({ backgroundColor: "#F6C344" });
    expect(trait(1)).toHaveStyle({ backgroundColor: "#F6C344" });

    await fireAccessibilityAction("increment");
    expect(trait(0)).toHaveStyle({ backgroundColor: CREAM });
    expect(trait(1)).toHaveStyle({ backgroundColor: CREAM });

    await fireAccessibilityAction("decrement");
    expect(trait(0)).toHaveStyle({ backgroundColor: "#F6C344" });
  });

  it("CA10 : takes the accent declared by the second page when it is the active one", async () => {
    await renderApp([
      feature("sky", 1, accentScreen("screen sky", "#0B1F4B")),
      feature("passages", 2, accentScreen("screen passages", "#FF6600")),
    ]);
    await fireAccessibilityAction("increment");
    expect(trait(1)).toHaveStyle({ backgroundColor: "#FF6600" });
  });

  it("CA10 : follows an accent that changes while the page is displayed, and goes back to cream on null", async () => {
    await renderApp([feature("sky", 1, ChangingAccentScreen), feature("passages", 2, textScreen("screen passages"))]);
    expect(trait(0)).toHaveStyle({ backgroundColor: "#F6C344" });

    await fireEvent.press(screen.getByRole("button", { name: "Change accent" }));
    expect(trait(0)).toHaveStyle({ backgroundColor: "#0B1F4B" });

    await fireEvent.press(screen.getByRole("button", { name: "Reset accent" }));
    expect(trait(0)).toHaveStyle({ backgroundColor: CREAM });
  });

  it("CA10 : ignores the accent hook outside the pager, without error", async () => {
    await renderApp([feature("sky", 1, accentScreen("screen sky", "#F6C344"))]);
    expect(screen.getByText("screen sky")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
  });
});
