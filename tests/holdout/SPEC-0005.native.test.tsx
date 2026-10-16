import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createApp, type Feature } from "../../src/app";
import { type AdsbQuery, type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0005 (Jest) : parcours de bout en bout de Ciel dans l'application, avec d'autres avions que
// les tests de contrat. Actifs seuls (pas de `.skip`).

const cielFeature = () => jest.requireActual<{ feature: Feature }>("../../src/features/ciel").feature;
const passagesFeature = () => jest.requireActual<{ feature: Feature }>("../../src/features/passages").feature;
const lifecycleModule = () =>
  jest.requireActual<{
    createFakeLifecycle(): { onForeground(listener: () => void): () => void; enterForeground(): void };
  }>("../../src/shared/lifecycle");

// Plan local autour de l'observateur en km, 720 km/h = 0,2 km/s (fenêtre de ±5 km : 50 s), heures à mi-seconde.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 43.60465, longitude: 1.44425 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;

function at(eastKm: number, northKm: number): Position {
  return {
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  };
}

function plane(hex: string, callsign: string, eastKm: number, northKm: number, trackDeg: number): Aircraft {
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 8200, groundSpeedKmh: 720, trackDeg };
}

// `a1` vole vers le nord : dans sa fenêtre maintenant, jusqu'à +39,5 s. `b2` (vers l'ouest) y entre à +75,5 s
// et en sort à +125,5 s.
const FIRST = plane("a1", "EZY1234", 1, -2.9, 0);
const SECOND_PLANE = plane("b2", "TAP458", 20.1, 0.5, 270);

/** Avance un avion en ligne droite de `seconds` (vitesse sol et cap suivi, plan local) ; inchangé sans l'un des deux. */
function advanceAircraft(aircraft: Aircraft, seconds: number): Aircraft {
  if (aircraft.groundSpeedKmh === null || aircraft.trackDeg === null || seconds === 0) return aircraft;
  const distanceKm = (aircraft.groundSpeedKmh / 3600) * seconds;
  const track = (aircraft.trackDeg * Math.PI) / 180;
  return {
    ...aircraft,
    latitude: aircraft.latitude + (distanceKm * Math.cos(track)) / KM_PER_DEGREE,
    longitude:
      aircraft.longitude +
      (distanceKm * Math.sin(track)) / (KM_PER_DEGREE * Math.cos((aircraft.latitude * Math.PI) / 180)),
  };
}

/**
 * Source ADS-B factice dont les avions avancent avec l'horloge factice : la liste donnée (ou posée par `setAircraft`)
 * est celle de l'instant courant, et chaque réponse l'extrapole jusqu'à l'heure de la requête. Le rafraîchissement
 * toutes les 10 s (SPEC-0007) relit ainsi une source cohérente avec le temps écoulé.
 */
function createMovingSource(clock: { now(): number }, aircraft: Aircraft[]) {
  const fake = createFakeAdsbSource(aircraft);
  let anchorMs = clock.now();
  return {
    ...fake,
    setAircraft(next: Aircraft[]) {
      anchorMs = clock.now();
      fake.setAircraft(next);
    },
    async fetchAircraft(query: AdsbQuery) {
      const answer = await fake.fetchAircraft(query);
      const seconds = (clock.now() - anchorMs) / 1000;
      return answer.map((item) => advanceAircraft(item, seconds));
    },
  };
}

function setup(aircraft: Aircraft[]) {
  const clock = createFakeClock(NOW);
  const adsb = createMovingSource(clock, aircraft);
  const location = createFakeLocation({ permission: "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const App = createApp({
    services: { clock, location, adsb, monitoring, lifecycle },
    features: [passagesFeature(), cielFeature()],
  });
  return { App, clock };
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
const pagerElement = () => screen.getByRole("adjustable", { name: "Indicateur de page" });
const slide = (name: "increment" | "decrement") =>
  fireEvent(pagerElement(), "accessibilityAction", { nativeEvent: { actionName: name } });

describe("SPEC-0005 scénarios cachés : écran Ciel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("orders the pages by order, whatever the registry order, and shows the overhead aircraft on Ciel", async () => {
    const harness = setup([FIRST]);
    await render(<harness.App />);
    await settle();
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    await slide("decrement");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    expect(screen.getByTestId("sky-value-flight")).toHaveTextContent("U21234");
    expect(screen.getByTestId("sky-value-heading")).toHaveTextContent("N");
  });

  it("stays on the passages through two successive overflies, then keeps a single page", async () => {
    const harness = setup([FIRST, SECOND_PLANE]);
    await render(<harness.App />);
    await settle();
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });

    await elapse(harness.clock, 40 * SECOND);
    expect(screen.queryByTestId("sky-screen")).toBeNull();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();

    await elapse(harness.clock, 70 * SECOND);
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    expect(screen.getByTestId("sky-screen")).toBeOnTheScreen();

    await elapse(harness.clock, 50 * SECOND);
    expect(screen.queryByTestId("sky-screen")).toBeNull();
    expect(screen.queryByLabelText("Indicateur de page")).toBeNull();
  });

  it("keeps the retained aircraft while the observer stays, and shows the next one without a page change", async () => {
    const harness = setup([FIRST, SECOND_PLANE]);
    await render(<harness.App />);
    await settle();
    await slide("decrement");

    await elapse(harness.clock, 60 * SECOND);
    expect(screen.getByTestId("sky-value-flight")).toHaveTextContent("U21234");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });

    await elapse(harness.clock, 50 * SECOND);
    expect(screen.getByTestId("sky-value-flight")).toHaveTextContent("TP458");
    expect(screen.getByTestId("sky-value-heading")).toHaveTextContent("O");
    expect(pagerElement()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
  });
});
