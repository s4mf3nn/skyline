import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { createApp } from "../../src/app";
import { type AdsbQuery, type AdsbSource, type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { AppError } from "../../src/shared/errors";
import type { LocationPermission, LocationService, Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0004, partie crochet useScene (Jest, `jest-expo` et React Native Testing Library) : le crochet est
// joué par un écran de sonde monté sous createApp, avec les faux de src/shared/.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec : chargés à l'exécution, avec les types du contrat d'interface recopiés ici.
type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
interface Passage {
  hex: string;
  passageTimeMs: number;
  windowEndMs: number;
  trackCardinal: CardinalPoint;
  arrivalCardinal: CardinalPoint;
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

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km), 720 km/h = 0,2 km/s.
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;

function at(origin: Position, eastKm: number, northKm: number): Position {
  return {
    latitude: origin.latitude + northKm / KM_PER_DEGREE,
    longitude: origin.longitude + eastKm / (KM_PER_DEGREE * Math.cos((origin.latitude * Math.PI) / 180)),
  };
}

function plane(hex: string, eastKm: number, northKm: number, trackDeg: number, groundSpeedKmh: number): Aircraft {
  return {
    hex,
    callsign: hex.toUpperCase(),
    ...at(OBSERVER, eastKm, northKm),
    altitudeM: 10_000,
    groundSpeedKmh,
    trackDeg,
  };
}

/** Localisation factice pilotable : permission et position modifiables, cap poussé à la main, lectures comptées. */
function stubLocation(initial: { permission: LocationPermission; position: Position }) {
  const state = { ...initial, permissionRequests: 0, positionReads: 0, positionFailure: null as Error | null };
  const listeners = new Set<(degrees: number) => void>();
  const service: LocationService = {
    async requestPermission() {
      state.permissionRequests += 1;
      return state.permission;
    },
    async getPosition() {
      if (state.permission !== "granted") throw new AppError("LOCATION_DENIED", "Location permission denied");
      if (state.positionFailure !== null) throw state.positionFailure;
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
  return {
    service,
    state,
    emitHeading(degrees: number) {
      for (const listener of [...listeners]) listener(degrees);
    },
    listenerCount: () => listeners.size,
  };
}

interface SetupOptions {
  permission?: LocationPermission;
  aircraft?: Aircraft[];
  withLifecycle?: boolean;
  /** Retient les réponses de la source ADS-B jusqu'à `release()` (ou `hold()` plus tard). */
  holdSource?: boolean;
}

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
 * toutes les 10 s (SPEC-0007) relit ainsi une source cohérente avec le temps écoulé, au lieu de remettre les avions à
 * leur position de départ.
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

function setup(options: SetupOptions = {}) {
  const clock = createFakeClock(NOW);
  const fakeSource = createMovingSource(clock, options.aircraft ?? []);
  const queries: AdsbQuery[] = [];
  // Réponses retenues, dans l'ordre des requêtes ; le contenu est figé à la requête, la réponse arrive plus tard.
  const pending: Array<() => void> = [];
  let holding = options.holdSource ?? false;
  let failure: Error | null = null;
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
  const lifecycle = options.withLifecycle ? lifecycleModule().createFakeLifecycle() : undefined;
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
    hold() {
      holding = true;
    },
    /** Cesse de retenir les réponses et libère toutes celles en attente. */
    release() {
      holding = false;
      for (const resolve of pending.splice(0)) resolve();
    },
    /** Libère une seule réponse retenue, par rang de requête. */
    releaseRequest(index: number) {
      pending[index]?.();
    },
    failWith(error: Error | null) {
      failure = error;
    },
  };
}

let latestRefresh: () => void = () => undefined;
function ProbeScreen() {
  const { useScene } = sceneModule();
  const view = useScene();
  latestRefresh = view.refresh;
  return <Text testID="view">{JSON.stringify({ state: view.state, headingDeg: view.headingDeg })}</Text>;
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

/** Avance l'horloge factice et les minuteurs de `ms`, comme le temps réel. */
const elapse = (clock: { advance(ms: number): void }, ms: number) =>
  act(async () => {
    clock.advance(ms);
    await jest.advanceTimersByTimeAsync(ms);
  });

function expectNear(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("SPEC-0004 useScene (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("CA12 : is loading until the source answers, then exposes the scene computed at the clock time", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], holdSource: true });
    await render(<harness.App />);
    await settle();
    expect(view().state.status).toBe("loading");
    expect(view().headingDeg).toBeNull();

    // La réponse arrive 4 s après la requête : l'instantané porte l'heure de la réponse.
    harness.clock.advance(4 * SECOND);
    harness.release();
    await settle();
    const { state } = view();
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.snapshotAtMs).toBe(NOW + 4 * SECOND);
    expect(state.nowMs).toBe(NOW + 4 * SECOND);
    expect(state.scene.overhead).toBeNull();
    expect(state.scene.upcoming.map((passage) => passage.hex)).toEqual(["a1"]);
    expectNear((state.scene.upcoming[0] as Passage).passageTimeMs, NOW + 179 * SECOND, SECOND);
    expect((state.scene.upcoming[0] as Passage).arrivalCardinal).toBe("O");
  });

  it("CA12 : asks for the permission once and queries the source once, with the position rounded to 3 decimals and an 80 km radius", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)] });
    await render(<harness.App />);
    await settle();
    expect(harness.location.state.permissionRequests).toBe(1);
    expect(harness.queries).toEqual([{ latitude: 45.764, longitude: 4.836, radiusKm: 80 }]);
  });

  it("CA13 : recomputes the scene every second and keeps the overhead", async () => {
    // h1 survole d'abord ; à +20 s k1 est plus proche (2,2 km contre 3,6 km) mais h1 reste le survol jusqu'à +30 s.
    const harness = setup({ aircraft: [plane("h1", -1, 2, 90, 720), plane("k1", 6, -1, 270, 720)] });
    await render(<harness.App />);
    await settle();
    expect(readyScene().overhead?.hex).toBe("h1");
    expect(readyScene().upcoming.map((passage) => passage.hex)).toEqual(["k1"]);

    for (let second = 0; second < 20; second += 1) await elapse(harness.clock, SECOND);
    const { state } = view();
    expect(state.status === "ready" && state.nowMs).toBe(NOW + 20 * SECOND);
    expect(readyScene().overhead?.hex).toBe("h1");
    expect(readyScene().upcoming).toEqual([]);

    for (let second = 0; second < 11; second += 1) await elapse(harness.clock, SECOND);
    expect(readyScene().overhead?.hex).toBe("k1");
  });

  it("CA13 : queries the source again and replaces the snapshot on refresh()", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)] });
    await render(<harness.App />);
    await settle();
    expect(readyScene().upcoming).toHaveLength(1);

    harness.source.setAircraft([]);
    await elapse(harness.clock, 3 * SECOND);
    await act(async () => {
      latestRefresh();
    });
    await settle();
    expect(harness.queries).toHaveLength(2);
    expect(readyScene()).toEqual({ overhead: null, upcoming: [] });
    const { state } = view();
    expect(state.status === "ready" && state.snapshotAtMs).toBe(NOW + 3 * SECOND);
  });

  it("CA14 : exposes denied and never queries the source when the permission is refused", async () => {
    const harness = setup({ permission: "denied", aircraft: [plane("a1", -40, 0, 90, 720)] });
    await render(<harness.App />);
    await settle();
    await elapse(harness.clock, 5 * SECOND);
    expect(view().state).toEqual({ status: "denied" });
    expect(harness.queries).toEqual([]);
  });

  it("CA15 : reads the permission and the position again, and queries again, at each return to the foreground", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], withLifecycle: true });
    await render(<harness.App />);
    await settle();
    expect(harness.queries).toHaveLength(1);

    harness.location.state.position = { latitude: 45.9, longitude: 4.9 };
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(harness.queries).toHaveLength(2);
    expect(harness.queries[1]).toEqual({ latitude: 45.9, longitude: 4.9, radiusKm: 80 });
    expect(harness.location.state.permissionRequests).toBe(2);
  });

  it("CA15 : clears the data when the permission was removed, and resumes when it is granted again", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], withLifecycle: true });
    await render(<harness.App />);
    await settle();
    expect(view().state.status).toBe("ready");

    harness.location.state.permission = "denied";
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(view().state).toEqual({ status: "denied" });
    expect(harness.queries).toHaveLength(1);

    harness.location.state.permission = "granted";
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(view().state.status).toBe("ready");
    expect(harness.queries).toHaveLength(2);
  });

  it("CA15 : is loading again, not denied, while the position is read again after a grant", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], withLifecycle: true });
    await render(<harness.App />);
    await settle();
    harness.location.state.permission = "denied";
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(view().state).toEqual({ status: "denied" });

    harness.location.state.permission = "granted";
    harness.hold();
    await act(async () => {
      harness.lifecycle?.enterForeground();
    });
    await settle();
    expect(view().state).toEqual({ status: "loading" });
    harness.release();
    await settle();
    expect(view().state.status).toBe("ready");
  });

  it("CA16 : exposes the phone heading, null until the first value, wrapped into [0, 360)", async () => {
    const harness = setup({ aircraft: [] });
    await render(<harness.App />);
    await settle();
    expect(view().headingDeg).toBeNull();
    expect(harness.location.listenerCount()).toBe(1);

    await act(async () => {
      harness.location.emitHeading(370);
    });
    expect(view().headingDeg).toBe(10);
    await act(async () => {
      harness.location.emitHeading(-30);
    });
    expect(view().headingDeg).toBe(330);
    await act(async () => {
      harness.location.emitHeading(360);
    });
    expect(view().headingDeg).toBe(0);
  });

  it("CA16 : unsubscribes from the heading when unmounted", async () => {
    const harness = setup({ aircraft: [] });
    await render(<harness.App />);
    await settle();
    expect(harness.location.listenerCount()).toBe(1);
    await act(async () => {
      await screen.unmount();
    });
    expect(harness.location.listenerCount()).toBe(0);
  });

  it("CA17 : is unavailable when the source is unavailable and nothing was received yet, then recovers", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)] });
    harness.source.setUnavailable(true);
    await render(<harness.App />);
    await settle();
    expect(view().state).toEqual({ status: "unavailable" });

    harness.source.setUnavailable(false);
    await act(async () => {
      latestRefresh();
    });
    await settle();
    expect(view().state.status).toBe("ready");
  });

  it("CA17 : is unavailable when reading the position fails for another reason than the permission", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)] });
    harness.location.state.positionFailure = new RangeError("position unavailable");
    await render(<harness.App />);
    await settle();
    expect(view().state).toEqual({ status: "unavailable" });
    expect(harness.queries).toEqual([]);

    harness.location.state.positionFailure = null;
    await act(async () => {
      latestRefresh();
    });
    await settle();
    expect(view().state.status).toBe("ready");
  });

  it("CA17 : treats any error of the source like an unavailable source, and keeps the last scene", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)] });
    harness.failWith(new TypeError("unexpected payload"));
    await render(<harness.App />);
    await settle();
    expect(view().state).toEqual({ status: "unavailable" });

    harness.failWith(null);
    await act(async () => {
      latestRefresh();
    });
    await settle();
    expect(view().state.status).toBe("ready");

    harness.failWith(new TypeError("unexpected payload"));
    await act(async () => {
      latestRefresh();
    });
    await settle();
    expect(readyScene().upcoming.map((passage) => passage.hex)).toEqual(["a1"]);
  });

  it("CA17 : keeps only the answer of the latest request when an older one answers late", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], holdSource: true });
    await render(<harness.App />);
    await settle();
    harness.source.setAircraft([]);
    await act(async () => {
      latestRefresh();
    });
    await settle();
    expect(harness.queries).toHaveLength(2);

    harness.releaseRequest(1);
    await settle();
    expect(readyScene()).toEqual({ overhead: null, upcoming: [] });
    harness.releaseRequest(0);
    await settle();
    expect(readyScene()).toEqual({ overhead: null, upcoming: [] });
  });

  it("CA17 : does nothing after the unmount when a request is still in flight", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], holdSource: true });
      await render(<harness.App />);
      await settle();
      await act(async () => {
        await screen.unmount();
      });
      harness.release();
      await settle();
      await elapse(harness.clock, 5 * SECOND);
      expect(harness.queries).toHaveLength(1);
      expect(harness.location.listenerCount()).toBe(0);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("CA17 : keeps the last scene, recomputed every second, when the source fails after a success", async () => {
    const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)] });
    await render(<harness.App />);
    await settle();
    harness.source.setUnavailable(true);
    await act(async () => {
      latestRefresh();
    });
    await settle();
    await elapse(harness.clock, 176 * SECOND);
    const { state } = view();
    expect(state.status).toBe("ready");
    expect(state.status === "ready" && state.snapshotAtMs).toBe(NOW);
    expect(state.status === "ready" && state.nowMs).toBe(NOW + 176 * SECOND);
    expect(readyScene().overhead?.hex).toBe("a1");
  });

  it("CA18 : sends no event to the error reporter and logs no coordinate, whatever the outcome", async () => {
    const logs = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      const harness = setup({ aircraft: [plane("a1", -40, 0, 90, 720)], withLifecycle: true });
      harness.source.setUnavailable(true);
      await render(<harness.App />);
      await settle();
      harness.source.setUnavailable(false);
      await act(async () => {
        latestRefresh();
      });
      await settle();
      harness.location.state.permission = "denied";
      await act(async () => {
        harness.lifecycle?.enterForeground();
      });
      await settle();

      expect(harness.monitoring.events).toEqual([]);
      const output = JSON.stringify(logs.map((spy) => spy.mock.calls));
      expect(output).not.toMatch(/45\.76|4\.83/);
      expect(JSON.stringify(view())).not.toMatch(/45\.76|4\.83/);
    } finally {
      for (const spy of logs) spy.mockRestore();
    }
  });
});
