import { act, render, screen, within } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { createFakeAdsbSource } from "../../../shared/adsb";
import { createFakeClock } from "../../../shared/clock";
import { createFakeLocation } from "../../../shared/location";
import { createFakeErrorReporter } from "../../../shared/monitoring";
import { createFakeRouteSource, createFlightLookup, type FlightRoute } from "../../../shared/routes";
import { type Passage, type Scene, SceneProvider } from "../../../shared/scene";
import { type AppServices, ServicesProvider } from "../../../shared/services";
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

const OBSERVER = { latitude: 45.76449, longitude: 4.83571 };

const PARIS_DUSSELDORF: FlightRoute = {
  origin: { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55 },
  destination: { iata: "DUS", city: "Düsseldorf", latitude: 51.2895, longitude: 6.7668 },
};

// Une scène prête (un avion lointain) pour que `useFlightInfo` ait un instantané ; les cartes testées sont passées en direct.
function harness(routes?: ReturnType<typeof createFakeRouteSource>) {
  const clock = createFakeClock(NOW);
  const services: AppServices = {
    clock,
    location: createFakeLocation({ permission: "granted", position: OBSERVER }),
    adsb: createFakeAdsbSource([]),
    monitoring: createFakeErrorReporter(),
    ...(routes === undefined ? {} : { routes: createFlightLookup({ source: routes, clock }) }),
  };
  const Wrapper = ({ children }: { children: ReactElement }) => (
    <ServicesProvider services={services}>
      <SceneProvider>{children}</SceneProvider>
    </ServicesProvider>
  );
  return { clock, Wrapper };
}

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

async function renderCard(card: PassageCard, routes?: ReturnType<typeof createFakeRouteSource>) {
  const { Wrapper, clock } = harness(routes);
  await render(
    <Wrapper>
      <PassageCardView card={card} />
    </Wrapper>,
  );
  await settle();
  return { view: within(screen.getByTestId(`passage-card-${card.hex}`)), clock };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

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
    const { view } = await renderCard(card);
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
    const { view } = await renderCard(card);
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

describe("PassageCardView route block", () => {
  it("shows stacked codes, cities and the aircraft type for a known route", async () => {
    const routes = createFakeRouteSource({ routes: { AFR1506: PARIS_DUSSELDORF }, aircraftTypes: { a1b2c3: "B738" } });
    const [card] = cardsOf({ upcoming: [passage("a1b2c3")] }, null);
    if (!card) throw new Error("missing card");
    const { view } = await renderCard(card, routes);
    expect(screen.getByTestId("passage-route-a1b2c3")).toHaveTextContent(/CDG\s*DUS\s*Paris → Düsseldorf/);
    expect(view.getByText("B738")).toBeOnTheScreen();
    expect(view.queryByText("—")).toBeNull();
  });

  it("shows the same block and type on the overhead card", async () => {
    const routes = createFakeRouteSource({ routes: { AFR1506: PARIS_DUSSELDORF }, aircraftTypes: { c0ffee: "A319" } });
    const [card] = cardsOf({ overhead: passage("c0ffee") }, null);
    if (!card) throw new Error("missing card");
    const { view } = await renderCard(card, routes);
    expect(screen.getByTestId("passage-route-c0ffee")).toHaveTextContent(/CDG\s*DUS\s*Paris → Düsseldorf/);
    expect(view.getByText("A319")).toBeOnTheScreen();
  });

  it("falls back to the plain card for an unknown route and an unknown type", async () => {
    const routes = createFakeRouteSource({ routes: { AFR1506: null }, aircraftTypes: { a1b2c3: null } });
    const [card] = cardsOf({ upcoming: [passage("a1b2c3")] }, null);
    if (!card) throw new Error("missing card");
    const { view } = await renderCard(card, routes);
    expect(screen.queryByTestId("passage-route-a1b2c3")).toBeNull();
    expect(view.getByText("—")).toBeOnTheScreen();
  });

  it("asks nothing for a missing callsign and shows only the type", async () => {
    const routes = createFakeRouteSource({ aircraftTypes: { a1b2c3: "PA28" } });
    const [card] = cardsOf({ upcoming: [passage("a1b2c3", { callsign: null })] }, null);
    if (!card) throw new Error("missing card");
    const { view } = await renderCard(card, routes);
    expect(routes.routeRequests).toEqual([]);
    expect(screen.queryByTestId("passage-route-a1b2c3")).toBeNull();
    expect(view.getByText("PA28")).toBeOnTheScreen();
  });

  it("shows each line only when complete", async () => {
    const noCode: FlightRoute = {
      origin: { ...PARIS_DUSSELDORF.origin, iata: null },
      destination: PARIS_DUSSELDORF.destination,
    };
    const routes = createFakeRouteSource({ routes: { AFR1506: noCode } });
    const [card] = cardsOf({ upcoming: [passage("a1b2c3")] }, null);
    if (!card) throw new Error("missing card");
    await renderCard(card, routes);
    const block = screen.getByTestId("passage-route-a1b2c3");
    expect(block).toHaveTextContent("Paris → Düsseldorf");
    expect(within(block).queryByText("DUS")).toBeNull();
  });

  it("renders at once while the source is silent, then shows the route on the answer", async () => {
    const routes = createFakeRouteSource({ routes: { AFR1506: PARIS_DUSSELDORF }, aircraftTypes: { a1b2c3: "B738" } });
    routes.holdResponses();
    const [card] = cardsOf({ upcoming: [passage("a1b2c3")] }, null);
    if (!card) throw new Error("missing card");
    const { view } = await renderCard(card, routes);
    expect(screen.queryByTestId("passage-route-a1b2c3")).toBeNull();
    expect(view.getByText("—")).toBeOnTheScreen();
    await act(async () => {
      routes.releaseResponses();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("passage-route-a1b2c3")).toBeOnTheScreen();
    expect(view.getByText("B738")).toBeOnTheScreen();
  });

  it("asks again after the retry delay once the source is back, and never asks a definitive answer twice", async () => {
    const routes = createFakeRouteSource({ routes: { AFR1506: PARIS_DUSSELDORF }, aircraftTypes: { a1b2c3: "B738" } });
    routes.setUnavailable(true);
    const [card] = cardsOf({ upcoming: [passage("a1b2c3")] }, null);
    if (!card) throw new Error("missing card");
    const { clock } = await renderCard(card, routes);
    expect(screen.queryByTestId("passage-route-a1b2c3")).toBeNull();
    expect(routes.routeRequests).toEqual(["AFR1506"]);

    routes.setUnavailable(false);
    await act(async () => {
      clock.advance(10_000);
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByTestId("passage-route-a1b2c3")).toBeOnTheScreen();
    expect(routes.routeRequests).toEqual(["AFR1506", "AFR1506"]);

    await act(async () => {
      clock.advance(40_000);
      await jest.advanceTimersByTimeAsync(40_000);
    });
    expect(routes.routeRequests).toEqual(["AFR1506", "AFR1506"]);
  });
});
