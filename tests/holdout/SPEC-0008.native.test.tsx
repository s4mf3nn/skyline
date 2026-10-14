import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createApp } from "../../src/app";
import { type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { AppError } from "../../src/shared/errors";
import type { LocationPermission, LocationService, Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0008 (Jest) : parcours complets de l'observateur sous l'application, avec les faux.
interface FeatureModule {
  feature: Parameters<typeof createApp>[0]["features"] extends readonly (infer F)[] | undefined ? F : never;
}
const passages = () => jest.requireActual<FeatureModule>("../../src/features/passages").feature;
const lifecycle = () =>
  jest
    .requireActual<{
      createFakeLifecycle(): {
        onForeground(l: () => void): () => void;
        onBackground(l: () => void): () => void;
        enterForeground(): void;
      };
    }>("../../src/shared/lifecycle")
    .createFakeLifecycle();
const settings = (failing: boolean) =>
  jest
    .requireActual<{
      createFakeSystemSettings(o: { failing: boolean }): { openSettings(): Promise<void>; readonly openCount: number };
    }>("../../src/shared/system-settings")
    .createFakeSystemSettings({ failing });

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 48.8566, longitude: 2.3522 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;

function plane(hex: string, eastKm: number, northKm: number, speedKmh = 720): Aircraft {
  return {
    hex,
    callsign: "KLM1234",
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
    altitudeM: 9000,
    groundSpeedKmh: speedKmh,
    trackDeg: 90,
  };
}

function setup(options: {
  aircraft: Aircraft[];
  permission: LocationPermission;
  unavailable?: boolean;
  failing?: boolean;
}) {
  const clock = createFakeClock(NOW);
  const source = createFakeAdsbSource(options.aircraft);
  source.setUnavailable(options.unavailable ?? false);
  const permission = { current: options.permission };
  const location: LocationService = {
    requestPermission: async () => permission.current,
    async getPosition() {
      if (permission.current !== "granted") throw new AppError("LOCATION_DENIED", "Location permission denied");
      return { ...OBSERVER };
    },
    watchHeading: () => () => undefined,
  };
  const monitoring = createFakeErrorReporter();
  const life = lifecycle();
  const system = settings(options.failing ?? false);
  // Variable intermédiaire : `lifecycle` et `systemSettings` ne sont pas encore des champs d'`AppServices`.
  const services = { clock, location, adsb: source, monitoring, lifecycle: life, systemSettings: system };
  const App = createApp({ services, features: [passages()] });
  return { App, clock, source, permission, monitoring, life, system };
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
const cards = () => screen.queryAllByTestId(/^passage-card-/).length;

describe("SPEC-0008 hidden scenarios (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("goes from offline, to empty, to a card, as the source recovers and then sees a plane", async () => {
    const harness = setup({ aircraft: [], permission: "granted", unavailable: true });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-unavailable")).toBeOnTheScreen();

    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("passages-notice-unavailable")).toBeNull();
    expect(screen.getByTestId("passages-notice-empty")).toBeOnTheScreen();

    harness.source.setAircraft([plane("c9", -25.1, 0.5)]);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("passages-notice-empty")).toBeNull();
    expect(cards()).toBe(1);
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();
  });

  it("measures staleness from the latest success, not from the first one", async () => {
    const harness = setup({ aircraft: [plane("s2", -1, 1.5, 20)], permission: "granted" });
    await render(<harness.App />);
    await settle();

    harness.source.setUnavailable(true);
    await elapse(harness.clock, 170 * SECOND);
    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    harness.source.setUnavailable(true);
    // 180 s après la première réponse, mais 10 s seulement après la dernière réussie.
    await elapse(harness.clock, 170 * SECOND);
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();
    expect(cards()).toBe(1);
  });

  it("walks a refused observer through the settings, a failing settings call, and the permission granted back", async () => {
    const harness = setup({
      aircraft: [plane("c9", -25.1, 0.5)],
      permission: "denied",
      failing: true,
    });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-denied")).toBeOnTheScreen();
    expect(harness.source.queries).toHaveLength(0);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Ouvrir les réglages" }));
    });
    await settle();
    expect(harness.system.openCount).toBe(1);
    expect(screen.getByTestId("passages-notice-denied")).toBeOnTheScreen();

    harness.permission.current = "granted";
    await act(async () => {
      harness.life.enterForeground();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByTestId("passages-notice-denied")).toBeNull();
    expect(cards()).toBe(1);
    expect(harness.monitoring.events).toHaveLength(0);
  });
});
