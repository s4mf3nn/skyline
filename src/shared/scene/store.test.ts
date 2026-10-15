import { describe, expect, it, vi } from "vitest";
import { createFakeAdsbSource } from "../adsb";
import { createFakeClock } from "../clock";
import { createFakeLocation } from "../location";
import { createSceneStore } from "./store";

const NOW = 1_800_000_000_000;
const POSITION = { latitude: 45.76449, longitude: 4.83571 };

function setup() {
  const clock = createFakeClock(NOW);
  const location = createFakeLocation({ permission: "granted", position: POSITION });
  const adsb = createFakeAdsbSource([]);
  const requestPermission = vi.spyOn(location, "requestPermission");
  const fetchAircraft = vi.spyOn(adsb, "fetchAircraft");
  const watchHeading = vi.spyOn(location, "watchHeading");
  const store = createSceneStore({ clock, location, adsb });
  return { store, requestPermission, fetchAircraft, watchHeading, location, adsb, clock };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSceneStore", () => {
  it("does nothing until the first subscriber", async () => {
    const { requestPermission, fetchAircraft, watchHeading } = setup();
    await flush();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(fetchAircraft).not.toHaveBeenCalled();
    expect(watchHeading).not.toHaveBeenCalled();
  });

  it("serves two subscribers with one request and one permission prompt", async () => {
    const { store, requestPermission, fetchAircraft } = setup();
    const first = store.subscribe(() => {});
    const second = store.subscribe(() => {});
    await flush();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(fetchAircraft).toHaveBeenCalledTimes(1);
    expect(store.getView().state.status).toBe("ready");
    first();
    second();
  });

  it("stops the controller and the heading watch when the last subscriber leaves", async () => {
    const { store, fetchAircraft, location } = setup();
    const unwatch = vi.fn();
    vi.spyOn(location, "watchHeading").mockReturnValue(unwatch);
    const first = store.subscribe(() => {});
    const second = store.subscribe(() => {});
    first();
    expect(unwatch).not.toHaveBeenCalled();
    second();
    expect(unwatch).toHaveBeenCalledTimes(1);
    await flush();
    store.refresh();
    await flush();
    expect(fetchAircraft).toHaveBeenCalledTimes(0);
  });

  it("relays refresh to the shared controller", async () => {
    const { store, fetchAircraft } = setup();
    const unsubscribe = store.subscribe(() => {});
    await flush();
    store.refresh();
    await flush();
    expect(fetchAircraft).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("keeps two stores on independent services", async () => {
    const a = setup();
    const b = setup();
    const unsubscribeA = a.store.subscribe(() => {});
    await flush();
    expect(a.fetchAircraft).toHaveBeenCalledTimes(1);
    expect(b.fetchAircraft).not.toHaveBeenCalled();
    expect(b.store.getView().state.status).toBe("loading");
    unsubscribeA();
  });
});
