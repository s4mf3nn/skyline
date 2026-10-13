import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { createApp } from "../../src/app";
import { type AdsbQuery, type AdsbSource, type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { AppError } from "../../src/shared/errors";
import type { LocationPermission, LocationService, Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0007, partie rafraîchissement (Jest, `jest-expo` et React Native Testing Library) : le crochet
// useScene de SPEC-0004 est joué par un écran de sonde monté sous createApp, avec les faux de src/shared/.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

type SceneState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unavailable" }
  | {
      status: "ready";
      scene: { overhead: { hex: string } | null; upcoming: Array<{ hex: string }> };
      snapshotAtMs: number;
      nowMs: number;
    };
interface SceneModule {
  useScene(): { state: SceneState; headingDeg: number | null; refresh(): void };
}
interface AppLifecycle {
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
}
interface LifecycleModule {
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void; enterBackground(): void };
}
const sceneModule = () => jest.requireActual<SceneModule>("../../src/shared/scene");
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;

function plane(hex: string, eastKm: number, northKm: number, trackDeg: number, groundSpeedKmh: number): Aircraft {
  return {
    hex,
    callsign: hex.toUpperCase(),
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
    altitudeM: 10_000,
    groundSpeedKmh,
    trackDeg,
  };
}

// Un avion qui arrive de l'ouest, à 40 km, à 720 km/h : prévu dans environ 179 s, donc à venir pendant tout le test.
const INBOUND = plane("a1", -40, 0, 90, 720);

function stubLocation(initial: { permission: LocationPermission; position: Position }) {
  const state = { ...initial, permissionRequests: 0, positionReads: 0 };
  const service: LocationService = {
    async requestPermission() {
      state.permissionRequests += 1;
      return state.permission;
    },
    async getPosition() {
      if (state.permission !== "granted") throw new AppError("LOCATION_DENIED", "Location permission denied");
      state.positionReads += 1;
      return { ...state.position };
    },
    watchHeading() {
      return () => undefined;
    },
  };
  return { service, state };
}

interface SetupOptions {
  permission?: LocationPermission;
  aircraft?: Aircraft[];
  withLifecycle?: boolean;
  holdSource?: boolean;
  failing?: boolean;
}

function setup(options: SetupOptions = {}) {
  const clock = createFakeClock(NOW);
  const fakeSource = createFakeAdsbSource(options.aircraft ?? []);
  const queries: AdsbQuery[] = [];
  const pending: Array<() => void> = [];
  let holding = options.holdSource ?? false;
  let failure: Error | null = options.failing ? new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable") : null;
  const adsb: AdsbSource = {
    async fetchAircraft(query) {
      queries.push({ ...query });
      if (failure !== null) throw failure;
      const answer = await fakeSource.fetchAircraft(query);
      if (holding) await new Promise<void>((resolve) => pending.push(resolve));
      return answer;
    },
  };
  const location = stubLocation({ permission: options.permission ?? "granted", position: OBSERVER });
  const monitoring = createFakeErrorReporter();
  const lifecycle = options.withLifecycle === false ? undefined : lifecycleModule().createFakeLifecycle();
  const services = { clock, location: location.service, adsb, monitoring, ...(lifecycle ? { lifecycle } : {}) };
  const App = createApp({ services, features: [{ name: "probe", order: 1, screen: ProbeScreen }] });
  return {
    App,
    clock,
    queries,
    source: fakeSource,
    location,
    monitoring,
    lifecycle,
    release() {
      holding = false;
      for (const resolve of pending.splice(0)) resolve();
    },
    failWith(error: Error | null) {
      failure = error;
    },
  };
}

function ProbeScreen() {
  const { useScene } = sceneModule();
  const { state } = useScene();
  return <Text testID="view">{JSON.stringify(state)}</Text>;
}

function state(): SceneState {
  return JSON.parse(String(screen.getByTestId("view").props.children));
}

function readyState() {
  const current = state();
  if (current.status !== "ready") throw new TypeError(`expected a ready scene, got ${current.status}`);
  return current;
}

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

/** Avance l'horloge factice et les minuteurs, seconde par seconde, comme le temps réel. */
async function elapse(clock: { advance(ms: number): void }, seconds: number) {
  for (let second = 0; second < seconds; second += 1) {
    await act(async () => {
      clock.advance(SECOND);
      await jest.advanceTimersByTimeAsync(SECOND);
    });
  }
}

describe.skip("SPEC-0007 refresh (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("CA9 : queries the source again every 10 seconds with the last position, and replaces the snapshot without a loading state", async () => {
    const harness = setup({ aircraft: [INBOUND] });
    await render(<harness.App />);
    await settle();
    expect(harness.queries).toHaveLength(1);

    await elapse(harness.clock, 9);
    expect(harness.queries).toHaveLength(1);
    await elapse(harness.clock, 1);
    expect(harness.queries).toHaveLength(2);
    expect(harness.queries[1]).toEqual(harness.queries[0]);
    expect(harness.queries[1]).toEqual({ latitude: 45.764, longitude: 4.836, radiusKm: 80 });
    expect(readyState().snapshotAtMs).toBe(NOW + 10 * SECOND);

    harness.source.setAircraft([plane("b2", 40, 0, 270, 720)]);
    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(3);
    expect(readyState().snapshotAtMs).toBe(NOW + 20 * SECOND);
    expect(readyState().scene.upcoming.map((passage) => passage.hex)).toEqual(["b2"]);

    expect(harness.location.state.permissionRequests).toBe(1);
    expect(harness.location.state.positionReads).toBe(1);
  });

  it("CA9 : keeps refreshing without a lifecycle service", async () => {
    const harness = setup({ aircraft: [INBOUND], withLifecycle: false });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 30);
    expect(harness.queries).toHaveLength(4);
  });

  it("CA10 : never has two requests in flight, skips the missed deadline and resumes on the next one", async () => {
    const harness = setup({ aircraft: [INBOUND], holdSource: true });
    await render(<harness.App />);
    await settle();
    expect(state().status).toBe("loading");

    await elapse(harness.clock, 25);
    expect(harness.queries).toHaveLength(1);

    harness.release();
    await settle();
    expect(readyState().snapshotAtMs).toBe(NOW + 25 * SECOND);
    expect(harness.queries).toHaveLength(1);

    await elapse(harness.clock, 4);
    expect(harness.queries).toHaveLength(1);
    await elapse(harness.clock, 1);
    expect(harness.queries).toHaveLength(2);
  });

  it("CA11 : pauses in the background, then queries exactly once on return and restarts the cadence from there", async () => {
    const harness = setup({ aircraft: [INBOUND] });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(2);
    const before = readyState();

    harness.lifecycle?.enterBackground();
    await elapse(harness.clock, 60);
    expect(harness.queries).toHaveLength(2);
    expect(readyState().nowMs).toBe(before.nowMs);
    expect(readyState().snapshotAtMs).toBe(before.snapshotAtMs);

    harness.source.setAircraft([plane("b2", 40, 0, 270, 720)]);
    harness.lifecycle?.enterForeground();
    await settle();
    expect(harness.queries).toHaveLength(3);
    expect(harness.location.state.positionReads).toBe(2);
    expect(readyState().nowMs).toBe(NOW + 70 * SECOND);
    expect(readyState().snapshotAtMs).toBe(NOW + 70 * SECOND);
    expect(readyState().scene.upcoming.map((passage) => passage.hex)).toEqual(["b2"]);

    await elapse(harness.clock, 9);
    expect(harness.queries).toHaveLength(3);
    await elapse(harness.clock, 1);
    expect(harness.queries).toHaveLength(4);
  });

  it("CA12 : keeps the last scene and the cadence when a refresh fails, then recovers on the first success", async () => {
    const harness = setup({ aircraft: [INBOUND] });
    await render(<harness.App />);
    await settle();
    const first = readyState();

    harness.failWith(new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable"));
    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(2);
    expect(readyState().snapshotAtMs).toBe(first.snapshotAtMs);
    expect(readyState().nowMs).toBe(NOW + 10 * SECOND);
    expect(readyState().scene.upcoming.map((passage) => passage.hex)).toEqual(["a1"]);

    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(3);

    harness.failWith(null);
    harness.source.setAircraft([]);
    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(4);
    expect(readyState().snapshotAtMs).toBe(NOW + 30 * SECOND);
    expect(readyState().scene.upcoming).toEqual([]);
  });

  it("CA12 : stays unavailable and keeps retrying every 10 seconds until the first success, without reporting or logging", async () => {
    const logs = [
      jest.spyOn(console, "log"),
      jest.spyOn(console, "info"),
      jest.spyOn(console, "warn"),
      jest.spyOn(console, "error"),
    ];
    const harness = setup({ aircraft: [INBOUND], failing: true });
    await render(<harness.App />);
    await settle();
    expect(state().status).toBe("unavailable");

    await elapse(harness.clock, 20);
    expect(harness.queries).toHaveLength(3);
    expect(state().status).toBe("unavailable");

    harness.failWith(null);
    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(4);
    expect(readyState().scene.upcoming.map((passage) => passage.hex)).toEqual(["a1"]);

    expect(harness.monitoring.events).toEqual([]);
    for (const spy of logs) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/45\.7|4\.83/);
    }
  });

  it("CA13 : never queries while the permission is denied, and resumes the cadence once it is granted again", async () => {
    const harness = setup({ aircraft: [INBOUND], permission: "denied" });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 30);
    expect(state().status).toBe("denied");
    expect(harness.queries).toHaveLength(0);

    harness.location.state.permission = "granted";
    harness.lifecycle?.enterForeground();
    await settle();
    expect(harness.queries).toHaveLength(1);
    expect(state().status).toBe("ready");

    await elapse(harness.clock, 10);
    expect(harness.queries).toHaveLength(2);
  });

  it("CA14 : cancels the cadence when unmounted", async () => {
    const harness = setup({ aircraft: [INBOUND] });
    const view = await render(<harness.App />);
    await settle();
    expect(harness.queries).toHaveLength(1);

    view.unmount();
    await elapse(harness.clock, 40);
    expect(harness.queries).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
