import { act, render, screen, within } from "@testing-library/react-native";
import { Image, StyleSheet } from "react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0010, partie écran (Jest, `jest-expo` et React Native Testing Library) : livrée réelle ou dérive
// générique sur Ciel et sur les cartes, montés par `createApp` avec les faux de src/shared/. La partie pure (codes,
// fichiers, notice de crédit) est jouée par SPEC-0010.test.ts (Vitest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés à l'exécution, types du contrat recopiés ici.
interface Airline {
  code: string;
  name: string;
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
}
interface AirlinesModule {
  AIRLINES: readonly Airline[];
  UNKNOWN_AIRLINE: Airline;
  LIVERY_CODES: readonly string[];
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): AirlineTheme;
}
interface LiveryModule {
  getLiverySource(airline: Airline): unknown;
}
interface FeatureModule {
  feature: Feature;
}
interface AppLifecycle {
  onForeground(listener: () => void): () => void;
}
interface LifecycleModule {
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void };
}
const airlinesModule = () => jest.requireActual<AirlinesModule>("../../src/shared/airlines");
const liveryModule = () => jest.requireActual<LiveryModule>("../../src/shared/airlines/livery");
const passagesFeature = () => jest.requireActual<FeatureModule>("../../src/features/passages").feature;
const cielFeature = () => jest.requireActual<FeatureModule>("../../src/features/ciel").feature;
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km), 720 km/h = 0,2 km/s.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;

function at(eastKm: number, northKm: number): Position {
  return {
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  };
}

function plane(hex: string, callsign: string | null, eastKm: number, northKm: number): Aircraft {
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 10_000, groundSpeedKmh: 720, trackDeg: 90 };
}

// Survol en cours : dans sa fenêtre de ±5 km dès le départ. Les passages à venir entrent dans leur fenêtre plus tard.
const OVERHEAD_AFR = plane("3944ed", "AFR1015", -1, 1);
const OVERHEAD_UNKNOWN = plane("3944ed", "ZZZ3", -1, 1);
const INBOUND_RYR = plane("4ca7b2", "RYR7KM", -40.1, 0);
const INBOUND_NOLIVERY = plane("406a11", "ZZZ9", -60.1, 0);
const INBOUND_UNKNOWN = plane("a0b1c2", "ZZZ123", -50.1, 0.3);
const INBOUND_PRIVATE = plane("a0b1c3", null, -70.1, 0.3);

function setup(aircraft: Aircraft[]) {
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(aircraft);
  const location = createFakeLocation({ permission: "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const services = { clock, location, adsb, monitoring, lifecycle };
  const App = createApp({ services, features: [cielFeature(), passagesFeature()] });
  return { App, clock, adsb, location, monitoring, lifecycle };
}

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

const livery = (hex: string) => screen.queryByTestId(`passage-livery-${hex}`);
const tail = (hex: string) => screen.queryByTestId(`passage-tail-${hex}`);
const expectedLabel = (callsign: string) => `Livrée ${airlinesModule().resolveAirline(callsign).name}`;
const expectedSource = (callsign: string) => liveryModule().getLiverySource(airlinesModule().resolveAirline(callsign));

describe.skip("SPEC-0010 Dérives réelles (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("CA5 : resolves one distinct image source per airline of the list, and none for the others", () => {
    const { AIRLINES, UNKNOWN_AIRLINE, LIVERY_CODES } = airlinesModule();
    const { getLiverySource } = liveryModule();
    const sources = new Set<unknown>();
    for (const code of LIVERY_CODES) {
      const airline = AIRLINES.find((candidate) => candidate.code === code);
      expect(airline).toBeDefined();
      const source = getLiverySource(airline as Airline);
      expect(source).not.toBeNull();
      sources.add(source);
    }
    expect(sources.size).toBe(LIVERY_CODES.length);
    for (const airline of AIRLINES.filter((candidate) => !LIVERY_CODES.includes(candidate.code))) {
      expect(getLiverySource(airline)).toBeNull();
    }
    expect(getLiverySource(UNKNOWN_AIRLINE)).toBeNull();
  });

  it("CA6 : replaces the generic tail by the livery on a passage card", async () => {
    const harness = setup([OVERHEAD_AFR, INBOUND_RYR]);
    await render(<harness.App />);
    await settle();
    const image = livery("4ca7b2");
    expect(image).toBeOnTheScreen();
    expect(image?.props.source).toEqual(expectedSource("RYR7KM"));
    expect(image?.props.accessibilityLabel).toBe(expectedLabel("RYR7KM"));
    expect(within(screen.getByTestId("passage-card-4ca7b2")).getByTestId("passage-livery-4ca7b2")).toBeOnTheScreen();
    expect(tail("4ca7b2")).toBeNull();
  });

  it("CA7 : shows the livery on the overhead card, with the same test ids", async () => {
    const harness = setup([OVERHEAD_AFR, INBOUND_RYR]);
    await render(<harness.App />);
    await settle();
    const image = livery("3944ed");
    expect(image).toBeOnTheScreen();
    expect(image?.props.source).toEqual(expectedSource("AFR1015"));
    expect(image?.props.accessibilityLabel).toBe(expectedLabel("AFR1015"));
    expect(within(screen.getByTestId("passage-card-3944ed")).getByTestId("passage-livery-3944ed")).toBeOnTheScreen();
    expect(tail("3944ed")).toBeNull();
  });

  it("CA8 : shows the livery on Ciel instead of the generic tail", async () => {
    const harness = setup([OVERHEAD_AFR, INBOUND_RYR]);
    await render(<harness.App />);
    await settle();
    const image = screen.getByTestId("ciel-livery");
    expect(image.props.source).toEqual(expectedSource("AFR1015"));
    expect(image.props.accessibilityLabel).toBe(expectedLabel("AFR1015"));
    expect(screen.queryByTestId("ciel-tail")).toBeNull();
  });

  it("CA9 : keeps the generic tail without livery for unknown or callsign-less aircraft", async () => {
    const harness = setup([OVERHEAD_UNKNOWN, INBOUND_UNKNOWN, INBOUND_NOLIVERY, INBOUND_PRIVATE]);
    await render(<harness.App />);
    await settle();
    for (const hex of ["3944ed", "a0b1c2", "406a11", "a0b1c3"]) {
      expect(screen.getByTestId(`passage-card-${hex}`)).toBeOnTheScreen();
      expect(livery(hex)).toBeNull();
      expect(tail(hex)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId("ciel-livery")).toBeNull();
    expect(screen.getByTestId("ciel-tail")).toBeOnTheScreen();
  });

  it("CA10 : leaves the airline colours of the card untouched when a livery is shown", async () => {
    const harness = setup([OVERHEAD_AFR, INBOUND_RYR]);
    await render(<harness.App />);
    await settle();
    const { resolveAirline, airlineTheme } = airlinesModule();
    for (const [hex, callsign] of [
      ["3944ed", "AFR1015"],
      ["4ca7b2", "RYR7KM"],
    ] as const) {
      const theme = airlineTheme(resolveAirline(callsign));
      expect(livery(hex)).toBeOnTheScreen();
      expect(StyleSheet.flatten(screen.getByTestId(`passage-card-${hex}`).props.style).backgroundColor).toBe(theme.bg);
    }
    // Même géométrie que SPEC-0006 (CA12) : entrée dans la fenêtre à 175,5 s, compte à rebours 02:56.
    const rynairTheme = airlineTheme(resolveAirline("RYR7KM"));
    const rynairCard = within(screen.getByTestId("passage-card-4ca7b2"));
    expect(StyleSheet.flatten(rynairCard.getByText("02:56").props.style).color).toBe(rynairTheme.big);
    expect(StyleSheet.flatten(rynairCard.getByText("Passe à").props.style).color).toBe(rynairTheme.small);
  });

  it("CA11 : follows the aircraft when a refresh changes the airline shown", async () => {
    const harness = setup([OVERHEAD_AFR, INBOUND_RYR]);
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("ciel-livery").props.source).toEqual(expectedSource("AFR1015"));
    expect(livery("4ca7b2")?.props.source).toEqual(expectedSource("RYR7KM"));

    // Le survol devient un avion sans livrée, et l'avion à venir change de compagnie (même `hex`).
    harness.adsb.setAircraft([OVERHEAD_UNKNOWN, plane("4ca7b2", "EZY4617", -40.1, 0)]);
    await act(async () => {
      harness.lifecycle.enterForeground();
    });
    await settle();
    expect(screen.queryByTestId("ciel-livery")).toBeNull();
    expect(screen.getByTestId("ciel-tail")).toBeOnTheScreen();
    expect(livery("3944ed")).toBeNull();
    expect(tail("3944ed")).toBeOnTheScreen();
    expect(livery("4ca7b2")?.props.source).toEqual(expectedSource("EZY4617"));
    expect(livery("4ca7b2")?.props.accessibilityLabel).toBe(expectedLabel("EZY4617"));
  });

  it("CA12 : shows liveries without any network request, error report or log", async () => {
    const fetchSpy = jest.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const logs = (["log", "info", "warn", "error"] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
    const prefetch = jest.spyOn(Image, "prefetch").mockResolvedValue(true);
    const queryCache = jest.spyOn(Image, "queryCache").mockResolvedValue({});
    try {
      const harness = setup([OVERHEAD_AFR, INBOUND_RYR]);
      await render(<harness.App />);
      await settle();
      expect(screen.getByTestId("ciel-livery")).toBeOnTheScreen();
      expect(livery("4ca7b2")).toBeOnTheScreen();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(prefetch).not.toHaveBeenCalled();
      expect(queryCache).not.toHaveBeenCalled();
      expect(harness.monitoring.events).toEqual([]);
      for (const spy of logs) expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
