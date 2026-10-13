import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { createApp, type Feature } from "../../src/app";
import { createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0003 (rendu) : parcours de bout en bout par `createApp` et l'accessibilité, avec d'autres
// données que le contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

const CREAM = "#F4F1EA";

interface PagerModule {
  usePagerAccent(color: string | null): void;
}
function usePagerAccent(color: string | null): void {
  jest.requireActual<PagerModule>("../../src/shared/pager").usePagerAccent(color);
}

function fakeServices() {
  return {
    clock: createFakeClock(1_790_000_000_000),
    location: createFakeLocation({ permission: "granted", position: { latitude: 48.8566, longitude: 2.3522 } }),
    adsb: createFakeAdsbSource([]),
    monitoring: createFakeErrorReporter(),
  };
}

// Page qui change d'accent à l'appui sur son bouton, comme Ciel quand l'avion change de compagnie.
function SkyLikeScreen() {
  const [airline, setAirline] = useState<"iberia" | "klm">("iberia");
  usePagerAccent(airline === "iberia" ? "#FADF9A" : "#FFFFFF");
  return (
    <>
      <Text>{`sky shows ${airline}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next aircraft" onPress={() => setAirline("klm")} />
    </>
  );
}

function PassagesLikeScreen() {
  return <Text>passages screen</Text>;
}

function ExtraScreen() {
  return <Text>extra screen</Text>;
}

const pagerElement = () => screen.getByRole("adjustable", { name: "Indicateur de page" });
const move = (name: "increment" | "decrement") =>
  fireEvent(pagerElement(), "accessibilityAction", { nativeEvent: { actionName: name } });
const trait = (index: 0 | 1) => screen.getByTestId(`pager-indicator-trait-${index}`);

async function renderApp(features: readonly Feature[]) {
  const App = createApp({ services: fakeServices(), features });
  await render(<App />);
}

describe("SPEC-0003 hidden scenarios (rendering)", () => {
  it("walks through the two pages while the sky page changes airline in the background", async () => {
    await renderApp([
      { name: "extra", order: 40, screen: ExtraScreen },
      { name: "passages", order: 20, screen: PassagesLikeScreen },
      { name: "sky", order: 10, screen: SkyLikeScreen },
    ]);

    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    expect(screen.getByText("sky shows iberia")).toBeOnTheScreen();
    expect(screen.queryByText("extra screen")).toBeNull();
    expect(trait(0)).toHaveStyle({ backgroundColor: "#FADF9A" });

    await move("increment");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    expect(trait(1)).toHaveStyle({ backgroundColor: CREAM });

    // La page Ciel reste montée : elle change de compagnie sans être affichée, l'accent suit à son retour.
    await fireEvent.press(screen.getByRole("button", { name: "Next aircraft" }));
    expect(trait(1)).toHaveStyle({ backgroundColor: CREAM });
    await move("decrement");
    expect(screen.getByText("sky shows klm")).toBeOnTheScreen();
    expect(trait(0)).toHaveStyle({ backgroundColor: "#FFFFFF" });
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });

  it("ignores repeated movements past the edges and keeps a coherent state", async () => {
    await renderApp([
      { name: "passages", order: 2, screen: PassagesLikeScreen },
      { name: "sky", order: 1, screen: SkyLikeScreen },
    ]);

    await move("decrement");
    await move("decrement");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });

    await move("increment");
    await move("increment");
    await move("increment");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });

    await move("decrement");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    expect(screen.getByText("passages screen")).toBeOnTheScreen();
  });

  it("keeps the registry order between pages of the same order and ignores the extra ones", async () => {
    await renderApp([
      { name: "first", order: 5, screen: PassagesLikeScreen },
      { name: "second", order: 5, screen: SkyLikeScreen },
      { name: "third", order: 5, screen: ExtraScreen },
    ]);
    const texts = screen.getAllByText(/screen|sky shows/).map((element) => element.props.children);
    expect(texts).toEqual(["passages screen", "sky shows iberia"]);
    expect(screen.queryByText("extra screen")).toBeNull();
    // La première page ne déclare aucun accent : crème, malgré l'accent déclaré par la seconde page.
    expect(trait(0)).toHaveStyle({ backgroundColor: CREAM });
    await move("increment");
    expect(trait(1)).toHaveStyle({ backgroundColor: "#FADF9A" });
  });
});
