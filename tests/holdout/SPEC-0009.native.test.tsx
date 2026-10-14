import { act, render, screen, within } from "@testing-library/react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0009 (Jest) : parcours d'affichage de la route avec d'autres données que le contrat.
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
interface FakeRouteSource {
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
  createFlightLookup(input: { source: unknown; clock: { now(): number } }): unknown;
  formatEstimatedArrival(timestampMs: number, timeZone: string): string;
}
interface FeatureModule {
  feature: Feature;
}
interface LifecycleModule {
  createFakeLifecycle(): { onForeground(listener: () => void): () => void; enterForeground(): void };
}
const routesModule = () => jest.requireActual<RoutesModule>("../../src/shared/routes");
const passagesFeature = () => jest.requireActual<FeatureModule>("../../src/features/passages").feature;
const cielFeature = () => jest.requireActual<FeatureModule>("../../src/features/ciel").feature;
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 48.8566, longitude: 2.3522 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function at(eastKm: number, northKm: number): Position {
  return {
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  };
}

function plane(hex: string, callsign: string | null, eastKm: number, northKm: number, trackDeg: number): Aircraft {
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 9_000, groundSpeedKmh: 800, trackDeg };
}

// Survol en cours à 1,5 km, cap ouest, 800 km/h. Aéroports sur son méridien : 100 km parcourus, 210 km restants
// (progression 32 %, arrivée dans 945 s).
const OVERHEAD = plane("4b1805", "SWR1234", 2, -1.5, 270);
const REMAINING_MS = 945 * SECOND;
const ZURICH_LISBON: FlightRoute = {
  origin: { iata: "ZRH", city: "Zurich", ...at(2, 98.5) },
  destination: { iata: "LIS", city: "Lisbonne", ...at(2, -211.5) },
};
// Deux avions de même indicatif (vol répété) : l'un survole, l'autre arrive.
const TWIN = plane("4b1806", "SWR1234", 45.1, 0.2, 270);
const OTHER = plane("3c6444", "DLH9XY", 60.1, 0.1, 270);

function setup(aircraft: Aircraft[], data: Parameters<RoutesModule["createFakeRouteSource"]>[0]) {
  const { createFakeRouteSource, createFlightLookup } = routesModule();
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(aircraft);
  const location = createFakeLocation({ permission: "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const routeSource = createFakeRouteSource(data);
  const routes = createFlightLookup({ source: routeSource, clock });
  const services = { clock, location, adsb, monitoring, lifecycle, routes };
  const App = createApp({ services, features: [cielFeature(), passagesFeature()] });
  return { App, clock, adsb, monitoring, routeSource };
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

describe("SPEC-0009 hidden scenarios (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("follows a flight from first sight to a complete route: pending, outage, then the same block on both screens", async () => {
    const harness = setup([OVERHEAD, OTHER], {
      routes: { SWR1234: ZURICH_LISBON, DLH9XY: null },
      aircraftTypes: { "4b1805": "A220-300", "3c6444": null },
    });
    harness.routeSource.setUnavailable(true);
    harness.routeSource.holdResponses();
    await render(<harness.App />);
    await settle();

    // Réponse en attente : tout est déjà à l'écran, sans route.
    expect(screen.getByTestId("passage-card-4b1805")).toBeOnTheScreen();
    expect(screen.getByTestId("passage-card-3c6444")).toBeOnTheScreen();
    expect(screen.queryByTestId("passage-route-4b1805")).toBeNull();
    expect(screen.queryByTestId("ciel-route-codes")).toBeNull();

    // La réponse arrive : c'est une panne. Toujours rien, et l'affichage tient.
    await act(async () => {
      harness.routeSource.releaseResponses();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByTestId("passage-route-4b1805")).toBeNull();
    expect(screen.getByTestId("ciel-aircraft-type")).toHaveTextContent("—");

    harness.routeSource.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);

    expect(screen.getByTestId("passage-route-4b1805")).toHaveTextContent(/ZRH\s*LIS\s*Zurich → Lisbonne/);
    expect(screen.getByTestId("ciel-route-codes")).toHaveTextContent(/ZRH\s*LIS/);
    expect(screen.getByTestId("ciel-route-cities")).toHaveTextContent("Zurich → Lisbonne");
    expect(screen.getByTestId("ciel-route-arrival")).toHaveTextContent(
      routesModule().formatEstimatedArrival(harness.clock.now() + REMAINING_MS, TIME_ZONE),
    );
    expect(screen.getByRole("progressbar", { name: "Progression du vol" }).props.accessibilityValue).toMatchObject({
      now: 32,
    });
    expect(within(screen.getByTestId("passage-card-4b1805")).getByText("A220-300")).toBeOnTheScreen();
    // Indicatif inconnu de la base : pas de bloc, la carte reste complète.
    expect(screen.queryByTestId("passage-route-3c6444")).toBeNull();
    expect(screen.getByTestId("passage-card-3c6444")).toBeOnTheScreen();
    expect(harness.monitoring.events).toEqual([]);
  });

  it("asks once for two aircraft sharing a callsign and shows the same route on both, then follows a swapped scene", async () => {
    const harness = setup([OVERHEAD, TWIN], {
      routes: {
        SWR1234: ZURICH_LISBON,
        DLH9XY: { ...ZURICH_LISBON, destination: { ...ZURICH_LISBON.destination, iata: "OPO", city: "Porto" } },
      },
      aircraftTypes: { "4b1805": "A220-300", "4b1806": "BCS3", "3c6444": "A321" },
    });
    await render(<harness.App />);
    await settle();

    expect(harness.routeSource.routeRequests).toEqual(["SWR1234"]);
    expect([...harness.routeSource.typeRequests].sort()).toEqual(["4b1805", "4b1806"]);
    expect(screen.getByTestId("passage-route-4b1805")).toHaveTextContent(/ZRH\s*LIS\s*Zurich → Lisbonne/);
    expect(screen.getByTestId("passage-route-4b1806")).toHaveTextContent(/ZRH\s*LIS\s*Zurich → Lisbonne/);
    expect(within(screen.getByTestId("passage-card-4b1806")).getByText("BCS3")).toBeOnTheScreen();

    // Le jeu d'avions change : l'ancien indicatif n'est pas redemandé, le nouveau l'est une fois.
    harness.adsb.setAircraft([OVERHEAD, OTHER]);
    await elapse(harness.clock, 10 * SECOND);
    await elapse(harness.clock, 10 * SECOND);
    expect(harness.routeSource.routeRequests).toEqual(["SWR1234", "DLH9XY"]);
    expect(screen.queryByTestId("passage-card-4b1806")).toBeNull();
    expect(screen.getByTestId("passage-route-3c6444")).toHaveTextContent(/ZRH\s*OPO\s*Zurich → Porto/);
    expect(screen.getByTestId("passage-route-4b1805")).toHaveTextContent(/ZRH\s*LIS/);
  });
});
