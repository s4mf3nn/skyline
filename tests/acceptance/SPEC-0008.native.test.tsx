import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createApp, type Feature } from "../../src/app";
import { type AdsbSource, type Aircraft, createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { AppError } from "../../src/shared/errors";
import type { LocationPermission, LocationService, Position } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0008, partie écrans (Jest, `jest-expo` et React Native Testing Library) : états d'attente de
// Prochains passages et ligne de données périmées sur les deux écrans, sous `createApp` avec les faux de src/shared/.
// Le rafraîchissement toutes les 10 s est celui de SPEC-0007 ; la mise en page n'est pas jouée ici.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés à l'exécution, types du contrat recopiés ici.
interface FeatureModule {
  feature: Feature;
}
interface AppLifecycle {
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
}
interface LifecycleModule {
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void; enterBackground(): void };
}
interface SystemSettings {
  openSettings(): Promise<void>;
}
interface SystemSettingsModule {
  createFakeSystemSettings(options?: { failing?: boolean }): SystemSettings & { readonly openCount: number };
}
interface StatesModule {
  formatDataTime(timestampMs: number, timeZone: string): string;
}
const passagesFeature = () => jest.requireActual<FeatureModule>("../../src/features/passages").feature;
const cielFeature = () => jest.requireActual<FeatureModule>("../../src/features/ciel").feature;
const lifecycleModule = () => jest.requireActual<LifecycleModule>("../../src/shared/lifecycle");
const settingsModule = () => jest.requireActual<SystemSettingsModule>("../../src/shared/system-settings");
const statesModule = () => jest.requireActual<StatesModule>("../../src/shared/states");

// Géométrie de test : plan local autour de l'observateur (x vers l'est, y vers le nord, en km).
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER: Position = { latitude: 45.76449, longitude: 4.83571 };
const NOW = 1_800_000_000_000;
const SECOND = 1000;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function plane(hex: string, eastKm: number, northKm: number, overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex,
    callsign: "AFR1506",
    latitude: OBSERVER.latitude + northKm / KM_PER_DEGREE,
    longitude: OBSERVER.longitude + eastKm / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
    altitudeM: 10_000,
    groundSpeedKmh: 720,
    trackDeg: 90,
    ...overrides,
  };
}

// À 720 km/h, arrive de l'ouest à 40 km : à venir pendant les 175 premières secondes.
const INBOUND = plane("a1", -40.1, 0);
// À 20 km/h et déjà dans sa fenêtre de ±5 km : reste le survol en cours pendant 18 minutes.
const LINGERING = plane("s1", -1, 1, { groundSpeedKmh: 20 });

interface Harness {
  App: ReturnType<typeof createApp>;
  clock: ReturnType<typeof createFakeClock>;
  source: ReturnType<typeof createFakeAdsbSource>;
  permission: { current: LocationPermission };
  monitoring: ReturnType<typeof createFakeErrorReporter>;
  lifecycle: ReturnType<LifecycleModule["createFakeLifecycle"]>;
  settings: ReturnType<SystemSettingsModule["createFakeSystemSettings"]>;
  releaseFirstResponse(): void;
  /** La prochaine réponse de la source reste en attente jusqu'à `releaseFirstResponse()`. */
  holdNextResponse(): void;
}

interface SetupOptions {
  aircraft?: Aircraft[];
  permission?: LocationPermission;
  unavailable?: boolean;
  holdFirstResponse?: boolean;
  withSettings?: boolean;
  settingsFailing?: boolean;
  features?: Array<"ciel" | "passages">;
}

function setup(options: SetupOptions = {}): Harness {
  const clock = createFakeClock(NOW);
  const source = createFakeAdsbSource(options.aircraft ?? []);
  source.setUnavailable(options.unavailable ?? false);
  let release: () => void = () => undefined;
  let held: Promise<void> | null = null;
  const hold = () => {
    held = new Promise<void>((resolve) => {
      release = () => {
        held = null;
        resolve();
      };
    });
  };
  if (options.holdFirstResponse) hold();
  const adsb: AdsbSource = {
    async fetchAircraft(query) {
      // La réponse est retenue avant de joindre la source : `loading` reste observable même source indisponible.
      if (held !== null) await held;
      return source.fetchAircraft(query);
    },
  };
  const permission = { current: options.permission ?? ("granted" as LocationPermission) };
  const location: LocationService = {
    requestPermission: async () => permission.current,
    async getPosition() {
      if (permission.current !== "granted") throw new AppError("LOCATION_DENIED", "Location permission denied");
      return { ...OBSERVER };
    },
    watchHeading: () => () => undefined,
  };
  const monitoring = createFakeErrorReporter();
  const lifecycle = lifecycleModule().createFakeLifecycle();
  const settings = settingsModule().createFakeSystemSettings({ failing: options.settingsFailing ?? false });
  const services = {
    clock,
    location,
    adsb,
    monitoring,
    lifecycle,
    ...(options.withSettings === false ? {} : { systemSettings: settings }),
  };
  const names = options.features ?? ["passages"];
  const features = names.map((name) => (name === "ciel" ? cielFeature() : passagesFeature()));
  const App = createApp({ services, features });
  return {
    App,
    clock,
    source,
    permission,
    monitoring,
    lifecycle,
    settings,
    releaseFirstResponse: () => release(),
    holdNextResponse: hold,
  };
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

const comeBack = (harness: Harness) =>
  act(async () => {
    harness.lifecycle.enterForeground();
    await jest.advanceTimersByTimeAsync(0);
  });

const cardIds = () => screen.queryAllByTestId(/^passage-card-/).map((card) => String(card.props.testID));
const staleText = () => `Données de ${statesModule().formatDataTime(NOW, TIME_ZONE)} : mise à jour impossible`;

describe("SPEC-0008 États d'interface (rendering)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("CA5 : shows the loading notice and no card until the first response, then the cards", async () => {
    const harness = setup({ aircraft: [INBOUND], holdFirstResponse: true });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-loading")).toBeOnTheScreen();
    expect(screen.getByText("Recherche des avions…")).toBeOnTheScreen();
    expect(cardIds()).toEqual([]);
    expect(screen.queryByTestId("passages-notice-action")).toBeNull();
    for (const other of ["empty", "unavailable", "denied"]) {
      expect(screen.queryByTestId(`passages-notice-${other}`)).toBeNull();
    }

    await act(async () => {
      harness.releaseFirstResponse();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByTestId("passages-notice-loading")).toBeNull();
    expect(screen.queryByText("Recherche des avions…")).toBeNull();
    for (const other of ["empty", "unavailable", "denied"]) {
      expect(screen.queryByTestId(`passages-notice-${other}`)).toBeNull();
    }
    expect(cardIds()).toEqual(["passage-card-a1"]);
  });

  it("CA6 : shows the empty notice for a ready scene without passage, then the card once a passage appears", async () => {
    const harness = setup({ aircraft: [] });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-empty")).toBeOnTheScreen();
    expect(screen.getByText("Aucun passage prévu")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Aucun avion ne devrait passer près de vous pour le moment. La liste se met à jour toute seule.",
      ),
    ).toBeOnTheScreen();
    expect(cardIds()).toEqual([]);

    harness.source.setAircraft([INBOUND]);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("passages-notice-empty")).toBeNull();
    expect(cardIds()).toEqual(["passage-card-a1"]);
  });

  it("CA6 : never shows the empty notice next to a card, overhead included", async () => {
    const harness = setup({ aircraft: [LINGERING] });
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["passage-card-s1"]);
    expect(screen.queryByTestId("passages-notice-empty")).toBeNull();
    expect(screen.queryByText("Aucun passage prévu")).toBeNull();
  });

  it("CA7 : explains the refused permission and opens the settings from the button, once per press", async () => {
    const harness = setup({ aircraft: [INBOUND], permission: "denied" });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-denied")).toBeOnTheScreen();
    expect(screen.getByText("Localisation désactivée")).toBeOnTheScreen();
    expect(
      screen.getByText("Skyline a besoin de votre position pour savoir quels avions passent au-dessus de vous."),
    ).toBeOnTheScreen();
    expect(harness.source.queries).toHaveLength(0);
    expect(cardIds()).toEqual([]);

    const button = screen.getByRole("button", { name: "Ouvrir les réglages" });
    expect(button.props.testID).toBe("passages-notice-action");
    expect(harness.settings.openCount).toBe(0);
    await act(async () => {
      fireEvent.press(button);
    });
    expect(harness.settings.openCount).toBe(1);
  });

  it("CA7 : survives a failing settings service without telling the error reporter or logging", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
    const harness = setup({ permission: "denied", settingsFailing: true });
    await render(<harness.App />);
    await settle();
    await act(async () => {
      fireEvent.press(screen.getByTestId("passages-notice-action"));
    });
    await settle();
    expect(harness.settings.openCount).toBe(1);
    expect(screen.getByTestId("passages-notice-denied")).toBeOnTheScreen();
    expect(harness.monitoring.events).toHaveLength(0);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("CA7 : shows the refused notice without a button when no settings service is provided", async () => {
    const harness = setup({ permission: "denied", withSettings: false });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-denied")).toBeOnTheScreen();
    expect(screen.getByText("Localisation désactivée")).toBeOnTheScreen();
    expect(screen.queryByTestId("passages-notice-action")).toBeNull();
  });

  it("CA8 : shows the offline notice, without button, when nothing was ever received, then recovers", async () => {
    const harness = setup({ aircraft: [INBOUND], unavailable: true });
    await render(<harness.App />);
    await settle();
    expect(screen.getByTestId("passages-notice-unavailable")).toBeOnTheScreen();
    expect(screen.getByText("Hors ligne")).toBeOnTheScreen();
    expect(
      screen.getByText("Impossible de joindre les avions pour le moment. Nouvelle tentative automatique."),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("passages-notice-action")).toBeNull();
    expect(cardIds()).toEqual([]);

    await elapse(harness.clock, 30 * SECOND);
    expect(screen.getByTestId("passages-notice-unavailable")).toBeOnTheScreen();

    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("passages-notice-unavailable")).toBeNull();
    expect(cardIds()).toEqual(["passage-card-a1"]);
  });

  it("CA9 : drops the cards and explains when the permission is withdrawn, then recovers when granted again", async () => {
    const harness = setup({ aircraft: [INBOUND] });
    await render(<harness.App />);
    await settle();
    expect(cardIds()).toEqual(["passage-card-a1"]);

    harness.permission.current = "denied";
    await comeBack(harness);
    expect(cardIds()).toEqual([]);
    expect(screen.getByTestId("passages-notice-denied")).toBeOnTheScreen();
    expect(screen.getByTestId("passages-notice-action")).toBeOnTheScreen();

    harness.permission.current = "granted";
    harness.holdNextResponse();
    await comeBack(harness);
    expect(screen.queryByTestId("passages-notice-denied")).toBeNull();
    expect(screen.getByTestId("passages-notice-loading")).toBeOnTheScreen();
    expect(cardIds()).toEqual([]);

    await act(async () => {
      harness.releaseFirstResponse();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByTestId("passages-notice-loading")).toBeNull();
    expect(cardIds()).toEqual(["passage-card-a1"]);
  });

  it("CA10 : shows nothing for three minutes of failures, then the stale line above the cards", async () => {
    const harness = setup({ aircraft: [LINGERING, plane("b2", -30.1, 0)] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();

    harness.source.setUnavailable(true);
    await elapse(harness.clock, 179 * SECOND);
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();
    expect(screen.queryByTestId("passages-notice-unavailable")).toBeNull();
    expect(cardIds()).toContain("passage-card-s1");

    await elapse(harness.clock, SECOND);
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();
    expect(screen.getByText(staleText())).toBeOnTheScreen();
    expect(screen.getByText(/^Données de \d{2}:\d{2} : mise à jour impossible$/)).toBeOnTheScreen();
    expect(cardIds()).toContain("passage-card-s1");
    expect(screen.queryByTestId("passages-notice-unavailable")).toBeNull();
  });

  it("CA10 : removes the stale line at the first successful refresh", async () => {
    const harness = setup({ aircraft: [LINGERING] });
    await render(<harness.App />);
    await settle();
    harness.source.setUnavailable(true);
    await elapse(harness.clock, 200 * SECOND);
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();

    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();
    expect(screen.queryByText(staleText())).toBeNull();
    expect(cardIds()).toEqual(["passage-card-s1"]);
  });

  it("CA10 : shows the empty notice and the stale line together for a stale empty scene", async () => {
    const harness = setup({ aircraft: [] });
    await render(<harness.App />);
    await settle();
    harness.source.setUnavailable(true);
    await elapse(harness.clock, 180 * SECOND);
    expect(screen.getByTestId("passages-notice-empty")).toBeOnTheScreen();
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();
    expect(screen.queryByTestId("passages-notice-unavailable")).toBeNull();
  });

  it("CA10 : shows the stale line on return from a long background until a refresh succeeds", async () => {
    const harness = setup({ aircraft: [LINGERING] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();

    await act(async () => {
      harness.lifecycle.enterBackground();
      await jest.advanceTimersByTimeAsync(0);
    });
    harness.source.setUnavailable(true);
    await elapse(harness.clock, 240 * SECOND);
    await comeBack(harness);
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();
    expect(cardIds()).toEqual(["passage-card-s1"]);

    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();
  });

  it("CA11 : shows the same stale line on Ciel at the same instant, then removes it on a refresh", async () => {
    const harness = setup({ aircraft: [LINGERING], features: ["ciel", "passages"] });
    await render(<harness.App />);
    await settle();
    expect(screen.queryByTestId("data-stale-notice-ciel")).toBeNull();

    harness.source.setUnavailable(true);
    await elapse(harness.clock, 179 * SECOND);
    expect(screen.queryByTestId("data-stale-notice-ciel")).toBeNull();
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();

    await elapse(harness.clock, SECOND);
    expect(screen.getByTestId("data-stale-notice-ciel")).toBeOnTheScreen();
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();
    expect(screen.getAllByText(staleText())).toHaveLength(2);

    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    expect(screen.queryByTestId("data-stale-notice-ciel")).toBeNull();
    expect(screen.queryByTestId("data-stale-notice-passages")).toBeNull();
  });

  it("CA11 : shows the stale line only on Prochains passages when Ciel is absent", async () => {
    // Avion à 79 km à 720 km/h : il n'entre dans sa fenêtre qu'après environ 6 minutes, donc il n'y a pas de survol
    // en cours pendant les 180 s du test et Ciel est absent (INV9).
    const harness = setup({ aircraft: [plane("f1", -79, 0)], features: ["ciel", "passages"] });
    await render(<harness.App />);
    await settle();
    harness.source.setUnavailable(true);
    await elapse(harness.clock, 180 * SECOND);
    expect(screen.queryByTestId("pager-indicator-trait-0")).toBeNull();
    expect(screen.queryByTestId("data-stale-notice-ciel")).toBeNull();
    expect(screen.getAllByTestId("data-stale-notice-passages")).toHaveLength(1);
  });

  it.each([
    ["loading", { holdFirstResponse: true }],
    ["denied", { permission: "denied" as const }],
    ["unavailable", { unavailable: true }],
    ["empty", { aircraft: [] as Aircraft[] }],
  ])("CA12 : shows no waiting state on Ciel, and no second page, in the %s state", async (kind, options) => {
    const harness = setup({ ...options, features: ["ciel", "passages"] });
    await render(<harness.App />);
    await settle();
    expect(screen.getAllByTestId(`passages-notice-${kind}`)).toHaveLength(1);
    expect(screen.queryByTestId("pager-indicator-trait-0")).toBeNull();
    expect(screen.queryByTestId("pager-indicator-trait-1")).toBeNull();
    expect(screen.queryByTestId("data-stale-notice-ciel")).toBeNull();
  });

  it("CA13 : sends nothing to the error reporter and logs nothing across every state", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
    const harness = setup({ aircraft: [LINGERING], permission: "denied", unavailable: true });
    await render(<harness.App />);
    await settle();
    await act(async () => {
      fireEvent.press(screen.getByTestId("passages-notice-action"));
    });
    harness.permission.current = "granted";
    harness.holdNextResponse();
    await comeBack(harness);
    expect(screen.getByTestId("passages-notice-loading")).toBeOnTheScreen();
    await act(async () => {
      harness.releaseFirstResponse();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("passages-notice-unavailable")).toBeOnTheScreen();
    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);
    expect(cardIds()).toEqual(["passage-card-s1"]);
    harness.source.setUnavailable(true);
    await elapse(harness.clock, 200 * SECOND);
    expect(screen.getByTestId("data-stale-notice-passages")).toBeOnTheScreen();
    harness.source.setUnavailable(false);
    await elapse(harness.clock, 10 * SECOND);

    expect(harness.monitoring.events).toHaveLength(0);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
