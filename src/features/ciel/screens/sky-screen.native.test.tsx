import { act, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createApp } from "../../../app";
import { createFakeAdsbSource } from "../../../shared/adsb";
import { createFakeClock } from "../../../shared/clock";
import { createFakeLifecycle } from "../../../shared/lifecycle";
import { createFakeLocation } from "../../../shared/location";
import { createFakeErrorReporter } from "../../../shared/monitoring";
import { feature as passages } from "../../passages";
import { feature } from "../index";

const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const OBSERVER = { latitude: 45.76449, longitude: 4.83571 };

// Avion déjà dans sa fenêtre de survol (2,9 km à l'ouest, cap est).
const OVERHEAD = {
  hex: "h1",
  callsign: "AFR1506",
  latitude: OBSERVER.latitude + 1 / KM_PER_DEGREE,
  longitude: OBSERVER.longitude - 2.9 / (KM_PER_DEGREE * Math.cos((OBSERVER.latitude * Math.PI) / 180)),
  altitudeM: 7850,
  groundSpeedKmh: 720,
  trackDeg: 90,
};

async function mount(aircraft: (typeof OVERHEAD)[]) {
  const services = {
    clock: createFakeClock(1_800_000_000_000),
    location: createFakeLocation({ permission: "granted", position: OBSERVER }),
    adsb: createFakeAdsbSource(aircraft),
    monitoring: createFakeErrorReporter(),
    lifecycle: createFakeLifecycle(),
  };
  const App = createApp({ services, features: [feature, passages] });
  await render(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

describe("SkyScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders no sky screen without a shown aircraft", async () => {
    await mount([]);
    expect(screen.queryByTestId("sky-screen")).toBeNull();
  });

  it("shows no stale line while the data is fresh", async () => {
    await mount([OVERHEAD]);
    expect(screen.queryByTestId("data-stale-notice-ciel")).toBeNull();
  });

  it("shows the livery for an airline that has one", async () => {
    await mount([OVERHEAD]);
    expect(screen.getByTestId("ciel-livery")).toBeOnTheScreen();
    expect(screen.queryByTestId("ciel-tail")).toBeNull();
  });

  it("falls back to the generic tail for an airline without livery", async () => {
    await mount([{ ...OVERHEAD, callsign: "CTV1506" }]);
    expect(screen.getByTestId("ciel-tail")).toBeOnTheScreen();
    expect(screen.queryByTestId("ciel-livery")).toBeNull();
  });

  it("shows values without unit text", async () => {
    await mount([OVERHEAD]);
    for (const key of ["speed", "altitude"]) {
      const text = String(screen.getByTestId(`sky-value-${key}`).props.children);
      expect(text).not.toMatch(/km\/h|\bm\b/);
    }
  });

  it("uses tabular figures on every value", async () => {
    await mount([OVERHEAD]);
    for (const key of ["speed", "altitude", "heading", "airline", "flight", "aircraft"]) {
      const style = StyleSheet.flatten(screen.getByTestId(`sky-value-${key}`).props.style);
      expect(style.fontVariant).toContain("tabular-nums");
    }
  });
});
