import { act, render, screen } from "@testing-library/react-native";
import { createApp, type Feature } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation, type Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0010 (Jest) : parcours d'écran avec d'autres compagnies et d'autres avions que le contrat.
interface Airline {
  name: string;
}
interface AirlinesModule {
  resolveAirline(callsign: string | null): Airline;
}
interface LiveryModule {
  getLiverySource(airline: Airline): unknown;
}
interface FeatureModule {
  feature: Feature;
}
interface LifecycleModule {
  createFakeLifecycle(): { onForeground(listener: () => void): () => void; enterForeground(): void };
}
const airlines = () => jest.requireActual<AirlinesModule>("../../src/shared/airlines");
const liveryModule = () => jest.requireActual<LiveryModule>("../../src/shared/airlines/livery");
const passagesFeature = () => jest.requireActual<FeatureModule>("../../src/features/passages").feature;
const cielFeature = () => jest.requireActual<FeatureModule>("../../src/features/ciel").feature;
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 48.8566, longitude: 2.3522 };
const NOW = 1_800_000_000_000;

function at(eastKm: number, northKm: number): Position {
  return {
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  };
}

function plane(hex: string, callsign: string | null, eastKm: number, northKm: number): Aircraft {
  return { hex, callsign, ...at(eastKm, northKm), altitudeM: 11_000, groundSpeedKmh: 720, trackDeg: 90 };
}

function setup(aircraft: Aircraft[]) {
  const clock = createFakeClock(NOW);
  const adsb = createFakeAdsbSource(aircraft);
  const location = createFakeLocation({ permission: "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const services = { clock, location, adsb, monitoring, lifecycle };
  const App = createApp({ services, features: [cielFeature(), passagesFeature()] });
  return { App, adsb, lifecycle };
}

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
const refresh = async (harness: { lifecycle: { enterForeground(): void } }) => {
  await act(async () => {
    harness.lifecycle.enterForeground();
  });
  await settle();
};
const livery = (hex: string) => screen.queryByTestId(`passage-livery-${hex}`);
const tail = (hex: string) => screen.queryByTestId(`passage-tail-${hex}`);
const sourceOf = (callsign: string) => liveryModule().getLiverySource(airlines().resolveAirline(callsign));

describe("SPEC-0010 holdout : dérives réelles (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows liveries for IATA-form callsigns and falls back for a private flight, then drops the card cleanly", async () => {
    const harness = setup([
      plane("aa0001", "U24617", -30.1, 0),
      plane("aa0002", "KL1234", -45.1, 0.2),
      plane("aa0003", null, -60.1, 0.1),
    ]);
    await render(<harness.App />);
    await settle();
    expect(livery("aa0001")?.props.source).toEqual(sourceOf("EZY4617"));
    expect(livery("aa0002")?.props.source).toEqual(sourceOf("KLM1234"));
    expect(livery("aa0001")?.props.source).not.toEqual(livery("aa0002")?.props.source);
    expect(livery("aa0003")).toBeNull();
    expect(tail("aa0003")).toBeOnTheScreen();

    harness.adsb.setAircraft([plane("aa0002", "KL1234", -45.1, 0.2), plane("aa0003", null, -60.1, 0.1)]);
    await refresh(harness);
    expect(screen.queryByTestId("passage-card-aa0001")).toBeNull();
    expect(livery("aa0001")).toBeNull();
    expect(livery("aa0002")).toBeOnTheScreen();
  });

  it("makes the Ciel livery appear with the overhead aircraft and change with it, never keeping the previous one", async () => {
    const harness = setup([plane("bb0001", "IBE3456", -40.1, 0)]);
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("ciel-livery")).toBeNull();
    expect(livery("bb0001")?.props.source).toEqual(sourceOf("IBE3456"));

    harness.adsb.setAircraft([plane("bb0002", "DLH400", -1, 1)]);
    await refresh(harness);
    expect(screen.getByTestId("ciel-livery").props.source).toEqual(sourceOf("DLH400"));
    expect(livery("bb0002")?.props.source).toEqual(sourceOf("DLH400"));

    // Autre survol, d'une compagnie inconnue : la dérive générique remplace l'image.
    harness.adsb.setAircraft([plane("bb0003", "ZZZ812", -1, 1)]);
    await refresh(harness);
    expect(screen.queryByTestId("ciel-livery")).toBeNull();
    expect(screen.getByTestId("ciel-tail")).toBeOnTheScreen();
    expect(livery("bb0003")).toBeNull();
  });
});
