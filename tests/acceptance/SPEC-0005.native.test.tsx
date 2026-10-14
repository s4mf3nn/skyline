import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0005, partie écran et présence (Jest, `jest-expo` et React Native Testing Library) : l'écran Ciel
// et sa présence dans le pager, montés par `createApp` avec les faux de src/shared/ ; la scène vient de `useScene`.
// Le geste réel, la position des éléments et les tailles de police ne sont pas joués ici (parcours sur cible réelle).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés à l'exécution, types du contrat recopiés ici.
interface CielFeatureModule {
  feature: Feature & { presence?: (displayedPage: "ciel" | "passages") => boolean };
}
interface PassagesFeatureModule {
  feature: Feature;
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
interface LifecycleModule {
  createFakeLifecycle(): { onForeground(listener: () => void): () => void; enterForeground(): void };
}
const cielModule = () => jest.requireActual<CielFeatureModule>("../../src/features/ciel");
const passagesModule = () => jest.requireActual<PassagesFeatureModule>("../../src/features/passages");
const airlinesModule = () => jest.requireActual<AirlinesModule>("../../src/shared/airlines");
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km), 720 km/h = 0,2 km/s,
// donc la fenêtre de ±5 km dure 50 s autour du point le plus proche. Les décalages de 0,1 km placent les heures à
// mi-seconde : la tolérance de ±1 s de SPEC-0004 ne peut pas faire basculer un affichage.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;
const NBSP = " ";
const CREAM = "#F4F1EA";

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

// `h1` est déjà dans sa fenêtre : entrée il y a 10,5 s, fin dans 39,5 s (cap est). `n2` y entre dans 275,5 s.
const OVERHEAD_NOW = plane("h1", "AFR1506", -2.9, 1, 90, { altitudeM: 7850 });
const OVERHEAD_LATER = plane("n2", "IBE3457", -60.1, 0, 90, { altitudeM: 9100 });

interface SetupOptions {
  aircraft: Aircraft[];
  permission?: "granted" | "denied";
}

function setup(options: SetupOptions) {
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(options.aircraft);
  const location = createFakeLocation({ permission: options.permission ?? "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const services = { clock, location, adsb, monitoring, lifecycle };
  const features = [cielModule().feature, passagesModule().feature];
  const App = createApp({ services, features });
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

const pagerElement = () => screen.getByRole("adjustable", { name: "Indicateur de page" });
const slide = (name: "increment" | "decrement") =>
  fireEvent(pagerElement(), "accessibilityAction", { nativeEvent: { actionName: name } });
const trait = (index: 0 | 1) => screen.getByTestId(`pager-indicator-trait-${index}`);
const value = (key: string) => screen.getByTestId(`sky-value-${key}`);
const text = (element: { props: { children?: unknown } }) => String(element.props.children);

describe.skip("SPEC-0005 écran Ciel et présence (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("CA6 : exports the sky feature as the first page, with a presence hook", () => {
    const { feature } = cielModule();
    expect(feature.name).toBe("ciel");
    expect(feature.order).toBe(0);
    expect(typeof feature.screen).toBe("function");
    expect(typeof feature.presence).toBe("function");
  });

  it("CA7 : has a single page, without indicator nor Ciel, when nothing flies overhead", async () => {
    const harness = setup({ aircraft: [OVERHEAD_LATER] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
    expect(screen.queryByTestId("sky-screen")).toBeNull();
    expect(screen.getByTestId("passages-list")).toBeOnTheScreen();
  });

  it("CA7 : has a single page when the location permission is denied", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW], permission: "denied" });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 5 * SECOND);
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
    expect(screen.queryByTestId("sky-screen")).toBeNull();
  });

  it("CA8 : adds Ciel on the left without changing the displayed page, then opens it on request", async () => {
    const harness = setup({ aircraft: [OVERHEAD_LATER] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();

    await act(async () => {
      harness.adsb.setAircraft([OVERHEAD_NOW]);
      harness.lifecycle.enterForeground();
      await jest.advanceTimersByTimeAsync(0);
    });
    await elapse(harness.clock, SECOND);
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    expect(screen.getByTestId("sky-screen")).toBeOnTheScreen();
    expect(screen.getByTestId("passage-card-h1")).toBeOnTheScreen();

    await slide("decrement");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });

  it("CA9 : colours the screen with the airline theme and shows the six rows and the generic tail", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW] });
    await render(<harness.App />);
    await settle();
    const { resolveAirline, airlineTheme } = airlinesModule();
    const theme = airlineTheme(resolveAirline("AFR1506"));

    expect(StyleSheet.flatten(screen.getByTestId("sky-screen").props.style).backgroundColor).toBe(theme.bg);
    const rows: Array<[string, string, string]> = [
      ["speed", "Vitesse", "720"],
      ["altitude", "Altitude", `7${NBSP}850`],
      ["heading", "Cap", "E"],
      ["airline", "Compagnie", resolveAirline("AFR1506").name],
      ["flight", "Vol", "AF1506"],
      ["aircraft", "Appareil", "—"],
    ];
    for (const [key, label, expected] of rows) {
      const labelStyle = StyleSheet.flatten(screen.getByTestId(`sky-label-${key}`).props.style);
      expect(text(screen.getByTestId(`sky-label-${key}`))).toBe(label);
      expect(labelStyle.color).toBe(theme.big);
      expect(labelStyle.opacity).toBe(0.7);
      expect(text(value(key))).toBe(expected);
      expect(StyleSheet.flatten(value(key).props.style).color).toBe(theme.big);
    }
    expect(screen.getByTestId("sky-tail")).toBeOnTheScreen();
  });

  it("CA9 : shows the unknown airline and dashes for an aircraft without callsign nor altitude", async () => {
    const aircraft = plane("n1", null, -2.9, 1, 90, { altitudeM: null });
    const harness = setup({ aircraft: [aircraft] });
    await render(<harness.App />);
    await settle();
    const { resolveAirline } = airlinesModule();
    expect(text(value("airline"))).toBe(resolveAirline(null).name);
    expect(text(value("flight"))).toBe("—");
    expect(text(value("altitude"))).toBe("—");
  });

  it("CA10 : has no arrow, no route block and no delay, even with a known phone heading", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW, OVERHEAD_LATER] });
    await render(<harness.App />);
    await settle();
    await act(async () => {
      harness.location.setHeading(120);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("sky-screen")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^sky-(arrow|route|progress|codes)/)).toBeNull();
    expect(within(screen.getByTestId("sky-screen")).queryByText(/^\d{2}:\d{2}$/)).toBeNull();
  });

  it("CA11 : tints the page indicator with the airline accent while Ciel is displayed", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW] });
    await render(<harness.App />);
    await settle();
    const { resolveAirline, airlineTheme } = airlinesModule();
    const theme = airlineTheme(resolveAirline("AFR1506"));
    expect(trait(1)).toHaveStyle({ backgroundColor: CREAM });
    await slide("decrement");
    expect(trait(0)).toHaveStyle({ backgroundColor: theme.small });
    await slide("increment");
    expect(trait(1)).toHaveStyle({ backgroundColor: CREAM });
  });

  it("CA12 : retains the aircraft with its last values when the survol ends while Ciel is displayed", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW] });
    await render(<harness.App />);
    await settle();
    await slide("decrement");
    const before = ["speed", "altitude", "heading", "airline", "flight", "aircraft"].map((key) => text(value(key)));
    const { airlineTheme, resolveAirline } = airlinesModule();

    await elapse(harness.clock, 40 * SECOND);
    expect(screen.queryByTestId("passage-card-h1")).toBeNull();
    expect(screen.getByTestId("sky-screen")).toBeOnTheScreen();
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    expect(StyleSheet.flatten(screen.getByTestId("sky-screen").props.style).backgroundColor).toBe(
      airlineTheme(resolveAirline("AFR1506")).bg,
    );

    await elapse(harness.clock, 30 * SECOND);
    harness.lifecycle.enterForeground();
    await settle();
    const after = ["speed", "altitude", "heading", "airline", "flight", "aircraft"].map((key) => text(value(key)));
    expect(after).toEqual(before);
  });

  it("CA13 : removes a retained aircraft at the end of the slide towards the passages", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW] });
    await render(<harness.App />);
    await settle();
    await slide("decrement");
    await elapse(harness.clock, 40 * SECOND);
    expect(screen.getByTestId("sky-screen")).toBeOnTheScreen();

    await slide("increment");
    await elapse(harness.clock, 500);
    expect(screen.queryByTestId("sky-screen")).toBeNull();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
    expect(screen.getByTestId("passages-list")).toBeOnTheScreen();
  });

  it("CA14 : removes Ciel at once when the survol ends while the passages are displayed", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW] });
    await render(<harness.App />);
    await settle();
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });

    await elapse(harness.clock, 40 * SECOND);
    expect(screen.queryByTestId("sky-screen")).toBeNull();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
    expect(screen.getByTestId("passages-list")).toBeOnTheScreen();
  });

  it("CA15 : the retained aircraft is replaced by the next survol", async () => {
    const harness = setup({ aircraft: [OVERHEAD_NOW, OVERHEAD_LATER] });
    await render(<harness.App />);
    await settle();
    await slide("decrement");
    await elapse(harness.clock, 40 * SECOND);
    expect(text(value("flight"))).toBe("AF1506");

    await elapse(harness.clock, 236 * SECOND);
    expect(text(value("flight"))).toBe("IB3457");
    expect(text(value("altitude"))).toBe(`9${NBSP}100`);
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });

  it("CA16 : sends nothing to error tracking and logs nothing during a full run", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const harness = setup({ aircraft: [OVERHEAD_NOW] });
    await render(<harness.App />);
    await settle();
    await slide("decrement");
    await elapse(harness.clock, 40 * SECOND);
    await slide("increment");
    await elapse(harness.clock, 2 * SECOND);
    expect(harness.monitoring.events).toEqual([]);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it("CA17 : two applications created one after the other share no retained aircraft", async () => {
    const first = setup({ aircraft: [OVERHEAD_NOW] });
    const view = await render(<first.App />);
    await settle();
    await slide("decrement");
    await elapse(first.clock, 40 * SECOND);
    expect(screen.getByTestId("sky-screen")).toBeOnTheScreen();
    view.unmount();

    const second = setup({ aircraft: [] });
    await render(<second.App />);
    await settle();
    expect(screen.queryByTestId("sky-screen")).toBeNull();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
  });
});
