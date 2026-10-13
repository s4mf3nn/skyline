import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { createApp } from "../../src/app";
import { createFakeAdsbSource } from "../../src/shared/adsb";
import { createFakeClock } from "../../src/shared/clock";
import { createFakeLocation } from "../../src/shared/location";
import { createFakeErrorReporter } from "../../src/shared/monitoring";
import { useServices } from "../../src/shared/services";

// Contrat de SPEC-0000, partie rendu (Jest, `jest-expo` et React Native Testing Library, posés par cette spec).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

function fakeServices() {
  return {
    clock: createFakeClock(1_760_000_000_000),
    location: createFakeLocation({ permission: "granted", position: { latitude: 45.764, longitude: 4.8357 } }),
    adsb: createFakeAdsbSource([]),
    monitoring: createFakeErrorReporter(),
  };
}

function ProbeScreen() {
  return <Text>probe screen</Text>;
}

function ClockProbeScreen() {
  const { clock } = useServices();
  return <Text>{`now ${clock.now()}`}</Text>;
}

describe("SPEC-0000 bootstrap (rendering)", () => {
  it("CA1 : renders the home screen with its title when no feature is mounted", async () => {
    const App = createApp({ services: fakeServices(), features: [] });
    await render(<App />);
    expect(screen.getByText("Skyline")).toBeOnTheScreen();
  });

  it("CA3 : mounts the screen of a feature from the registry instead of the home screen", async () => {
    const App = createApp({
      services: fakeServices(),
      features: [{ name: "probe", order: 1, screen: ProbeScreen }],
    });
    await render(<App />);
    expect(screen.getByText("probe screen")).toBeOnTheScreen();
    expect(screen.queryByText("Skyline")).toBeNull();
  });

  it("CA5 : gives the services it received to the screens", async () => {
    const App = createApp({
      services: fakeServices(),
      features: [{ name: "clock-probe", order: 1, screen: ClockProbeScreen }],
    });
    await render(<App />);
    expect(screen.getByText("now 1760000000000")).toBeOnTheScreen();
  });
});
