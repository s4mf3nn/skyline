import path from "node:path";
import { describe, expect, it } from "vitest";

// Scénarios cachés de SPEC-0005 (Vitest) : parcours de bout en bout de la règle de présence de Ciel, avec la scène
// calculée par `computeScene` (SPEC-0004) et d'autres avions que les tests de contrat. Actifs seuls (pas de `.skip`).

const load = <T>(file: string): Promise<T> => import(path.resolve(file));

type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
interface Passage {
  hex: string;
  callsign: string | null;
  altitudeM: number | null;
  groundSpeedKmh: number;
  trackDeg: number;
  trackCardinal: CardinalPoint;
  passageTimeMs: number;
  closestTimeMs: number;
  windowEndMs: number;
  closestDistanceKm: number;
  groundDistanceKm: number;
  arrivalBearingDeg: number;
  arrivalCardinal: CardinalPoint;
}
interface Scene {
  overhead: Passage | null;
  upcoming: Passage[];
}
interface SkyState {
  presence: "absent" | "survol" | "retenu";
  passage: Passage | null;
}
interface CielModule {
  SKY_ABSENT: SkyState;
  buildSkyView(passage: Passage): { rows: readonly { key: string; value: string }[] };
  nextSkyState(input: {
    previous: SkyState;
    scene: Scene | null;
    denied: boolean;
    displayedPage: "ciel" | "passages";
  }): SkyState;
}
const ciel = () => load<CielModule>("src/features/ciel/service.ts");

const NOW = 1_800_000_000_000;
const SECOND = 1000;

function passage(hex: string, callsign: string | null, overrides: Partial<Passage> = {}): Passage {
  return {
    hex,
    callsign,
    altitudeM: 11_000,
    groundSpeedKmh: 850,
    trackDeg: 45,
    trackCardinal: "NE",
    passageTimeMs: NOW,
    closestTimeMs: NOW + 20 * SECOND,
    windowEndMs: NOW + 40 * SECOND,
    closestDistanceKm: 2,
    groundDistanceKm: 5,
    arrivalBearingDeg: 225,
    arrivalCardinal: "SO",
    ...overrides,
  };
}

describe("SPEC-0005 scénarios cachés : présence de Ciel", () => {
  it("follows a whole evening: overhead, retained, left, next overhead, then a permission refusal", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const lh = passage("3c6444", "DLH4YK");
    const kl = passage("484a12", "KLM1301", { trackCardinal: "SE" });
    let state = SKY_ABSENT;
    const step = (scene: Scene | null, displayedPage: "ciel" | "passages", denied = false) => {
      state = nextSkyState({ previous: state, scene, denied, displayedPage });
      return state.presence;
    };

    expect(step({ overhead: null, upcoming: [lh] }, "passages")).toBe("absent");
    expect(step({ overhead: lh, upcoming: [] }, "passages")).toBe("survol");
    expect(step({ overhead: lh, upcoming: [] }, "ciel")).toBe("survol");
    expect(step({ overhead: null, upcoming: [kl] }, "ciel")).toBe("retenu");
    expect(state.passage).toBe(lh);
    expect(step({ overhead: null, upcoming: [kl] }, "ciel")).toBe("retenu");
    expect(step({ overhead: kl, upcoming: [] }, "ciel")).toBe("survol");
    expect(state.passage).toBe(kl);
    expect(step({ overhead: null, upcoming: [] }, "ciel")).toBe("retenu");
    expect(step({ overhead: null, upcoming: [] }, "passages")).toBe("absent");
    expect(state).toEqual(SKY_ABSENT);
    expect(step({ overhead: null, upcoming: [] }, "ciel")).toBe("absent");
    expect(step({ overhead: lh, upcoming: [] }, "passages", true)).toBe("absent");
  });

  it("drops an aircraft that turns back into an upcoming passage, then shows it again when it overflies", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const a = passage("06a1c3", "BAW306");
    const retained = nextSkyState({
      previous: { presence: "survol", passage: a },
      scene: { overhead: null, upcoming: [] },
      denied: false,
      displayedPage: "ciel",
    });
    expect(retained.presence).toBe("retenu");

    const turning = nextSkyState({
      previous: retained,
      scene: { overhead: null, upcoming: [{ ...a, passageTimeMs: NOW + 300 * SECOND }] },
      denied: false,
      displayedPage: "ciel",
    });
    expect(turning).toEqual(SKY_ABSENT);

    const back = nextSkyState({
      previous: turning,
      scene: { overhead: a, upcoming: [] },
      denied: false,
      displayedPage: "passages",
    });
    expect(back).toEqual({ presence: "survol", passage: a });
  });

  it("builds a view for an aircraft with no callsign and no altitude without inventing anything", async () => {
    const { buildSkyView } = await ciel();
    const view = buildSkyView(passage("ffffff", null, { altitudeM: null, groundSpeedKmh: 0.4, trackCardinal: "N" }));
    const row = (key: string) => view.rows.find((candidate) => candidate.key === key)?.value;
    expect(row("speed")).toBe("0");
    expect(row("altitude")).toBe("—");
    expect(row("heading")).toBe("N");
    expect(row("flight")).toBe("—");
    expect(row("aircraft")).toBe("—");
    expect(view.rows).toHaveLength(6);
  });
});
