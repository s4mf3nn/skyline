import path from "node:path";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0008 (Vitest) : parcours de la logique pure des états, avec d'autres données que le contrat.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type SceneState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unavailable" }
  | {
      status: "ready";
      scene: { overhead: { hex: string } | null; upcoming: Array<{ hex: string }> };
      snapshotAtMs: number;
      nowMs: number;
    };
interface Notice {
  kind: string;
  action: string | null;
}
interface StatesModule {
  isStale(snapshotAtMs: number, nowMs: number): boolean;
  stateNotice(state: SceneState): Notice | null;
  staleNotice(state: SceneState, timeZone: string): { text: string } | null;
}
const states = () => load<StatesModule>("src/shared/states/index.ts");

// 1_800_003_599_000 : 08:59:59 UTC, soit 09:59 à Paris et 03:59 à New York (janvier).
const SNAPSHOT = 1_800_003_599_000;

describe("SPEC-0008 hidden scenarios (logic)", () => {
  it("walks an observer from launch to a long outage: every state has exactly one reading", async () => {
    const { stateNotice, staleNotice } = await states();
    const scene = { overhead: null, upcoming: [{ hex: "c3" }] };
    const journey: SceneState[] = [
      { status: "loading" },
      { status: "ready", scene, snapshotAtMs: SNAPSHOT, nowMs: SNAPSHOT },
      { status: "ready", scene, snapshotAtMs: SNAPSHOT, nowMs: SNAPSHOT + 179_000 },
      { status: "ready", scene, snapshotAtMs: SNAPSHOT, nowMs: SNAPSHOT + 180_000 },
      { status: "denied" },
      { status: "unavailable" },
    ];
    const readings = journey.map((state) => [
      stateNotice(state)?.kind ?? null,
      staleNotice(state, "America/New_York")?.text ?? null,
    ]);
    expect(readings).toEqual([
      ["loading", null],
      [null, null],
      [null, null],
      [null, "Données de 03:59 : mise à jour impossible"],
      ["denied", null],
      ["unavailable", null],
    ]);
  });

  it("offers the settings action only for the refused permission", async () => {
    const { stateNotice } = await states();
    const scene = { overhead: null, upcoming: [] };
    const withAction: string[] = [];
    const all: SceneState[] = [
      { status: "loading" },
      { status: "denied" },
      { status: "unavailable" },
      { status: "ready", scene, snapshotAtMs: SNAPSHOT, nowMs: SNAPSHOT },
    ];
    for (const state of all) {
      const notice = stateNotice(state);
      if (notice !== null && notice.action !== null) withAction.push(notice.kind);
    }
    expect(withAction).toEqual(["denied"]);
  });

  it("stays quiet on a lingering overhead aircraft with no upcoming passage, but still reports stale data", async () => {
    const { stateNotice, staleNotice, isStale } = await states();
    const state: SceneState = {
      status: "ready",
      scene: { overhead: { hex: "s1" }, upcoming: [] },
      snapshotAtMs: SNAPSHOT,
      nowMs: SNAPSHOT + 600_000,
    };
    expect(isStale(SNAPSHOT, SNAPSHOT + 600_000)).toBe(true);
    expect(stateNotice(state)).toBeNull();
    expect(staleNotice(state, "Europe/Paris")?.text).toBe("Données de 09:59 : mise à jour impossible");
  });
});
