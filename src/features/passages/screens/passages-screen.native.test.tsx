import { act, render, screen } from "@testing-library/react-native";
import { createApp } from "../../../app";
import { createFakeAdsbSource } from "../../../shared/adsb";
import { createFakeClock } from "../../../shared/clock";
import { createFakeLifecycle } from "../../../shared/lifecycle";
import { createFakeLocation } from "../../../shared/location";
import { createFakeErrorReporter } from "../../../shared/monitoring";
import { feature } from "../index";

function setup(permission: "granted" | "denied") {
  const monitoring = createFakeErrorReporter();
  const services = {
    clock: createFakeClock(1_800_000_000_000),
    location: createFakeLocation({ permission, position: { latitude: 45.76, longitude: 4.83 } }),
    adsb: createFakeAdsbSource([]),
    monitoring,
    lifecycle: createFakeLifecycle(),
  };
  return createApp({ services, features: [feature] });
}

describe("PassagesScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders an empty list without error or log when the scene is empty", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const App = setup("granted");
    await render(<App />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("passages-list")).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^passage-card-/)).toHaveLength(0);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("renders no card and does not crash without location permission", async () => {
    const App = setup("denied");
    await render(<App />);
    expect(screen.getByTestId("passages-list")).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^passage-card-/)).toHaveLength(0);
  });

  it("does not crash when the device time zone changes", async () => {
    const App = setup("granted");
    await render(<App />);
    jest
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ timeZone: "Pacific/Auckland" } as Intl.ResolvedDateTimeFormatOptions);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId("passages-list")).toBeOnTheScreen();
  });
});
