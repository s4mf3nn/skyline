import { render, screen } from "@testing-library/react-native";
import { createApp } from "./app";
import { createFakeAdsbSource } from "./shared/adsb";
import { createFakeClock } from "./shared/clock";
import { createFakeLocation } from "./shared/location";
import { createFakeErrorReporter } from "./shared/monitoring";

function fakeServices() {
  return {
    clock: createFakeClock(0),
    location: createFakeLocation({ permission: "granted", position: { latitude: 0, longitude: 0 } }),
    adsb: createFakeAdsbSource([]),
    monitoring: createFakeErrorReporter(),
  };
}

function BrokenScreen(): never {
  throw new RangeError("render failed");
}

describe("ScreenGuard", () => {
  let consoleError: jest.SpyInstance;

  // React écrit l'erreur attrapée sur la console : le bruit est attendu ici.
  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it("guards a feature screen and reports its name", async () => {
    const services = fakeServices();
    const App = createApp({ services, features: [{ name: "broken", order: 1, screen: BrokenScreen }] });
    await render(<App />);
    expect(screen.getByText("Une erreur est survenue.")).toBeOnTheScreen();
    expect(services.monitoring.events[0]?.context).toEqual({
      release: "dev",
      environment: "development",
      feature: "broken",
    });
  });

  it("guards the fallback home screen under the home feature", async () => {
    const services = fakeServices();
    const App = createApp({ services, features: [] });
    await render(<App />);
    expect(screen.getByText("Skyline")).toBeOnTheScreen();
    expect(services.monitoring.events).toEqual([]);
  });
});
