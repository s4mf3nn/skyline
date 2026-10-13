import { act, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0006, partie écran (Jest, `jest-expo` et React Native Testing Library) : l'écran Prochains
// passages monté par `createApp`, avec les faux de src/shared/ ; la scène vient de `useScene` (SPEC-0004).
// Le calage réel du carrousel et la fluidité des comptes à rebours ne sont pas joués ici (parcours sur cible réelle).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés à l'exécution, types du contrat recopiés ici.
interface FeatureModule {
  feature: Feature & { presence?: unknown };
}
interface PassagesMetrics {
  snapIntervalPt: number;
  cardHeightPt: number;
  paddingTopPt: number;
  paddingBottomPt: number;
}
interface PassagesModule {
  PASSAGES_METRICS: PassagesMetrics;
  formatLocalTime(timestampMs: number, timeZone: string): string;
}
interface Airline {
  name: string;
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
}
interface AirlinesModule {
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): AirlineTheme;
}
interface AppLifecycle {
  onForeground(listener: () => void): () => void;
}
interface LifecycleModule {
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void };
}
const featureModule = () => jest.requireActual<FeatureModule>("../../src/features/passages");
const passagesModule = () => jest.requireActual<PassagesModule>("../../src/features/passages/service");
const airlinesModule = () => jest.requireActual<AirlinesModule>("../../src/shared/airlines");
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km), 720 km/h = 0,2 km/s,
// donc la fenêtre de ±5 km dure 50 s autour du point le plus proche. Les décalages de 0,1 km (-40,1 km : entrée à 175,5 s)
// placent les heures à mi-seconde : la tolérance de ±1 s de SPEC-0004 ne peut pas faire basculer un affichage.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;
const NBSP = " ";
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function at(eastKm: number, northKm: number): Position {
  return {
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  };
}

function plane(
  hex: string,
  callsign: string | null,
  eastKm: number,
  northKm: number,
  trackDeg: number,
  overrides: Partial<Aircraft> = {},
): Aircraft {
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 10_000, groundSpeedKmh: 720, trackDeg, ...overrides };
}

interface SetupOptions {
  aircraft: Aircraft[];
  permission?: "granted" | "denied";
  unavailable?: boolean;
}

function setup(options: SetupOptions) {
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(options.aircraft);
  adsb.setUnavailable(options.unavailable ?? false);
  const location = createFakeLocation({ permission: options.permission ?? "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const services = { clock, location, adsb, monitoring, lifecycle };
  const App = createApp({ services, features: [featureModule().feature] });
  return { App, clock, adsb, location, monitoring, lifecycle };
}

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

/** Avance l'horloge factice et les minuteurs de `ms`, comme le temps réel. */
const elapse = (clock: { advance(ms: number): void }, ms: number) =>
  act(async () => {
    clock.advance(ms);
    await jest.advanceTimersByTimeAsync(ms);
  });

function cardIds(): string[] {
  return screen
    .queryAllByTestId(/^passage-card-/)
    .map((card) => String(card.props.testID).replace("passage-card-", ""));
}

function card(hex: string) {
  return within(screen.getByTestId(`passage-card-${hex}`));
}

/** Angle de la transformation `rotate` d'un élément, en degrés (`"170deg"` ou `"170"`), `null` sans rotation. */
function rotation(testID: string): number | null {
  const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
  const transforms: Array<Record<string, unknown>> = Array.isArray(style?.transform) ? style.transform : [];
  const entry = transforms.find((transform) => "rotate" in transform);
  return entry === undefined ? null : Number.parseFloat(String(entry.rotate));
}

describe.skip("SPEC-0006 Prochains passages (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("CA10 : exports the passages feature, always present, as the second page", () => {
    const { feature } = featureModule();
    expect(feature.name).toBe("passages");
    expect(feature.order).toBe(1);
    expect(typeof feature.screen).toBe("function");
    expect(feature.presence).toBeUndefined();
  });

  it("CA11 : renders a vertical list calibrated on 662 pt with 650 pt cards", async () => {
    const harness = setup({
      aircraft: [plane("a1", "AFR1506", -40.1, 0, 90), plane("b2", "IBE3457", -60.1, 0, 90)],
    });
    await render(<harness.App />);
    await settle();
    const { PASSAGES_METRICS } = passagesModule();
    const list = screen.getByTestId("passages-list");
    expect(list.props.snapToInterval).toBe(PASSAGES_METRICS.snapIntervalPt);
    expect(list.props.snapToInterval).toBe(662);
    expect(list.props.decelerationRate).toBe("fast");
    expect(list.props.disableIntervalMomentum).toBe(true);
    const content = StyleSheet.flatten(list.props.contentContainerStyle) ?? {};
    const inset = list.props.contentInset ?? {};
    expect(content.paddingTop ?? inset.top).toBe(100);
    expect(content.paddingBottom ?? inset.bottom).toBe(200);
    for (const hex of ["a1", "b2"]) {
      expect(StyleSheet.flatten(screen.getByTestId(`passage-card-${hex}`).props.style).height).toBe(650);
    }
  });

  it("CA12 : shows an upcoming card with the countdown, the passage time, the direction and the airline columns", async () => {
    const harness = setup({ aircraft: [plane("a1", "AFR1506", -40.1, 0, 90)] });
    await render(<harness.App />);
    await settle();
    const { formatLocalTime } = passagesModule();
    const { resolveAirline } = airlinesModule();
    expect(cardIds()).toEqual(["a1"]);
    const view = card("a1");
    expect(view.getByText("02:56")).toBeOnTheScreen();
    expect(view.getByText("Passe à")).toBeOnTheScreen();
    expect(view.getByText(formatLocalTime(NOW + 175_500, TIME_ZONE))).toBeOnTheScreen();
    expect(view.getByText("Regardez")).toBeOnTheScreen();
    expect(view.getByText("O")).toBeOnTheScreen();
    expect(view.getByText("Compagnie")).toBeOnTheScreen();
    expect(view.getByText(resolveAirline("AFR1506").name)).toBeOnTheScreen();
    expect(view.getByText("Vol")).toBeOnTheScreen();
    expect(view.getByText("AF1506")).toBeOnTheScreen();
    expect(view.getByText("Appareil")).toBeOnTheScreen();
    expect(view.getByText("—")).toBeOnTheScreen();
    expect(view.queryByText("Au-dessus de vous")).toBeNull();
  });

  it("CA12 : colours the card with the airline theme, shows the generic tail and no route block", async () => {
    const harness = setup({
      aircraft: [plane("a1", "AFR1506", -40.1, 0, 90), plane("u9", "ZZZ123", -60.1, 0, 90)],
    });
    await render(<harness.App />);
    await settle();
    const { resolveAirline, airlineTheme } = airlinesModule();
    for (const [hex, callsign] of [
      ["a1", "AFR1506"],
      ["u9", "ZZZ123"],
    ] as const) {
      const theme = airlineTheme(resolveAirline(callsign));
      expect(StyleSheet.flatten(screen.getByTestId(`passage-card-${hex}`).props.style).backgroundColor).toBe(theme.bg);
      expect(screen.getByTestId(`passage-tail-${hex}`)).toBeOnTheScreen();
      expect(screen.queryByTestId(`passage-route-${hex}`)).toBeNull();
    }
    const firstTheme = airlineTheme(resolveAirline("AFR1506"));
    expect(StyleSheet.flatten(card("a1").getByText("02:56").props.style).color).toBe(firstTheme.big);
    expect(StyleSheet.flatten(card("a1").getByText("Passe à").props.style).color).toBe(firstTheme.small);
  });

  it("CA12 : shows a dash for the flight and the unknown airline name when there is no callsign", async () => {
    const harness = setup({ aircraft: [plane("n1", null, -40.1, 0, 90)] });
    await render(<harness.App />);
    await settle();
    const { resolveAirline } = airlinesModule();
    const view = card("n1");
    expect(view.getByText(resolveAirline(null).name)).toBeOnTheScreen();
    expect(view.getAllByText("—")).toHaveLength(2);
  });

  it("CA13 : updates every countdown each second without querying the source again", async () => {
    const harness = setup({
      aircraft: [plane("a1", "AFR1506", -40.1, 0, 90), plane("b2", "IBE3457", -60.1, 0, 90)],
    });
    await render(<harness.App />);
    await settle();
    expect(card("a1").getByText("02:56")).toBeOnTheScreen();
    expect(card("b2").getByText("04:36")).toBeOnTheScreen();
    expect(harness.adsb.queries).toHaveLength(1);

    await elapse(harness.clock, SECOND);
    expect(card("a1").getByText("02:55")).toBeOnTheScreen();
    expect(card("b2").getByText("04:35")).toBeOnTheScreen();
    await elapse(harness.clock, 9 * SECOND);
    expect(card("a1").getByText("02:46")).toBeOnTheScreen();
    expect(harness.adsb.queries).toHaveLength(1);
  });

  it("CA14 : turns the card into the overhead card, first in the list, when the countdown reaches zero", async () => {
    const harness = setup({
      aircraft: [plane("a1", "AFR1506", -40.1, 0, 90), plane("b2", "IBE3457", -60.1, 0, 90)],
    });
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["a1", "b2"]);

    await elapse(harness.clock, 175 * SECOND);
    expect(cardIds()).toEqual(["a1", "b2"]);
    expect(card("a1").getByText("00:01")).toBeOnTheScreen();
    expect(screen.queryByText("00:00")).toBeNull();
    expect(screen.queryByText("Au-dessus de vous")).toBeNull();

    await elapse(harness.clock, SECOND);
    expect(cardIds()).toEqual(["a1", "b2"]);
    expect(card("a1").getByText("Au-dessus de vous")).toBeOnTheScreen();
    expect(card("a1").queryByText("Passe à")).toBeNull();
    expect(card("b2").queryByText("Au-dessus de vous")).toBeNull();
    expect(card("b2").getByText("01:40")).toBeOnTheScreen();
  });

  it("CA15 : shows the overhead card with the gauge, the remaining time and the three values", async () => {
    // h1 est déjà dans sa fenêtre : entrée il y a 10,5 s, fin dans 39,5 s (cap est, 720 km/h).
    const harness = setup({
      aircraft: [plane("h1", "AFR1506", -2.9, 1, 90, { altitudeM: 7850 })],
    });
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["h1"]);
    const view = card("h1");
    expect(view.getByText("Au-dessus de vous")).toBeOnTheScreen();
    expect(view.getByText("EN CE")).toBeOnTheScreen();
    expect(view.getByText("MOMENT")).toBeOnTheScreen();
    const gauge = view.getByRole("progressbar", { name: "Visibilité" });
    expect(gauge.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 21 });
    expect(view.getByText("Visible encore")).toBeOnTheScreen();
    expect(view.getByText("00:40")).toBeOnTheScreen();
    expect(view.getByText("Altitude")).toBeOnTheScreen();
    expect(view.getByText(`7${NBSP}850`)).toBeOnTheScreen();
    expect(view.getByText("Vitesse")).toBeOnTheScreen();
    expect(view.getByText("720")).toBeOnTheScreen();
    expect(view.getByText("Direction")).toBeOnTheScreen();
    expect(view.getByText("E")).toBeOnTheScreen();
    expect(view.getByText("AF1506")).toBeOnTheScreen();
    expect(view.queryByText("Passe à")).toBeNull();
    // Seul `MM:SS` de la carte est le temps restant : aucun compte à rebours vers un passage.
    expect(view.getAllByText(/^\d{2,}:\d{2}$/)).toHaveLength(1);
  });

  it("CA15 : moves the gauge and the remaining time with the clock", async () => {
    const harness = setup({ aircraft: [plane("h1", "AFR1506", -2.9, 1, 90)] });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 15 * SECOND);
    const view = card("h1");
    expect(view.getByRole("progressbar", { name: "Visibilité" }).props.accessibilityValue).toMatchObject({ now: 51 });
    expect(view.getByText("00:25")).toBeOnTheScreen();
  });

  it("CA16 : rotates the arrow with the phone heading and hides it while the heading is unknown", async () => {
    const harness = setup({ aircraft: [plane("a1", "AFR1506", -40.1, 0, 90)] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("passage-arrow-a1")).toBeNull();
    expect(card("a1").getByText("O")).toBeOnTheScreen();

    // Gisement d'arrivée 270° (l'avion arrive de l'ouest) moins le cap du téléphone.
    await act(async () => {
      harness.location.setHeading(30);
    });
    expect(rotation("passage-arrow-a1")).toBeCloseTo(240, 0);
    // Décorative : sans nom propre et masquée aux lecteurs d'écran, le point cardinal porte l'information.
    const arrow = screen.getByTestId("passage-arrow-a1");
    expect(arrow.props.accessibilityLabel).toBeUndefined();
    expect(arrow.props.accessibilityElementsHidden).toBe(true);
    expect(arrow.props.importantForAccessibility).toBe("no-hide-descendants");
    await act(async () => {
      harness.location.setHeading(300);
    });
    expect(rotation("passage-arrow-a1")).toBeCloseTo(330, 0);
    expect(harness.adsb.queries).toHaveLength(1);
  });

  it("CA16 : points the overhead arrow toward the track of the aircraft", async () => {
    const harness = setup({ aircraft: [plane("h1", "AFR1506", -2.9, 1, 90)] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("passage-arrow-h1")).toBeNull();
    await act(async () => {
      harness.location.setHeading(100);
    });
    expect(rotation("passage-arrow-h1")).toBeCloseTo(350, 0);
  });

  it("CA17 : follows a new snapshot: removes a passage, adds one in time order, keeps the identity of moved cards", async () => {
    const harness = setup({
      aircraft: [plane("a1", "AFR1506", -40.1, 0, 90), plane("b2", "IBE3457", -60.1, 0, 90)],
    });
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["a1", "b2"]);

    // c3 passe avant a1 ; b2 est parti. L'identité d'une carte est son `testID` (la clé de la liste est le `hex`).
    harness.adsb.setAircraft([plane("a1", "AFR1506", -40.1, 0, 90), plane("c3", "RYR9", -30.1, 0, 90)]);
    await act(async () => {
      harness.lifecycle.enterForeground();
    });
    await settle();
    expect(cardIds()).toEqual(["c3", "a1"]);
    expect(screen.queryByTestId("passage-card-b2")).toBeNull();
    expect(card("c3").getByText("02:06")).toBeOnTheScreen();
  });

  it("CA17 : never shows more than 11 cards", async () => {
    const crowd = Array.from({ length: 14 }, (_, index) =>
      plane(`f${String(index).padStart(2, "0")}`, "AFR1506", -20 - index, 0, 90),
    );
    const harness = setup({ aircraft: [...crowd, plane("h1", "IBE3457", -2.9, 1, 90)] });
    await render(<harness.App />);
    await settle();
    const ids = cardIds();
    expect(ids.length).toBeLessThanOrEqual(11);
    expect(ids[0]).toBe("h1");
    expect(ids.slice(1)).toEqual(
      Array.from({ length: ids.length - 1 }, (_, index) => `f${String(index).padStart(2, "0")}`),
    );
  });

  it("CA18 : renders no card and does not crash when the permission is denied", async () => {
    const harness = setup({ aircraft: [plane("a1", "AFR1506", -40.1, 0, 90)], permission: "denied" });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 5 * SECOND);
    expect(cardIds()).toEqual([]);
  });

  it("CA18 : renders no card and does not crash when the source is unavailable and nothing was received", async () => {
    const harness = setup({ aircraft: [plane("a1", "AFR1506", -40.1, 0, 90)], unavailable: true });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 5 * SECOND);
    expect(cardIds()).toEqual([]);
  });

  it("CA18 : renders no card and does not crash when the scene is empty", async () => {
    const harness = setup({ aircraft: [] });
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual([]);
  });

  it("CA18 : keeps the last cards, and their countdown, when the source fails after a first snapshot", async () => {
    const harness = setup({ aircraft: [plane("a1", "AFR1506", -40.1, 0, 90)] });
    await render(<harness.App />);
    await settle();
    expect(card("a1").getByText("02:56")).toBeOnTheScreen();

    harness.adsb.setUnavailable(true);
    await act(async () => {
      harness.lifecycle.enterForeground();
    });
    await settle();
    await elapse(harness.clock, 5 * SECOND);
    expect(cardIds()).toEqual(["a1"]);
    expect(card("a1").getByText("02:51")).toBeOnTheScreen();
  });

  it("CA19 : reports nothing to the error tracker and logs nothing during a whole run", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      const harness = setup({
        aircraft: [plane("a1", "AFR1506", -40.1, 0, 90), plane("h1", "IBE3457", -2.9, 1, 90)],
      });
      await render(<harness.App />);
      await settle();
      await act(async () => {
        harness.location.setHeading(45);
      });
      await elapse(harness.clock, 180 * SECOND);
      await act(async () => {
        harness.lifecycle.enterForeground();
      });
      await settle();
      harness.adsb.setUnavailable(true);
      await act(async () => {
        harness.lifecycle.enterForeground();
      });
      await settle();
      expect(harness.monitoring.events).toEqual([]);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
