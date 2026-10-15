import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { createApp } from "../../src/app";
import { type AdsbQuery, type AdsbSource, type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { AppError } from "../../src/shared/errors";
import type { LocationPermission, LocationService, Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0004 (crochet useScene) : parcours de bout en bout sous createApp, avec d'autres données
// que le contrat. Ils s'activent seuls quand aucun fichier de contrat de la spec n'a plus de `.skip`.

interface Passage {
  hex: string;
  passageTimeMs: number;
  trackDeg: number;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
type SceneState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; scene: Scene; snapshotAtMs: number; nowMs: number };
interface SceneView {
  state: SceneState;
  headingDeg: number | null;
  refresh(): void;
}
interface SceneModule {
  useScene(): SceneView;
  arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null;
}
interface LifecycleModule {
  createFakeLifecycle(): { onForeground(listener: () => void): () => void; enterForeground(): void };
}
const sceneModule = () => jest.requireActual<SceneModule>("../../src/shared/scene");
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");

// Observateur à Tokyo (est, nord) : positions à 5 décimales pour exercer l'arrondi à 3 décimales.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const TOKYO: Position = { latitude: 35.68123, longitude: 139.76719 };
const NOW = 1_795_000_000_000;
const SECOND = 1000;

function plane(hex: string, eastKm: number, northKm: number, trackDeg: number, groundSpeedKmh: number): Aircraft {
  return {
    hex,
    callsign: null,
    latitude: TOKYO.latitude + northKm / KM_PER_DEGREE,
    longitude: TOKYO.longitude + eastKm / (KM_PER_DEGREE * Math.cos((TOKYO.latitude * Math.PI) / 180)),
    altitudeM: 11_000,
    groundSpeedKmh,
    trackDeg,
  };
}

function setup(options: { permission: LocationPermission; aircraft: Aircraft[]; withLifecycle?: boolean }) {
  const clock = createFakeClock(NOW);
  const source = createFakeAdsbSource(options.aircraft);
  const queries: AdsbQuery[] = [];
  const adsb: AdsbSource = {
    fetchAircraft(query) {
      queries.push({ ...query });
      return source.fetchAircraft(query);
    },
  };
  const state = { permission: options.permission, position: TOKYO, positionReads: 0 };
  const listeners = new Set<(degrees: number) => void>();
  const location: LocationService = {
    requestPermission: async () => state.permission,
    async getPosition() {
      if (state.permission !== "granted") throw new AppError("LOCATION_DENIED", "Location permission denied");
      state.positionReads += 1;
      return { ...state.position };
    },
    watchHeading(onHeading) {
      listeners.add(onHeading);
      return () => {
        listeners.delete(onHeading);
      };
    },
  };
  const monitoring = createFakeErrorReporter();
  const lifecycle = options.withLifecycle ? lifecycleModule().createFakeLifecycle() : undefined;
  const services = { clock, location, adsb, monitoring, ...(lifecycle ? { lifecycle } : {}) };
  const App = createApp({ services, features: [{ name: "probe", order: 1, screen: ProbeScreen }] });
  return {
    App,
    clock,
    source,
    queries,
    state,
    monitoring,
    lifecycle,
    emitHeading: (degrees: number) => {
      for (const listener of [...listeners]) listener(degrees);
    },
  };
}

let latestRefresh: () => void = () => undefined;
function ProbeScreen() {
  const { useScene } = sceneModule();
  const current = useScene();
  latestRefresh = current.refresh;
  return <Text testID="view">{JSON.stringify({ state: current.state, headingDeg: current.headingDeg })}</Text>;
}

function view(): { state: SceneState; headingDeg: number | null } {
  return JSON.parse(String(screen.getByTestId("view").props.children));
}

function readyScene(): Scene {
  const { state } = view();
  if (state.status !== "ready") throw new TypeError(`expected a ready scene, got ${state.status}`);
  return state.scene;
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

describe("SPEC-0004 hidden scenarios (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("watches an aircraft arrive, fly over and leave, with the arrow following the phone", async () => {
    // u1 arrive du sud à 540 km/h : entre dans la fenêtre à +167 s, en sort à +233 s.
    const harness = setup({ permission: "granted", aircraft: [plane("u1", 0, -30, 0, 540)] });
    await render(<harness.App />);
    await settle();
    expect(harness.queries).toEqual([{ latitude: 35.681, longitude: 139.767, radiusKm: 80 }]);
    expect(readyScene().overhead).toBeNull();
    const [upcoming] = readyScene().upcoming;
    expect(upcoming?.hex).toBe("u1");
    expect(Math.abs((upcoming?.passageTimeMs ?? 0) - (NOW + 167 * SECOND))).toBeLessThanOrEqual(SECOND);

    for (let second = 0; second < 160; second += 1) await elapse(harness.clock, SECOND);
    expect(readyScene().overhead).toBeNull();
    for (let second = 0; second < 10; second += 1) await elapse(harness.clock, SECOND);
    expect(readyScene().overhead?.hex).toBe("u1");
    expect(readyScene().upcoming).toEqual([]);

    await act(async () => {
      harness.emitHeading(30);
    });
    const { arrowAngleDeg } = sceneModule();
    const trackDeg = readyScene().overhead?.trackDeg ?? -1;
    expect(view().headingDeg).toBe(30);
    expect(arrowAngleDeg(trackDeg, view().headingDeg)).toBe(330);

    for (let second = 0; second < 70; second += 1) await elapse(harness.clock, SECOND);
    expect(readyScene()).toEqual({ overhead: null, upcoming: [] });
  });

  it("goes from refused to ready through the settings, then survives a source failure and a new refusal", async () => {
    const harness = setup({
      permission: "denied",
      aircraft: [plane("v1", 35, 0, 270, 700), plane("v2", -50, 2, 90, 800)],
      withLifecycle: true,
    });
    await render(<harness.App />);
    await settle();
    expect(view().state).toEqual({ status: "denied" });
    expect(harness.queries).toEqual([]);

    harness.state.permission = "granted";
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(view().state.status).toBe("ready");
    expect(readyScene().upcoming.map((passage) => passage.hex)).toEqual(["v1", "v2"]);
    expect(harness.queries).toHaveLength(1);

    harness.source.setUnavailable(true);
    await act(async () => {
      latestRefresh();
    });
    await settle();
    await elapse(harness.clock, 5 * SECOND);
    expect(view().state.status).toBe("ready");
    expect(readyScene().upcoming).toHaveLength(2);

    harness.state.permission = "denied";
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(view().state).toEqual({ status: "denied" });
    expect(harness.queries).toHaveLength(2);
    expect(harness.monitoring.events).toEqual([]);
    expect(JSON.stringify(view())).not.toMatch(/35\.68|139\.76/);
  });
});
