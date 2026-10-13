import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
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

function ScreenA() {
  return <Text>screen a</Text>;
}

function ScreenB() {
  return <Text>screen b</Text>;
}

describe("createApp", () => {
  it("mounts the feature with the smallest order, whatever the list order", async () => {
    const App = createApp({
      services: fakeServices(),
      features: [
        { name: "b", order: 2, screen: ScreenB },
        { name: "a", order: 1, screen: ScreenA },
      ],
    });
    await render(<App />);
    expect(screen.getByText("screen a")).toBeOnTheScreen();
    expect(screen.queryByText("screen b")).toBeNull();
  });

  it("falls back to the home screen with the default (empty) registry", async () => {
    const App = createApp({ services: fakeServices() });
    await render(<App />);
    expect(screen.getByText("Skyline")).toBeOnTheScreen();
  });
});
