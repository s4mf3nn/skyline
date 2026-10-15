import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdsbSource } from "../adsb";
import { createFakeClock } from "../clock";
import { createFakeLifecycle } from "../lifecycle";
import { createFakeLocation } from "../location";
import { adsbQueryFor, createSceneController, type SceneView } from "./controller";

const NOW = 1_800_000_000_000;
const POSITION = { latitude: 45.76449, longitude: 4.83571 };

// Un avion à 40 km à l'ouest de l'observateur, cap est, 720 km/h : passage dans environ 3 minutes.
const PLANE = {
  hex: "a1",
  callsign: "A1",
  latitude: 45.76449,
  longitude: 4.3,
  altitudeM: 10_000,
  groundSpeedKmh: 720,
  trackDeg: 90,
};

function setup(options: { permission?: "granted" | "denied"; withLifecycle?: boolean } = {}) {
  const clock = createFakeClock(NOW);
  const location = createFakeLocation({ permission: options.permission ?? "granted", position: POSITION });
  const adsb = createFakeAdsbSource([PLANE]);
  const lifecycle = options.withLifecycle ? createFakeLifecycle() : undefined;
  const views: SceneView[] = [];
  const controller = createSceneController(
    lifecycle ? { clock, location, adsb, lifecycle } : { clock, location, adsb },
    (view) => views.push(view),
  );
  const last = () => views[views.length - 1];
  return { clock, location, adsb, lifecycle, controller, views, last };
}

describe("adsbQueryFor", () => {
  it("rounds latitude and longitude to 3 decimals and uses the 80 km radius", () => {
    expect(adsbQueryFor({ latitude: 45.76449, longitude: 4.83571 })).toEqual({
      latitude: 45.764,
      longitude: 4.836,
      radiusKm: 80,
    });
  });

  it("never returns -0 for small negative values", () => {
    const query = adsbQueryFor({ latitude: -0.0004, longitude: -0.0001 });
    expect(Object.is(query.latitude, 0)).toBe(true);
    expect(Object.is(query.longitude, 0)).toBe(true);
  });

  it("keeps the sign of negative coordinates", () => {
    expect(adsbQueryFor({ latitude: -33.8688, longitude: -70.6693 })).toMatchObject({
      latitude: -33.869,
      longitude: -70.669,
    });
  });
});

describe("createSceneController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes from loading to ready with the rounded query", async () => {
    const { adsb, last } = setup();
    expect(last()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    expect(adsb.queries).toEqual([{ latitude: 45.764, longitude: 4.836, radiusKm: 80 }]);
    expect(last()?.state.status).toBe("ready");
  });

  it("is denied and never queries the source when the permission is refused", async () => {
    const { adsb, last } = setup({ permission: "denied" });
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toEqual({ status: "denied" });
    expect(adsb.queries).toEqual([]);
  });

  it("is unavailable without snapshot when the source fails, then recovers on refresh", async () => {
    const { adsb, controller, last } = setup();
    adsb.setUnavailable(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toEqual({ status: "unavailable" });
    adsb.setUnavailable(false);
    controller.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state.status).toBe("ready");
  });

  it("keeps the last scene when the source fails after a success", async () => {
    const { adsb, controller, last } = setup();
    await vi.advanceTimersByTimeAsync(0);
    adsb.setUnavailable(true);
    controller.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toMatchObject({ status: "ready", snapshotAtMs: NOW });
  });

  it("is unavailable when the position read fails for another reason, and reacquires on refresh", async () => {
    const { location, adsb, controller, last } = setup();
    vi.spyOn(location, "getPosition").mockRejectedValueOnce(new RangeError("position unavailable"));
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toEqual({ status: "unavailable" });
    expect(adsb.queries).toEqual([]);
    controller.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state.status).toBe("ready");
  });

  it("goes denied then loading then ready across foreground returns", async () => {
    const { location, lifecycle, last, views } = setup({ withLifecycle: true });
    await vi.advanceTimersByTimeAsync(0);
    const permission = vi.spyOn(location, "requestPermission");
    permission.mockResolvedValueOnce("denied");
    lifecycle?.enterForeground();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toEqual({ status: "denied" });

    permission.mockResolvedValueOnce("granted");
    const before = views.length;
    lifecycle?.enterForeground();
    await vi.advanceTimersByTimeAsync(0);
    expect(views[before]?.state).toEqual({ status: "loading" });
    expect(last()?.state.status).toBe("ready");
  });

  it("ignores the answer of an older request", async () => {
    const { adsb, controller, last } = setup();
    await vi.advanceTimersByTimeAsync(0);
    const answers: Array<() => void> = [];
    const fetchAircraft = vi.spyOn(adsb, "fetchAircraft");
    fetchAircraft.mockImplementationOnce(() => new Promise((resolve) => answers.push(() => resolve([PLANE]))));
    controller.refresh();
    adsb.setAircraft([]);
    controller.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toMatchObject({ scene: { upcoming: [] } });
    answers[0]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state).toMatchObject({ scene: { upcoming: [] } });
  });

  it("does nothing after stop()", async () => {
    const { adsb, clock, controller, location, views } = setup();
    await vi.advanceTimersByTimeAsync(0);
    controller.stop();
    const count = views.length;
    clock.advance(5000);
    await vi.advanceTimersByTimeAsync(5000);
    controller.refresh();
    location.setHeading(10);
    await vi.advanceTimersByTimeAsync(0);
    expect(views).toHaveLength(count);
    expect(adsb.queries).toHaveLength(1);
  });

  it("recomputes every second without querying before the 10 s deadline", async () => {
    const { adsb, clock, last } = setup();
    await vi.advanceTimersByTimeAsync(0);
    clock.advance(9000);
    await vi.advanceTimersByTimeAsync(9000);
    expect(last()?.state).toMatchObject({ status: "ready", nowMs: NOW + 9000, snapshotAtMs: NOW });
    expect(adsb.queries).toHaveLength(1);
  });

  it("passes the previous overhead to the next tick", async () => {
    const { adsb, clock, last } = setup();
    await vi.advanceTimersByTimeAsync(0);
    // La source est coupée pour que l'instantané d'origine reste celui du calcul.
    adsb.setUnavailable(true);
    clock.advance(190_000);
    await vi.advanceTimersByTimeAsync(1000);
    const state = last()?.state;
    expect(state?.status === "ready" && state.scene.overhead?.hex).toBe("a1");
  });

  it("wraps the heading into [0, 360) and is null before the first value", async () => {
    const { location, last } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.headingDeg).toBeNull();
    location.setHeading(-30);
    expect(last()?.headingDeg).toBe(330);
    location.setHeading(360);
    expect(last()?.headingDeg).toBe(0);
  });

  it("works without lifecycle", async () => {
    const { last } = setup({ withLifecycle: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(last()?.state.status).toBe("ready");
  });

  describe("refresh cadence", () => {
    // Avance l'horloge factice et les minuteurs par pas d'une seconde.
    async function elapse(clock: { advance(ms: number): void }, seconds: number): Promise<void> {
      for (let i = 0; i < seconds; i += 1) {
        clock.advance(1000);
        await vi.advanceTimersByTimeAsync(1000);
      }
    }

    it("CA9: queries again every 10 s with the last position and replaces the snapshot", async () => {
      const { adsb, clock, location, last } = setup();
      await vi.advanceTimersByTimeAsync(0);
      const getPosition = vi.spyOn(location, "getPosition");
      await elapse(clock, 10);
      expect(adsb.queries).toHaveLength(2);
      expect(adsb.queries[1]).toEqual({ latitude: 45.764, longitude: 4.836, radiusKm: 80 });
      expect(last()?.state).toMatchObject({ status: "ready", snapshotAtMs: NOW + 10_000 });
      await elapse(clock, 10);
      expect(adsb.queries).toHaveLength(3);
      expect(getPosition).not.toHaveBeenCalled();
    });

    it("CA10: skips a deadline while the previous request is pending, without catching up", async () => {
      const { adsb, clock } = setup();
      await vi.advanceTimersByTimeAsync(0);
      const answers: Array<() => void> = [];
      const fetchAircraft = vi.spyOn(adsb, "fetchAircraft");
      fetchAircraft.mockImplementationOnce(() => new Promise((resolve) => answers.push(() => resolve([PLANE]))));
      await elapse(clock, 10);
      expect(answers).toHaveLength(1);
      await elapse(clock, 10);
      expect(answers).toHaveLength(1);
      answers[0]?.();
      await vi.advanceTimersByTimeAsync(0);
      fetchAircraft.mockClear();
      await elapse(clock, 5);
      expect(fetchAircraft).not.toHaveBeenCalled();
      await elapse(clock, 5);
      expect(fetchAircraft).toHaveBeenCalledTimes(1);
    });

    it("CA11: stops everything in background and issues one request on return", async () => {
      const { adsb, clock, lifecycle, last, views } = setup({ withLifecycle: true });
      await vi.advanceTimersByTimeAsync(0);
      lifecycle?.enterBackground();
      const count = views.length;
      await elapse(clock, 30);
      expect(views).toHaveLength(count);
      expect(adsb.queries).toHaveLength(1);

      lifecycle?.enterForeground();
      await vi.advanceTimersByTimeAsync(0);
      expect(adsb.queries).toHaveLength(2);
      expect(last()?.state).toMatchObject({ status: "ready", snapshotAtMs: NOW + 30_000 });
      await elapse(clock, 9);
      expect(adsb.queries).toHaveLength(2);
      await elapse(clock, 1);
      expect(adsb.queries).toHaveLength(3);
    });

    it("CA11: ignores an answer arriving during the pause and an older one after the return", async () => {
      const { adsb, clock, lifecycle, last } = setup({ withLifecycle: true });
      await vi.advanceTimersByTimeAsync(0);
      const answers: Array<(aircraft: unknown[]) => void> = [];
      vi.spyOn(adsb, "fetchAircraft").mockImplementationOnce(
        () => new Promise((resolve) => answers.push(resolve as (aircraft: unknown[]) => void)),
      );
      await elapse(clock, 10);
      lifecycle?.enterBackground();
      answers[0]?.([]);
      await vi.advanceTimersByTimeAsync(0);
      expect(last()?.state).toMatchObject({ snapshotAtMs: NOW });
    });

    it("CA11: never stops refreshing without a lifecycle service", async () => {
      const { adsb, clock } = setup({ withLifecycle: false });
      await vi.advanceTimersByTimeAsync(0);
      await elapse(clock, 20);
      expect(adsb.queries).toHaveLength(3);
    });

    it("CA12: keeps the cadence and the last scene after a failure, then recovers", async () => {
      const { adsb, clock, last } = setup();
      await vi.advanceTimersByTimeAsync(0);
      adsb.setUnavailable(true);
      await elapse(clock, 10);
      expect(adsb.queries).toHaveLength(2);
      expect(last()?.state).toMatchObject({ status: "ready", snapshotAtMs: NOW });
      adsb.setUnavailable(false);
      await elapse(clock, 10);
      expect(adsb.queries).toHaveLength(3);
      expect(last()?.state).toMatchObject({ status: "ready", snapshotAtMs: NOW + 20_000 });
    });

    it("CA12: without snapshot stays unavailable then becomes ready, rereading the position each time", async () => {
      const { location, adsb, clock, last } = setup();
      const getPosition = vi.spyOn(location, "getPosition");
      getPosition.mockRejectedValueOnce(new RangeError("position unavailable"));
      await vi.advanceTimersByTimeAsync(0);
      expect(last()?.state).toEqual({ status: "unavailable" });
      await elapse(clock, 10);
      expect(getPosition).toHaveBeenCalledTimes(2);
      expect(last()?.state.status).toBe("ready");
      expect(adsb.queries).toHaveLength(1);
    });

    it("CA13: no deadline queries the source while denied, and the cadence resumes when granted", async () => {
      const { location, adsb, clock, lifecycle, last } = setup({ permission: "denied", withLifecycle: true });
      await vi.advanceTimersByTimeAsync(0);
      await elapse(clock, 30);
      expect(adsb.queries).toEqual([]);
      expect(last()?.state).toEqual({ status: "denied" });

      vi.spyOn(location, "requestPermission").mockResolvedValueOnce("granted");
      vi.spyOn(location, "getPosition").mockResolvedValueOnce(POSITION);
      lifecycle?.enterForeground();
      await vi.advanceTimersByTimeAsync(0);
      expect(adsb.queries).toHaveLength(1);
      await elapse(clock, 10);
      expect(adsb.queries).toHaveLength(2);
    });

    it("CA14: cancels the deadline on stop and ignores an in-flight answer", async () => {
      const { adsb, clock, controller, views } = setup();
      await vi.advanceTimersByTimeAsync(0);
      const answers: Array<() => void> = [];
      vi.spyOn(adsb, "fetchAircraft").mockImplementationOnce(
        () => new Promise((resolve) => answers.push(() => resolve([PLANE]))),
      );
      await elapse(clock, 10);
      controller.stop();
      const count = views.length;
      answers[0]?.();
      await elapse(clock, 20);
      expect(views).toHaveLength(count);
      expect(adsb.queries).toHaveLength(1);
    });

    it("CA15: refresh() queries now without moving the 10 s deadline, even with a request in flight", async () => {
      const { adsb, clock, controller } = setup();
      await vi.advanceTimersByTimeAsync(0);
      await elapse(clock, 4);
      controller.refresh();
      await vi.advanceTimersByTimeAsync(0);
      expect(adsb.queries).toHaveLength(2);
      await elapse(clock, 5);
      expect(adsb.queries).toHaveLength(2);
      await elapse(clock, 1);
      expect(adsb.queries).toHaveLength(3);
    });
  });
});
