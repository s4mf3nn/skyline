import { describe, expect, it } from "vitest";
import type { SceneState } from "../scene";
import { formatDataTime, isStale, STALE_AFTER_MS, staleNotice, stateNotice } from "./index";

const NOW = 1_800_000_000_000;
const plane = { hex: "a1" } as never;

function ready(overhead: boolean, upcoming: number, snapshotAtMs = NOW, nowMs = NOW): SceneState {
  return {
    status: "ready",
    scene: { overhead: overhead ? plane : null, upcoming: Array.from({ length: upcoming }, () => plane) },
    snapshotAtMs,
    nowMs,
  } as SceneState;
}

describe("isStale", () => {
  it("uses a three-minute delay", () => {
    expect(STALE_AFTER_MS).toBe(180_000);
  });

  it("flips exactly at the delay", () => {
    expect(isStale(NOW, NOW + 179_999)).toBe(false);
    expect(isStale(NOW, NOW + 180_000)).toBe(true);
  });

  it("is false for a future snapshot", () => {
    expect(isStale(NOW + 5000, NOW)).toBe(false);
  });
});

describe("stateNotice", () => {
  it("describes each waiting state", () => {
    expect(stateNotice({ status: "loading" })).toMatchObject({ kind: "loading", detail: null, action: null });
    expect(stateNotice({ status: "denied" })).toMatchObject({ kind: "denied", action: "Ouvrir les réglages" });
    expect(stateNotice({ status: "unavailable" })).toMatchObject({ kind: "unavailable", title: "Hors ligne" });
  });

  it("says empty only for a ready scene with neither overhead nor upcoming", () => {
    expect(stateNotice(ready(false, 0))).toMatchObject({ kind: "empty", title: "Aucun passage prévu" });
    expect(stateNotice(ready(true, 0))).toBeNull();
    expect(stateNotice(ready(false, 1))).toBeNull();
  });
});

describe("staleNotice", () => {
  it("formats the snapshot time in the given zone", () => {
    expect(formatDataTime(NOW, "Europe/Paris")).toBe("09:00");
    expect(staleNotice(ready(true, 0, NOW, NOW + 180_000), "Europe/Paris")).toEqual({
      text: "Données de 09:00 : mise à jour impossible",
    });
  });

  it("is null before the delay and for non-ready states", () => {
    expect(staleNotice(ready(true, 0, NOW, NOW + 179_999), "Europe/Paris")).toBeNull();
    for (const status of ["loading", "denied", "unavailable"] as const) {
      expect(staleNotice({ status } as SceneState, "Europe/Paris")).toBeNull();
    }
  });

  it("is independent of the empty notice", () => {
    const state = ready(false, 0, NOW, NOW + 200_000);
    expect(stateNotice(state)?.kind).toBe("empty");
    expect(staleNotice(state, "Europe/Paris")).not.toBeNull();
  });
});
