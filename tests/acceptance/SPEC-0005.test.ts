import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0005 (Vitest) : logique pure de l'écran Ciel et règle de présence de Ciel dans le pager.
// L'écran et la présence dans le pager sont joués par SPEC-0005.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec ou ses dépendances : chargés par chemin, avec les types du contrat recopiés ici.
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
interface Airline {
  name: string;
}
interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
  track: string;
}
type SkyPage = "ciel" | "passages";
interface SkyState {
  presence: "absent" | "survol" | "retenu";
  passage: Passage | null;
}
interface SkyRow {
  key: string;
  label: string;
  value: string;
}
interface SkyView {
  hex: string;
  airline: Airline;
  theme: AirlineTheme;
  rows: readonly SkyRow[];
}
interface CielModule {
  CIEL_METRICS: Record<string, number>;
  SKY_ABSENT: SkyState;
  buildSkyView(passage: Passage): SkyView;
  nextSkyState(input: { previous: SkyState; scene: Scene | null; denied: boolean; displayedPage: SkyPage }): SkyState;
}
interface AirlinesModule {
  resolveAirline(callsign: string | null): Airline;
  airlineTheme(airline: Airline): AirlineTheme;
}
const ciel = () => load<CielModule>("src/features/ciel/service.ts");
const airlines = () => load<AirlinesModule>("src/shared/airlines/index.ts");

const NOW = 1_800_000_000_000;
const SECOND = 1000;
const NBSP = " ";

function passage(hex: string, callsign: string | null, overrides: Partial<Passage> = {}): Passage {
  return {
    hex,
    callsign,
    altitudeM: 7850,
    groundSpeedKmh: 779.6,
    trackDeg: 200,
    trackCardinal: "S",
    passageTimeMs: NOW - 10 * SECOND,
    closestTimeMs: NOW + 5 * SECOND,
    windowEndMs: NOW + 20 * SECOND,
    closestDistanceKm: 1,
    groundDistanceKm: 3,
    arrivalBearingDeg: 20,
    arrivalCardinal: "N",
    ...overrides,
  };
}

const sceneOf = (overhead: Passage | null, upcoming: Passage[] = []): Scene => ({ overhead, upcoming });

describe.skip("SPEC-0005 logique de l'écran Ciel", () => {
  it("CA1 : exposes the handoff measures", async () => {
    const { CIEL_METRICS } = await ciel();
    expect(CIEL_METRICS).toEqual({
      infoColumnRightPt: 24,
      infoColumnTopPt: 448,
      infoColumnGapPt: 10,
      labelSizePt: 13,
      labelOpacity: 0.7,
      valueSizePt: 40,
      tailWidthPt: 272,
      tailHeightPt: 399,
      tailLeftPt: -60,
    });
  });

  it("CA2 : builds the six rows in order, with the aircraft heading and no unit", async () => {
    const { buildSkyView } = await ciel();
    const { resolveAirline, airlineTheme } = await airlines();
    const view = buildSkyView(passage("a1", "AFR1506", { altitudeM: 7850 }));
    expect(view.hex).toBe("a1");
    expect(view.airline).toEqual(resolveAirline("AFR1506"));
    expect(view.theme).toEqual(airlineTheme(resolveAirline("AFR1506")));
    expect(view.rows).toEqual([
      { key: "speed", label: "Vitesse", value: "780" },
      { key: "altitude", label: "Altitude", value: `7${NBSP}850` },
      { key: "heading", label: "Cap", value: "S" },
      { key: "airline", label: "Compagnie", value: resolveAirline("AFR1506").name },
      { key: "flight", label: "Vol", value: "AF1506" },
      { key: "aircraft", label: "Appareil", value: "—" },
    ]);
  });

  it("CA2 : shows the track cardinal of the aircraft, not the arrival bearing", async () => {
    const { buildSkyView } = await ciel();
    const view = buildSkyView(passage("a1", "AFR1506", { trackCardinal: "NO", arrivalCardinal: "E" }));
    expect(view.rows.find((row) => row.key === "heading")?.value).toBe("NO");
  });

  it("CA2 : falls back to the unknown airline, a dash for the flight and for a missing altitude", async () => {
    const { buildSkyView } = await ciel();
    const { resolveAirline } = await airlines();
    const view = buildSkyView(passage("n1", null, { altitudeM: null }));
    const row = (key: string) => view.rows.find((candidate) => candidate.key === key)?.value;
    expect(view.airline).toEqual(resolveAirline(null));
    expect(row("airline")).toBe(resolveAirline(null).name);
    expect(row("flight")).toBe("—");
    expect(row("altitude")).toBe("—");
    expect(row("aircraft")).toBe("—");
  });

  it("CA3 : starts a survol on the overhead aircraft, whatever the previous state and the displayed page", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const a = passage("a1", "AFR1506");
    const b = passage("b2", "IBE3457");
    for (const displayedPage of ["ciel", "passages"] as const) {
      expect(nextSkyState({ previous: SKY_ABSENT, scene: sceneOf(a), denied: false, displayedPage })).toEqual({
        presence: "survol",
        passage: a,
      });
      expect(
        nextSkyState({ previous: { presence: "retenu", passage: a }, scene: sceneOf(b), denied: false, displayedPage }),
      ).toEqual({ presence: "survol", passage: b });
    }
  });

  it("CA3 : the denied permission wins over an overhead aircraft and clears everything", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const a = passage("a1", "AFR1506");
    expect(
      nextSkyState({
        previous: { presence: "survol", passage: a },
        scene: sceneOf(a),
        denied: true,
        displayedPage: "ciel",
      }),
    ).toEqual(SKY_ABSENT);
    expect(SKY_ABSENT).toEqual({ presence: "absent", passage: null });
  });

  it("CA3 : never creates a retained aircraft from the absent state", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    for (const displayedPage of ["ciel", "passages"] as const) {
      expect(
        nextSkyState({
          previous: SKY_ABSENT,
          scene: sceneOf(null, [passage("c3", "KLM1234")]),
          denied: false,
          displayedPage,
        }),
      ).toEqual(SKY_ABSENT);
    }
  });

  it("CA4 : keeps the aircraft as retained, same object, when the survol ends while Ciel is displayed", async () => {
    const { nextSkyState } = await ciel();
    const a = passage("a1", "AFR1506");
    const previous: SkyState = { presence: "survol", passage: a };
    const next = nextSkyState({ previous, scene: sceneOf(null), denied: false, displayedPage: "ciel" });
    expect(next.presence).toBe("retenu");
    expect(next.passage).toBe(a);
    const again = nextSkyState({
      previous: next,
      scene: sceneOf(null, [passage("c3", "KLM1234")]),
      denied: false,
      displayedPage: "ciel",
    });
    expect(again).toEqual({ presence: "retenu", passage: a });
  });

  it("CA4 : removes Ciel when the survol ends while the passages are displayed", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const previous: SkyState = { presence: "survol", passage: passage("a1", "AFR1506") };
    expect(nextSkyState({ previous, scene: sceneOf(null), denied: false, displayedPage: "passages" })).toEqual(
      SKY_ABSENT,
    );
  });

  it("CA4 : removes a retained aircraft when the observer reaches the passages", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const previous: SkyState = { presence: "retenu", passage: passage("a1", "AFR1506") };
    expect(nextSkyState({ previous, scene: sceneOf(null), denied: false, displayedPage: "passages" })).toEqual(
      SKY_ABSENT,
    );
  });

  it("CA4 : removes a retained aircraft that becomes an upcoming passage again", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const a = passage("a1", "AFR1506");
    const previous: SkyState = { presence: "retenu", passage: a };
    const upcoming = passage("a1", "AFR1506", { passageTimeMs: NOW + 120 * SECOND });
    expect(nextSkyState({ previous, scene: sceneOf(null, [upcoming]), denied: false, displayedPage: "ciel" })).toEqual(
      SKY_ABSENT,
    );
  });

  it("CA4 : a retained aircraft that becomes the survol again stays a survol, even listed in the upcoming", async () => {
    const { nextSkyState } = await ciel();
    const a = passage("a1", "AFR1506");
    const next = nextSkyState({
      previous: { presence: "retenu", passage: a },
      scene: sceneOf(a, [a]),
      denied: false,
      displayedPage: "ciel",
    });
    expect(next).toEqual({ presence: "survol", passage: a });
  });

  it("CA4 : chains two survols without passing through the retained state", async () => {
    const { nextSkyState } = await ciel();
    const a = passage("a1", "AFR1506");
    const b = passage("b2", "IBE3457");
    const first = nextSkyState({
      previous: { presence: "survol", passage: a },
      scene: sceneOf(b),
      denied: false,
      displayedPage: "ciel",
    });
    expect(first).toEqual({ presence: "survol", passage: b });
  });

  it("CA5 : keeps the state when there is no scene yet", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const a = passage("a1", "AFR1506");
    expect(nextSkyState({ previous: SKY_ABSENT, scene: null, denied: false, displayedPage: "ciel" })).toEqual(
      SKY_ABSENT,
    );
    expect(
      nextSkyState({ previous: { presence: "retenu", passage: a }, scene: null, denied: false, displayedPage: "ciel" }),
    ).toEqual({ presence: "retenu", passage: a });
    expect(
      nextSkyState({ previous: { presence: "survol", passage: a }, scene: null, denied: false, displayedPage: "ciel" }),
    ).toEqual({ presence: "retenu", passage: a });
    expect(
      nextSkyState({
        previous: { presence: "survol", passage: a },
        scene: null,
        denied: false,
        displayedPage: "passages",
      }),
    ).toEqual(SKY_ABSENT);
  });

  it("CA5 : a retained aircraft with no scene is removed when the passages are displayed", async () => {
    const { nextSkyState, SKY_ABSENT } = await ciel();
    const a = passage("a1", "AFR1506");
    expect(
      nextSkyState({
        previous: { presence: "retenu", passage: a },
        scene: null,
        denied: false,
        displayedPage: "passages",
      }),
    ).toEqual(SKY_ABSENT);
  });

  it("CA18 : shares the flight label and the metric format with the passages", async () => {
    const format = await load<{
      flightLabel(callsign: string | null, airline: Airline): string;
      formatMetric(value: number | null): string;
    }>("src/shared/format/index.ts");
    const { resolveAirline } = await airlines();
    expect(format.formatMetric(7850)).toBe(`7${NBSP}850`);
    expect(format.formatMetric(null)).toBe("—");
    expect(format.flightLabel("AFR1506", resolveAirline("AFR1506"))).toBe("AF1506");
    expect(format.flightLabel(null, resolveAirline(null))).toBe("—");
    const reexported = await load<typeof format>("src/features/passages/service.ts");
    expect(reexported.flightLabel).toBe(format.flightLabel);
    expect(reexported.formatMetric).toBe(format.formatMetric);
  });

  it("CA5 : does not modify its inputs", async () => {
    const { nextSkyState } = await ciel();
    const a = passage("a1", "AFR1506");
    const previous: SkyState = Object.freeze({ presence: "survol", passage: a }) as SkyState;
    const scene = Object.freeze(sceneOf(null, [passage("c3", "KLM1234")])) as Scene;
    expect(() => nextSkyState({ previous, scene, denied: false, displayedPage: "ciel" })).not.toThrow();
    expect(previous).toEqual({ presence: "survol", passage: a });
  });
});
