import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { createApp } from "../../src/app";
import type { Aircraft } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Scénarios cachés de SPEC-0007 (Jest) : le client réel, avec un faux de `fetch`, sous l'application complète.
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
interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
interface AdsbLolModule {
  createAdsbLolSource(options: {
    fetch: (
      url: string,
      init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal },
    ) => Promise<FetchResponse>;
  }): { fetchAircraft(query: { latitude: number; longitude: number; radiusKm: number }): Promise<Aircraft[]> };
}
interface LifecycleModule {
  createFakeLifecycle(): {
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
    enterForeground(): void;
    enterBackground(): void;
  };
}
const adsbModule = () => jest.requireActual<AdsbLolModule>("../../src/shared/adsb/adsblol");
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");
const sceneModule = () => jest.requireActual<{ useScene(): { state: SceneState } }>("../../src/shared/scene");

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER = { latitude: 43.29512, longitude: 5.37411 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;

/** Avion au format adsb.lol, à `eastKm`, `northKm` de l'observateur, vitesse en nœuds. */
function rawPlane(hex: string, eastKm: number, northKm: number, track: number, knots: number, extra = {}) {
  return {
    hex,
    flight: `${hex.toUpperCase()}  `,
    alt_baro: 30000,
    gs: knots,
    track,
    lat: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    lon: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
    seen_pos: 0,
    ...extra,
  };
}

function ProbeScreen() {
  const { state } = sceneModule().useScene();
  return <Text testID="view">{JSON.stringify(state)}</Text>;
}

const read = (): SceneState => JSON.parse(String(screen.getByTestId("view").props.children));
const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
async function elapse(clock: { advance(ms: number): void }, seconds: number) {
  for (let second = 0; second < seconds; second += 1) {
    await act(async () => {
      clock.advance(SECOND);
      await jest.advanceTimersByTimeAsync(SECOND);
    });
  }
}

describe("SPEC-0007 hidden scenarios (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows real data end to end, drops ground traffic, survives an outage and a background trip", async () => {
    let body: unknown = {
      ac: [
        rawPlane("c00001", 0, -40, 0, 400),
        rawPlane("c00002", 5, 5, 90, 150, { alt_baro: "ground" }),
        rawPlane("c00003", 30, 2, 270, 450, { flight: "" }),
      ],
    };
    let mode: "ok" | "down" = "ok";
    const urls: string[] = [];
    const fetch = async (url: string): Promise<FetchResponse> => {
      urls.push(url);
      if (mode === "down") return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    };
    const clock = createFakeClock(NOW);
    const monitoring = createFakeErrorReporter();
    const lifecycle = lifecycleModule().createFakeLifecycle();
    // `lifecycle` n'existe pas encore dans `AppServices` : posé par SPEC-0004, ajouté ici par propagation.
    const services = {
      clock,
      location: createFakeLocation({ permission: "granted", position: OBSERVER }),
      adsb: adsbModule().createAdsbLolSource({ fetch }),
      monitoring,
      ...{ lifecycle },
    };
    const App = createApp({
      services,
      features: [{ name: "probe", order: 1, screen: ProbeScreen }],
    });

    await render(<App />);
    await settle();
    const first = read();
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.scene.upcoming.map((passage) => passage.hex)).toEqual(["c00003", "c00001"]);
    expect(urls).toEqual(["https://api.adsb.lol/v2/point/43.295/5.374/44"]);

    mode = "down";
    await elapse(clock, 20);
    expect(urls).toHaveLength(3);
    const stale = read();
    expect(stale.status).toBe("ready");
    if (stale.status !== "ready") return;
    expect(stale.snapshotAtMs).toBe(NOW);

    lifecycle.enterBackground();
    await elapse(clock, 300);
    expect(urls).toHaveLength(3);

    mode = "ok";
    body = { ac: [rawPlane("c00009", -30, 0, 90, 450)] };
    lifecycle.enterForeground();
    await settle();
    expect(urls).toHaveLength(4);
    const back = read();
    expect(back.status).toBe("ready");
    if (back.status !== "ready") return;
    expect(back.scene.upcoming.map((passage) => passage.hex)).toEqual(["c00009"]);
    expect(back.snapshotAtMs).toBe(NOW + 320 * SECOND);
    expect(monitoring.events).toEqual([]);
  });

  it("starts from a source that is down, then shows the scene as soon as it answers", async () => {
    let up = false;
    const fetch = async (): Promise<FetchResponse> =>
      up
        ? { ok: true, status: 200, json: async () => ({ ac: [rawPlane("d00001", -50, 0, 90, 480)] }) }
        : { ok: true, status: 200, json: async () => ({ msg: "maintenance" }) };
    const clock = createFakeClock(NOW);
    const App = createApp({
      services: {
        clock,
        location: createFakeLocation({ permission: "granted", position: OBSERVER }),
        adsb: adsbModule().createAdsbLolSource({ fetch }),
        monitoring: createFakeErrorReporter(),
      },
      features: [{ name: "probe", order: 1, screen: ProbeScreen }],
    });
    await render(<App />);
    await settle();
    expect(read().status).toBe("unavailable");
    await elapse(clock, 10);
    expect(read().status).toBe("unavailable");
    up = true;
    await elapse(clock, 10);
    const state = read();
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.scene.upcoming.map((passage) => passage.hex)).toEqual(["d00001"]);
  });
});
