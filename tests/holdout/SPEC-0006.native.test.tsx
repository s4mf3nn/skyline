import { act, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0006 (écran) : parcours de bout en bout par `createApp`, avec d'autres données que le
// contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

interface FeatureModule {
  feature: Feature;
}
interface AppLifecycle {
  onForeground(listener: () => void): () => void;
}
interface LifecycleModule {
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void };
}
interface AirlinesModule {
  resolveAirline(callsign: string | null): { name: string };
  airlineTheme(airline: { name: string }): { bg: string };
}
const featureModule = () => jest.requireActual<FeatureModule>("../../src/features/passages");
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");
const airlinesModule = () => jest.requireActual<AirlinesModule>("../../src/shared/airlines");

// Observateur à Reykjavik : plan local en km (x est, y nord), 720 km/h = 0,2 km/s.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 64.1466, longitude: -21.9426 };
const NOW = 1_795_000_000_000;
const SECOND = 1000;

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
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 11_000, groundSpeedKmh: 720, trackDeg, ...overrides };
}

function setup(aircraft: Aircraft[]) {
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(aircraft);
  const location = createFakeLocation({ permission: "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  // `lifecycle` est un champ de `AppServices` posé par SPEC-0004 : passé par une variable, il n'est pas contrôlé ici.
  const services = { clock, location, adsb, monitoring, lifecycle };
  const App = createApp({ services, features: [featureModule().feature] });
  return { App, clock, adsb, location, monitoring, lifecycle };
}

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
const elapse = (clock: { advance(ms: number): void }, ms: number) =>
  act(async () => {
    clock.advance(ms);
    await jest.advanceTimersByTimeAsync(ms);
  });
const cardIds = () =>
  screen.queryAllByTestId(/^passage-card-/).map((node) => String(node.props.testID).replace("passage-card-", ""));
const card = (hex: string) => within(screen.getByTestId(`passage-card-${hex}`));

describe("SPEC-0006 scénarios cachés : écran Prochains passages", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("walks a flight from its first countdown, through the overhead card, to its disappearance", async () => {
    const harness = setup([plane("i1", "ICE451", -30.1, 3, 90), plane("i2", "DLH441", -75.1, 0, 90)]);
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["i1", "i2"]);
    expect(card("i1").getByText("02:06")).toBeOnTheScreen();
    expect(card("i2").getByText("05:51")).toBeOnTheScreen();

    await elapse(harness.clock, 126 * SECOND);
    expect(card("i1").getByText("Au-dessus de vous")).toBeOnTheScreen();
    expect(card("i2").getByText("03:45")).toBeOnTheScreen();
    expect(screen.queryByText("00:00")).toBeNull();

    // Fin de la fenêtre à +175,5 s (point le plus proche à +150,5 s, demi-fenêtre de 25 s).
    await elapse(harness.clock, 50 * SECOND);
    expect(cardIds()).toEqual(["i2"]);
    expect(card("i2").queryByText("Au-dessus de vous")).toBeNull();
    expect(card("i2").getByText("02:55")).toBeOnTheScreen();
  });

  it("replaces the overhead card by the next aircraft and keeps the unknown airline fallback", async () => {
    const harness = setup([plane("o1", "ICE451", -3.1, 1, 90), plane("o2", null, 30.1, -2, 270, { altitudeM: null })]);
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["o1", "o2"]);
    const { resolveAirline, airlineTheme } = airlinesModule();
    expect(StyleSheet.flatten(screen.getByTestId("passage-card-o2").props.style).backgroundColor).toBe(
      airlineTheme(resolveAirline(null)).bg,
    );
    expect(card("o2").getByText(resolveAirline(null).name)).toBeOnTheScreen();

    // o1 sort de sa fenêtre à +39,5 s ; o2 y entre à +125,5 s : le carrousel n'a plus qu'une carte à venir entre-temps.
    await elapse(harness.clock, 45 * SECOND);
    expect(cardIds()).toEqual(["o2"]);
    await elapse(harness.clock, 81 * SECOND);
    expect(cardIds()).toEqual(["o2"]);
    expect(card("o2").getByText("Au-dessus de vous")).toBeOnTheScreen();
    // Altitude inconnue, vol sans indicatif et appareil non fourni : trois tirets.
    expect(card("o2").getAllByText("—")).toHaveLength(3);
  });

  it("keeps the cards while the source is down, then recovers them at the return to the foreground, without logging anything", async () => {
    const logs = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      const harness = setup([plane("r1", "ICE451", -40.1, 0, 90)]);
      await render(<harness.App />);
      await settle();
      expect(cardIds()).toEqual(["r1"]);
      harness.adsb.setUnavailable(true);
      await act(async () => {
        harness.lifecycle.enterForeground();
      });
      await settle();
      await elapse(harness.clock, 10 * SECOND);
      expect(card("r1").getByText("02:46")).toBeOnTheScreen();

      harness.adsb.setUnavailable(false);
      harness.adsb.setAircraft([plane("r1", "ICE451", -40.1, 0, 90), plane("r2", "RYR9", -45.1, 0, 90)]);
      await act(async () => {
        harness.lifecycle.enterForeground();
      });
      await settle();
      expect(cardIds()).toEqual(["r1", "r2"]);
      expect(harness.monitoring.events).toEqual([]);
      for (const spy of logs) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of logs) spy.mockRestore();
    }
  });
});
