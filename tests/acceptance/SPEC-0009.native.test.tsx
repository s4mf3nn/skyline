import { act, render, screen, within } from "@testing-library/react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";
import type { FlightLookup } from "../../src/shared/routes";

// Contrat de SPEC-0009, partie écran (Jest, `jest-expo` et React Native Testing Library) : le bloc route et le type
// d'appareil sur Ciel et sur les cartes de Prochains passages, montés par `createApp` avec les faux de src/shared/.
// Le client adsbdb.com, le cache et les estimations sont joués par SPEC-0009.test.ts (Vitest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés à l'exécution, types du contrat recopiés ici.
interface Airport {
  iata: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface FlightRoute {
  origin: Airport;
  destination: Airport;
}
interface RouteSource {
  fetchRoute(callsign: string): Promise<FlightRoute | null>;
  fetchAircraftType(hex: string): Promise<string | null>;
}
interface FakeRouteSource extends RouteSource {
  readonly routeRequests: string[];
  readonly typeRequests: string[];
  setUnavailable(unavailable: boolean): void;
  holdResponses(): void;
  releaseResponses(): void;
}
interface RoutesModule {
  createFakeRouteSource(data?: {
    routes?: Record<string, FlightRoute | null>;
    aircraftTypes?: Record<string, string | null>;
  }): FakeRouteSource;
  createFlightLookup(input: { source: RouteSource; clock: { now(): number } }): FlightLookup;
  formatEstimatedArrival(timestampMs: number, timeZone: string): string;
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
const routesModule = () => jest.requireActual<RoutesModule>("../../src/shared/routes");
const passagesFeature = () => jest.requireActual<FeatureModule>("../../src/features/passages").feature;
const cielFeature = () => jest.requireActual<FeatureModule>("../../src/features/ciel").feature;
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km), 720 km/h = 0,2 km/s.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;
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
  overrides: Partial<Aircraft> = {},
): Aircraft {
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 10_000, groundSpeedKmh: 720, trackDeg: 90, ...overrides };
}

// Survol en cours : dans sa fenêtre de ±5 km dès le départ. Les aéroports sont sur son méridien : il a parcouru
// 121 km sur 484 (25 %) et il lui reste 363 km à 720 km/h, soit 1 815 s.
const OVERHEAD = plane("3944ed", "AFR1015", -1, 1);
const REMAINING_MS = 1_815 * SECOND;
const SPLIT_PARIS: FlightRoute = {
  origin: { iata: "SPU", city: "Split", ...at(-1, -120) },
  destination: { iata: "CDG", city: "Paris", ...at(-1, 364) },
};
// Passages à venir : entrent dans leur fenêtre après 175 s et 275 s.
const INBOUND = plane("4ca7b2", "RYR7KM", -40.1, 0);
const LATER = plane("406a11", "BAW117", -60.1, 0);
const PRIVATE = plane("a0b1c2", null, -50.1, 0.3);
const DISTANT = plane("111111", "FAR1", -200, 0);
const TYPES = { "3944ed": "A319 111", "4ca7b2": "B738", "406a11": "A20N", a0b1c2: "PA28", "111111": "A388" };

const DUSSELDORF: FlightRoute = {
  origin: { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55 },
  destination: { iata: "DUS", city: "Düsseldorf", latitude: 51.2895, longitude: 6.7668 },
};

interface SetupOptions {
  aircraft: Aircraft[];
  routes?: Record<string, FlightRoute | null>;
  aircraftTypes?: Record<string, string | null>;
  withRoutesService?: boolean;
  holdResponses?: boolean;
  unavailable?: boolean;
}

function setup(options: SetupOptions) {
  const { createFakeRouteSource, createFlightLookup } = routesModule();
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(options.aircraft);
  const location = createFakeLocation({ permission: "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const routeSource = createFakeRouteSource({
    routes: options.routes ?? {},
    aircraftTypes: options.aircraftTypes ?? {},
  });
  if (options.unavailable) routeSource.setUnavailable(true);
  if (options.holdResponses) routeSource.holdResponses();
  const base = { clock, location, adsb, monitoring, lifecycle };
  const services =
    options.withRoutesService === false
      ? base
      : { ...base, routes: createFlightLookup({ source: routeSource, clock }) };
  const App = createApp({ services, features: [cielFeature(), passagesFeature()] });
  return { App, clock, adsb, location, monitoring, lifecycle, routeSource };
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

const cardBlock = (hex: string) => screen.queryByTestId(`passage-route-${hex}`);
const arrivalAfter = (clock: { now(): number }) =>
  routesModule().formatEstimatedArrival(clock.now() + REMAINING_MS, TIME_ZONE);

describe.skip("SPEC-0009 Routes de vol (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("CA13 : shows no route and no aircraft type, and does not crash, without a routes service", async () => {
    const harness = setup({ aircraft: [OVERHEAD, INBOUND], withRoutesService: false });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passage-card-3944ed")).toBeOnTheScreen();
    expect(screen.getByTestId("passage-card-4ca7b2")).toBeOnTheScreen();
    expect(cardBlock("3944ed")).toBeNull();
    expect(cardBlock("4ca7b2")).toBeNull();
    for (const id of ["codes", "cities", "times", "departure", "arrival", "progress"]) {
      expect(screen.queryByTestId(`ciel-route-${id}`)).toBeNull();
    }
    expect(screen.getByTestId("ciel-aircraft-type")).toHaveTextContent("—");
  });

  it("CA14 : shows stacked codes, cities and the aircraft type on a passage card and on the overhead card", async () => {
    const harness = setup({
      aircraft: [OVERHEAD, INBOUND],
      routes: { AFR1015: SPLIT_PARIS, RYR7KM: DUSSELDORF },
      aircraftTypes: TYPES,
    });
    await render(<harness.App />);
    await settle();

    const upcoming = screen.getByTestId("passage-route-4ca7b2");
    expect(upcoming).toHaveTextContent(/CDG\s*DUS\s*Paris → Düsseldorf/);
    expect(within(screen.getByTestId("passage-card-4ca7b2")).getByText("B738")).toBeOnTheScreen();

    const overhead = screen.getByTestId("passage-route-3944ed");
    expect(overhead).toHaveTextContent(/SPU\s*CDG\s*Split → Paris/);
    expect(within(screen.getByTestId("passage-card-3944ed")).getByText("A319 111")).toBeOnTheScreen();
    expect(within(screen.getByTestId("passage-card-3944ed")).getByText("Au-dessus de vous")).toBeOnTheScreen();
  });

  it("CA15 : leaves the card as before for an unknown route, a missing callsign or an unavailable source", async () => {
    const harness = setup({
      aircraft: [OVERHEAD, INBOUND, PRIVATE],
      routes: { AFR1015: null },
      aircraftTypes: { "3944ed": null, "4ca7b2": "B738" },
      unavailable: true,
    });
    await render(<harness.App />);
    await settle();
    for (const hex of ["3944ed", "4ca7b2", "a0b1c2"]) {
      expect(screen.getByTestId(`passage-card-${hex}`)).toBeOnTheScreen();
      expect(cardBlock(hex)).toBeNull();
    }
    // Source indisponible : aucun type non plus, la colonne Appareil garde « — ».
    expect(within(screen.getByTestId("passage-card-4ca7b2")).queryByText("B738")).toBeNull();
    expect(within(screen.getByTestId("passage-card-4ca7b2")).getAllByText("—").length).toBeGreaterThan(0);

    harness.routeSource.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    // L'indicatif inconnu de la base reste sans bloc ; l'appareil connu montre son type.
    expect(cardBlock("3944ed")).toBeNull();
    expect(within(screen.getByTestId("passage-card-4ca7b2")).getByText("B738")).toBeOnTheScreen();
  });

  it("CA15 : shows each line only when complete: no codes without both codes, no cities without both cities", async () => {
    const noCode: FlightRoute = {
      origin: { iata: null, city: "Split", ...at(-1, -120) },
      destination: { iata: "CDG", city: "Paris", ...at(-1, 364) },
    };
    const noCity: FlightRoute = {
      origin: { iata: "CDG", city: "Paris", latitude: 49.0128, longitude: 2.55 },
      destination: { iata: "DUS", city: null, latitude: 51.2895, longitude: 6.7668 },
    };
    const harness = setup({ aircraft: [OVERHEAD, INBOUND], routes: { AFR1015: noCode, RYR7KM: noCity } });
    await render(<harness.App />);
    await settle();
    const first = screen.getByTestId("passage-route-3944ed");
    expect(first).toHaveTextContent("Split → Paris");
    expect(within(first).queryByText("CDG")).toBeNull();
    const second = screen.getByTestId("passage-route-4ca7b2");
    expect(second).toHaveTextContent(/CDG\s*DUS/);
    expect(within(second).queryByText(/→/)).toBeNull();
  });

  it("CA16 : shows the route, the estimated arrival, the progress bar and the type on Ciel", async () => {
    const harness = setup({ aircraft: [OVERHEAD], routes: { AFR1015: SPLIT_PARIS }, aircraftTypes: TYPES });
    await render(<harness.App />);
    await settle();

    expect(screen.getByTestId("ciel-route-codes")).toHaveTextContent(/SPU\s*CDG/);
    expect(screen.getByTestId("ciel-route-cities")).toHaveTextContent("Split → Paris");
    expect(screen.getByTestId("ciel-route-times")).toBeOnTheScreen();
    expect(screen.getByTestId("ciel-route-departure")).toHaveTextContent("—");
    expect(screen.getByTestId("ciel-route-arrival")).toHaveTextContent(arrivalAfter(harness.clock));
    expect(screen.getByTestId("ciel-aircraft-type")).toHaveTextContent("A319 111");

    const bar = screen.getByRole("progressbar", { name: "Progression du vol" });
    expect(bar).toBe(screen.getByTestId("ciel-route-progress"));
    expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 25 });

    // L'estimation suit l'heure : à chaque instantané elle est recalculée sur la position et l'heure courantes.
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.getByTestId("ciel-route-arrival")).toHaveTextContent(arrivalAfter(harness.clock));
    expect(screen.getByRole("progressbar", { name: "Progression du vol" }).props.accessibilityValue).toMatchObject({
      now: 25,
    });
  });

  it("CA17 : hides the route block on Ciel for an unknown route, and keeps what can still be known", async () => {
    const unknown = setup({ aircraft: [OVERHEAD], routes: { AFR1015: null }, aircraftTypes: { "3944ed": null } });
    const first = await render(<unknown.App />);
    await settle();
    for (const id of ["codes", "cities", "times", "departure", "arrival", "progress"]) {
      expect(screen.queryByTestId(`ciel-route-${id}`)).toBeNull();
    }
    expect(screen.getByTestId("ciel-aircraft-type")).toHaveTextContent("—");
    first.unmount();

    const withoutCoordinates: FlightRoute = {
      origin: { iata: "SPU", city: "Split", latitude: null, longitude: null },
      destination: { iata: "CDG", city: "Paris", latitude: null, longitude: null },
    };
    const partial = setup({ aircraft: [OVERHEAD], routes: { AFR1015: withoutCoordinates } });
    await render(<partial.App />);
    await settle();
    expect(screen.getByTestId("ciel-route-codes")).toHaveTextContent(/SPU\s*CDG/);
    expect(screen.getByTestId("ciel-route-cities")).toHaveTextContent("Split → Paris");
    expect(screen.queryByTestId("ciel-route-times")).toBeNull();
    expect(screen.queryByTestId("ciel-route-arrival")).toBeNull();
    expect(screen.queryByRole("progressbar", { name: "Progression du vol" })).toBeNull();
  });

  it("CA17 : shows each Ciel line only when complete: no codes without both codes, no cities without both cities", async () => {
    const noCode: FlightRoute = {
      origin: { iata: null, city: "Split", ...at(-1, -120) },
      destination: SPLIT_PARIS.destination,
    };
    const noCity: FlightRoute = {
      origin: SPLIT_PARIS.origin,
      destination: { iata: "CDG", city: null, ...at(-1, 364) },
    };
    const first = setup({ aircraft: [OVERHEAD], routes: { AFR1015: noCode } });
    const view = await render(<first.App />);
    await settle();
    expect(screen.queryByTestId("ciel-route-codes")).toBeNull();
    expect(screen.getByTestId("ciel-route-cities")).toHaveTextContent("Split → Paris");
    view.unmount();

    const second = setup({ aircraft: [OVERHEAD], routes: { AFR1015: noCity } });
    await render(<second.App />);
    await settle();
    expect(screen.getByTestId("ciel-route-codes")).toHaveTextContent(/SPU\s*CDG/);
    expect(screen.queryByTestId("ciel-route-cities")).toBeNull();
  });

  it("CA17 : shows the arrival without the progress bar when only the origin has no coordinates", async () => {
    const noOrigin: FlightRoute = {
      origin: { iata: "SPU", city: "Split", latitude: null, longitude: null },
      destination: SPLIT_PARIS.destination,
    };
    const harness = setup({ aircraft: [OVERHEAD], routes: { AFR1015: noOrigin } });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("ciel-route-arrival")).toHaveTextContent(arrivalAfter(harness.clock));
    expect(screen.queryByRole("progressbar", { name: "Progression du vol" })).toBeNull();
  });

  it("CA18 : does not hold the display for a route that has not answered yet, then shows it on the answer", async () => {
    const harness = setup({
      aircraft: [OVERHEAD, INBOUND],
      routes: { AFR1015: SPLIT_PARIS, RYR7KM: DUSSELDORF },
      aircraftTypes: TYPES,
      holdResponses: true,
    });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passage-card-3944ed")).toBeOnTheScreen();
    expect(screen.getByTestId("passage-card-4ca7b2")).toBeOnTheScreen();
    expect(screen.getByTestId("ciel-aircraft-type")).toHaveTextContent("—");
    expect(cardBlock("3944ed")).toBeNull();
    expect(screen.queryByTestId("ciel-route-codes")).toBeNull();
    expect(harness.routeSource.routeRequests).toEqual(expect.arrayContaining(["AFR1015", "RYR7KM"]));

    const sceneRequests = harness.adsb.queries.length;
    await act(async () => {
      harness.routeSource.releaseResponses();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(harness.adsb.queries).toHaveLength(sceneRequests);
    expect(cardBlock("3944ed")).not.toBeNull();
    expect(screen.getByTestId("ciel-route-codes")).toHaveTextContent(/SPU\s*CDG/);
    expect(screen.getByTestId("ciel-aircraft-type")).toHaveTextContent("A319 111");
  });

  it("CA19 : retries a failed route at the first refresh 10 s after the failure, and never asks a definitive one again", async () => {
    const harness = setup({
      aircraft: [OVERHEAD],
      routes: { AFR1015: SPLIT_PARIS },
      aircraftTypes: TYPES,
      unavailable: true,
    });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("ciel-route-codes")).toBeNull();
    expect(harness.routeSource.routeRequests).toEqual(["AFR1015"]);

    harness.routeSource.setUnavailable(false);
    await elapse(harness.clock, 9 * SECOND);
    expect(harness.routeSource.routeRequests).toEqual(["AFR1015"]);
    expect(screen.queryByTestId("ciel-route-codes")).toBeNull();

    await elapse(harness.clock, 1 * SECOND);
    expect(harness.routeSource.routeRequests).toEqual(["AFR1015", "AFR1015"]);
    expect(screen.getByTestId("ciel-route-codes")).toHaveTextContent(/SPU\s*CDG/);

    await elapse(harness.clock, 40 * SECOND);
    expect(harness.routeSource.routeRequests).toEqual(["AFR1015", "AFR1015"]);
    expect(harness.routeSource.typeRequests).toEqual(["3944ed", "3944ed"]);
  });

  it("CA20 : asks once per displayed aircraft, never for an aircraft the scene does not show", async () => {
    const harness = setup({
      aircraft: [OVERHEAD, INBOUND, LATER, PRIVATE, DISTANT],
      routes: { AFR1015: SPLIT_PARIS, RYR7KM: DUSSELDORF, BAW117: null, FAR1: DUSSELDORF },
      aircraftTypes: TYPES,
    });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 30 * SECOND);

    // Ciel et la carte « En ce moment » montrent le même avion : une seule demande.
    expect([...harness.routeSource.routeRequests].sort()).toEqual(["AFR1015", "BAW117", "RYR7KM"]);
    expect([...harness.routeSource.typeRequests].sort()).toEqual(["3944ed", "406a11", "4ca7b2", "a0b1c2"]);
    expect(harness.routeSource.routeRequests).not.toContain("FAR1");
    expect(harness.routeSource.typeRequests).not.toContain("111111");
    // L'avion sans indicatif montre son type, sans bloc route.
    expect(cardBlock("a0b1c2")).toBeNull();
    expect(within(screen.getByTestId("passage-card-a0b1c2")).getByText("PA28")).toBeOnTheScreen();
  });

  it("CA20 : asks nothing for the eleventh upcoming passage, which the scene does not show", async () => {
    // Onze passages à venir, entrant dans leur fenêtre un par un ; le plus lointain n'est pas dans les dix premiers.
    const fleet = Array.from({ length: 11 }, (_, index) =>
      plane(`5a00${String(index).padStart(2, "0")}`, `TST${String(index).padStart(2, "0")}`, -40.1 - index, 0),
    );
    const harness = setup({ aircraft: fleet });
    await render(<harness.App />);
    await settle();
    expect(screen.queryAllByTestId(/^passage-card-/)).toHaveLength(10);
    expect(harness.routeSource.routeRequests).toHaveLength(10);
    expect(harness.routeSource.routeRequests).not.toContain("TST10");
    expect(harness.routeSource.typeRequests).not.toContain("5a0010");
  });

  it("CA21 : sends nothing to the error tracker, logs nothing, and gives the source only callsigns and addresses", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      const harness = setup({
        aircraft: [OVERHEAD, INBOUND, PRIVATE],
        routes: { AFR1015: SPLIT_PARIS, RYR7KM: DUSSELDORF },
        aircraftTypes: TYPES,
        unavailable: true,
      });
      await render(<harness.App />);
      await settle();
      await act(async () => {
        harness.location.setHeading(45);
      });
      await elapse(harness.clock, 30 * SECOND);
      harness.routeSource.setUnavailable(false);
      await elapse(harness.clock, 30 * SECOND);
      await act(async () => {
        harness.lifecycle.enterForeground();
      });
      await settle();

      expect(harness.monitoring.events).toEqual([]);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      for (const callsign of harness.routeSource.routeRequests) expect(callsign).toMatch(/^[A-Z0-9]{2,8}$/);
      for (const hex of harness.routeSource.typeRequests) expect(hex).toMatch(/^[0-9a-f]{6}$/);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
