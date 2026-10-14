import { render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { Passage, Scene } from "../../../shared/scene";
import { buildCards, gaugePercent, type PassageCard } from "../service";
import { PassageCardView } from "./passage-card";

const NOW = 1_800_000_000_000;

function passage(hex: string, overrides: Partial<Passage> = {}): Passage {
  return {
    hex,
    callsign: "AFR1506",
    altitudeM: 7850,
    groundSpeedKmh: 720,
    trackDeg: 90,
    trackCardinal: "E",
    arrivalBearingDeg: 270,
    arrivalCardinal: "O",
    passageTimeMs: NOW + 175_500,
    windowEndMs: NOW + 200_500,
    ...overrides,
  } as Passage;
}

function cardsOf(scene: Partial<Scene>, headingDeg: number | null): PassageCard[] {
  const full = { overhead: null, upcoming: [], ...scene } as Scene;
  return buildCards({ scene: full, nowMs: NOW, headingDeg, timeZone: "UTC" });
}

async function renderCard(card: PassageCard) {
  await render(<PassageCardView card={card} />);
  return within(screen.getByTestId(`passage-card-${card.hex}`));
}

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe("PassageCardView upcoming", () => {
  it("paints the card with the airline theme at 650 pt", async () => {
    const [card] = cardsOf({ upcoming: [passage("a1")] }, null);
    if (!card) throw new Error("missing card");
    await renderCard(card);
    expect(styleOf("passage-card-a1").backgroundColor).toBe(card.theme.bg);
    expect(styleOf("passage-card-a1").height).toBe(650);
  });

  it("shows the countdown, labels and airline column with theme colours", async () => {
    const [card] = cardsOf({ upcoming: [passage("a1")] }, null);
    if (!card) throw new Error("missing card");
    const view = await renderCard(card);
    expect(StyleSheet.flatten(view.getByText("02:56").props.style).color).toBe(card.theme.big);
    expect(StyleSheet.flatten(view.getByText("Passe à").props.style).color).toBe(card.theme.small);
    expect(view.getByText("Regardez")).toBeOnTheScreen();
    expect(view.getByText("O")).toBeOnTheScreen();
    expect(view.getByText("AF1506")).toBeOnTheScreen();
    expect(view.getByText("—")).toBeOnTheScreen();
    expect(view.queryByText("Au-dessus de vous")).toBeNull();
  });

  it("renders the tail and no route block", async () => {
    const [card] = cardsOf({ upcoming: [passage("a1")] }, null);
    if (!card) throw new Error("missing card");
    await renderCard(card);
    expect(screen.getByTestId("passage-tail-a1")).toBeOnTheScreen();
    expect(screen.queryByTestId("passage-route-a1")).toBeNull();
  });

  it("renders no arrow while the heading is unknown", async () => {
    const [card] = cardsOf({ upcoming: [passage("a1")] }, null);
    if (!card) throw new Error("missing card");
    await renderCard(card);
    expect(screen.queryByTestId("passage-arrow-a1", { includeHiddenElements: true })).toBeNull();
  });

  it("renders a decorative rotated arrow when the heading is known", async () => {
    const [card] = cardsOf({ upcoming: [passage("a1")] }, 30);
    if (!card) throw new Error("missing card");
    await renderCard(card);
    // Masquée aux lecteurs d'écran par construction : RNTL l'écarte sans `includeHiddenElements`.
    const arrow = screen.getByTestId("passage-arrow-a1", { includeHiddenElements: true });
    expect(StyleSheet.flatten(arrow.props.style).transform).toEqual([{ rotate: `${card.arrowAngleDeg}deg` }]);
    expect(arrow.props.accessibilityLabel).toBeUndefined();
    expect(arrow.props.accessibilityElementsHidden).toBe(true);
    expect(arrow.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});

describe("PassageCardView overhead", () => {
  it("shows the overhead labels, the gauge and the three values", async () => {
    const [card] = cardsOf(
      { overhead: passage("h1", { passageTimeMs: NOW - 10_500, windowEndMs: NOW + 39_500 }) },
      null,
    );
    if (!card?.visibility) throw new Error("missing overhead card");
    const view = await renderCard(card);
    expect(view.getByText("Au-dessus de vous")).toBeOnTheScreen();
    expect(view.getByText("EN CE")).toBeOnTheScreen();
    expect(view.getByText("MOMENT")).toBeOnTheScreen();
    const gauge = view.getByRole("progressbar", { name: "Visibilité" });
    expect(gauge.props.accessibilityValue).toMatchObject({
      min: 0,
      max: 100,
      now: gaugePercent(card.visibility.progress),
    });
    expect(view.getByText("Visible encore")).toBeOnTheScreen();
    expect(view.getByText(card.visibility.remaining)).toBeOnTheScreen();
    expect(view.getByText("Altitude")).toBeOnTheScreen();
    expect(view.getByText("Vitesse")).toBeOnTheScreen();
    expect(view.getByText("Direction")).toBeOnTheScreen();
    expect(view.getByText("E")).toBeOnTheScreen();
    expect(view.queryByText("Passe à")).toBeNull();
    expect(view.getByText(card.altitude)).toBeOnTheScreen();
    expect(view.getByText(card.speed)).toBeOnTheScreen();
    expect(view.getByText("Compagnie")).toBeOnTheScreen();
    expect(view.getByText("Vol")).toBeOnTheScreen();
    expect(view.getByText("AF1506")).toBeOnTheScreen();
    expect(view.getByText("Appareil")).toBeOnTheScreen();
    expect(screen.getByTestId("passage-tail-h1")).toBeOnTheScreen();
    expect(styleOf("passage-card-h1").backgroundColor).toBe(card.theme.bg);
    expect(StyleSheet.flatten(view.getByText("EN CE").props.style).color).toBe(card.theme.big);
    expect(StyleSheet.flatten(view.getByText("Au-dessus de vous").props.style).color).toBe(card.theme.small);
    expect(view.queryAllByText(/^\d{2}:\d{2}$/)).toHaveLength(1);
  });

  it("renders the arrow once the heading is known", async () => {
    const [card] = cardsOf({ overhead: passage("h1") }, 100);
    if (!card) throw new Error("missing overhead card");
    await renderCard(card);
    const arrow = screen.getByTestId("passage-arrow-h1", { includeHiddenElements: true });
    expect(StyleSheet.flatten(arrow.props.style).transform).toEqual([{ rotate: `${card.arrowAngleDeg}deg` }]);
  });
});
