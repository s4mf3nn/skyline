import { render, screen } from "@testing-library/react-native";
import { createApp } from "../../src/app";
import { createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";

// Contrat de SPEC-0001, partie rendu (Jest) : une erreur d'écran remonte au suivi des erreurs, sans donnée personnelle.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

const BUILD = { release: "3f2a9c1", environment: "production" };

function fakeServices() {
  return {
    clock: createFakeClock(1_760_000_000_000),
    location: createFakeLocation({ permission: "granted", position: { latitude: 45.764, longitude: 4.8357 } }),
    adsb: createFakeAdsbSource([]),
    monitoring: createFakeErrorReporter(),
  };
}

/** L'unique événement reçu par le faux du suivi des erreurs, avec son erreur typée. */
function onlyReportedEvent(services: ReturnType<typeof fakeServices>) {
  expect(services.monitoring.events).toHaveLength(1);
  const event = services.monitoring.events[0];
  if (event === undefined || !(event.error instanceof Error)) throw new TypeError("expected one reported Error");
  return { error: event.error, context: event.context };
}

function BrokenScreen(): never {
  throw new RangeError("render failed");
}

function LeakingScreen(): never {
  throw new RangeError("no aircraft near 45.764, 4.8357");
}

describe("SPEC-0001 delivery (rendering)", () => {
  let consoleError: jest.SpyInstance;

  // React écrit l'erreur attrapée sur la console : le bruit est attendu dans ces tests.
  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it("CA4 : shows the error screen instead of the failing screen", async () => {
    const App = createApp({
      services: fakeServices(),
      features: [{ name: "broken", order: 1, screen: BrokenScreen }],
      build: BUILD,
    });
    await render(<App />);
    expect(screen.getByText("Une erreur est survenue.")).toBeOnTheScreen();
  });

  it("CA4 : reports the unhandled error once with the release, the environment and the feature", async () => {
    const services = fakeServices();
    const App = createApp({
      services,
      features: [{ name: "broken", order: 1, screen: BrokenScreen }],
      build: BUILD,
    });
    await render(<App />);
    const event = onlyReportedEvent(services);
    expect(event.error.name).toBe("RangeError");
    expect(event.error.message).toBe("render failed");
    expect(event.context).toEqual({ release: "3f2a9c1", environment: "production", feature: "broken" });
  });

  it("CA4 : reports nothing when every screen renders", async () => {
    const services = fakeServices();
    const App = createApp({ services, features: [], build: BUILD });
    await render(<App />);
    expect(screen.getByText("Skyline")).toBeOnTheScreen();
    expect(services.monitoring.events).toEqual([]);
  });

  it("CA5 : the reported event carries no coordinate", async () => {
    const services = fakeServices();
    const App = createApp({
      services,
      features: [{ name: "leaking", order: 1, screen: LeakingScreen }],
      build: BUILD,
    });
    await render(<App />);
    const event = onlyReportedEvent(services);
    expect(event.error.message).toBe("no aircraft near [redacted], [redacted]");
    expect(JSON.stringify(event.context)).not.toMatch(/45\.764|4\.8357/);
  });
});
