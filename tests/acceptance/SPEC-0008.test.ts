import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrat de SPEC-0008 (Vitest) : logique pure des états d'interface et faux du service des réglages.
// Les écrans sont joués par SPEC-0008.native.test.tsx (Jest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Modules posés par cette spec : chargés par chemin, avec les types du contrat d'interface recopiés ici.
const load = <T>(file: string): Promise<T> => import(path.resolve(file));

interface Scene {
  overhead: { hex: string } | null;
  upcoming: Array<{ hex: string }>;
}
type SceneState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; scene: Scene; snapshotAtMs: number; nowMs: number };
interface StateNotice {
  kind: "loading" | "denied" | "unavailable" | "empty";
  title: string;
  detail: string | null;
  action: string | null;
}
interface StatesModule {
  STALE_AFTER_MS: number;
  isStale(snapshotAtMs: number, nowMs: number): boolean;
  formatDataTime(timestampMs: number, timeZone: string): string;
  stateNotice(state: SceneState): StateNotice | null;
  staleNotice(state: SceneState, timeZone: string): { text: string } | null;
}
interface SystemSettingsModule {
  createFakeSystemSettings(options?: { failing?: boolean }): {
    openSettings(): Promise<void>;
    readonly openCount: number;
  };
}
const states = () => load<StatesModule>("src/shared/states/index.ts");
const systemSettings = () => load<SystemSettingsModule>("src/shared/system-settings/index.ts");

const NOW = 1_800_000_000_000;
const SECOND = 1000;
const hex = (value: string) => ({ hex: value });

function ready(overrides: Partial<{ scene: Scene; snapshotAtMs: number; nowMs: number }> = {}): SceneState {
  return {
    status: "ready",
    scene: { overhead: null, upcoming: [hex("a1")] },
    snapshotAtMs: NOW,
    nowMs: NOW,
    ...overrides,
  };
}

describe.skip("SPEC-0008 États d'interface (logic)", () => {
  it("CA1 : fixes the staleness delay at three minutes", async () => {
    const { STALE_AFTER_MS } = await states();
    expect(STALE_AFTER_MS).toBe(180_000);
  });

  it("CA1 : is stale from exactly the delay after the snapshot, not before", async () => {
    const { isStale } = await states();
    expect(isStale(NOW, NOW)).toBe(false);
    expect(isStale(NOW, NOW + 179_999)).toBe(false);
    expect(isStale(NOW, NOW + 180_000)).toBe(true);
    expect(isStale(NOW, NOW + 3_600_000)).toBe(true);
  });

  it("CA1 : is never stale for a snapshot dated in the future", async () => {
    const { isStale } = await states();
    expect(isStale(NOW + 5 * SECOND, NOW)).toBe(false);
  });

  it("CA2 : describes the loading state", async () => {
    const { stateNotice } = await states();
    expect(stateNotice({ status: "loading" })).toEqual({
      kind: "loading",
      title: "Recherche des avions…",
      detail: null,
      action: null,
    });
  });

  it("CA2 : describes the denied state with the settings action", async () => {
    const { stateNotice } = await states();
    expect(stateNotice({ status: "denied" })).toEqual({
      kind: "denied",
      title: "Localisation désactivée",
      detail: "Skyline a besoin de votre position pour savoir quels avions passent au-dessus de vous.",
      action: "Ouvrir les réglages",
    });
  });

  it("CA2 : describes the unavailable state as offline, without action", async () => {
    const { stateNotice } = await states();
    expect(stateNotice({ status: "unavailable" })).toEqual({
      kind: "unavailable",
      title: "Hors ligne",
      detail: "Impossible de joindre les avions pour le moment. Nouvelle tentative automatique.",
      action: null,
    });
  });

  it("CA2 : describes a ready scene with no overhead and no upcoming passage as empty", async () => {
    const { stateNotice } = await states();
    expect(stateNotice(ready({ scene: { overhead: null, upcoming: [] } }))).toEqual({
      kind: "empty",
      title: "Aucun passage prévu",
      detail: "Aucun avion ne devrait passer près de vous pour le moment. La liste se met à jour toute seule.",
      action: null,
    });
  });

  it("CA2 : has nothing to say for a scene with an upcoming passage or an overhead aircraft", async () => {
    const { stateNotice } = await states();
    expect(stateNotice(ready({ scene: { overhead: null, upcoming: [hex("a1")] } }))).toBeNull();
    expect(stateNotice(ready({ scene: { overhead: hex("h1"), upcoming: [] } }))).toBeNull();
    expect(stateNotice(ready({ scene: { overhead: hex("h1"), upcoming: [hex("a1"), hex("b2")] } }))).toBeNull();
  });

  it("CA3 : words the stale line with the local time of the snapshot", async () => {
    const { staleNotice } = await states();
    const state = ready({ snapshotAtMs: 1_800_000_000_000, nowMs: 1_800_000_000_000 + 180_000 });
    expect(staleNotice(state, "Europe/Paris")).toEqual({ text: "Données de 09:00 : mise à jour impossible" });
    expect(staleNotice(state, "Pacific/Auckland")).toEqual({ text: "Données de 21:00 : mise à jour impossible" });
    expect(staleNotice(state, "Asia/Kolkata")).toEqual({ text: "Données de 13:30 : mise à jour impossible" });
  });

  it("CA3 : truncates the seconds of the snapshot time and keeps the leading zero", async () => {
    const { staleNotice, formatDataTime } = await states();
    expect(formatDataTime(1_800_000_059_999, "Europe/Paris")).toBe("09:00");
    const state = ready({ snapshotAtMs: 1_799_999_100_000, nowMs: 1_799_999_100_000 + 200_000 });
    expect(staleNotice(state, "Europe/Paris")).toEqual({ text: "Données de 08:45 : mise à jour impossible" });
    expect(formatDataTime(1_799_996_400_000 + 59_000, "Europe/Paris")).toBe("08:00");
  });

  it("CA3 : has no stale line before the delay or without a ready scene", async () => {
    const { staleNotice } = await states();
    expect(staleNotice(ready({ nowMs: NOW + 179_999 }), "Europe/Paris")).toBeNull();
    expect(staleNotice({ status: "loading" }, "Europe/Paris")).toBeNull();
    expect(staleNotice({ status: "denied" }, "Europe/Paris")).toBeNull();
    expect(staleNotice({ status: "unavailable" }, "Europe/Paris")).toBeNull();
  });

  it("CA3 : gives both the empty notice and the stale line for a stale empty scene", async () => {
    const { stateNotice, staleNotice } = await states();
    const state = ready({ scene: { overhead: null, upcoming: [] }, nowMs: NOW + 300_000 });
    expect(stateNotice(state)?.kind).toBe("empty");
    expect(staleNotice(state, "Europe/Paris")).not.toBeNull();
  });

  it("CA4 : counts the calls to the fake settings service", async () => {
    const { createFakeSystemSettings } = await systemSettings();
    const settings = createFakeSystemSettings();
    expect(settings.openCount).toBe(0);
    await settings.openSettings();
    await settings.openSettings();
    expect(settings.openCount).toBe(2);
  });

  it("CA4 : rejects when the fake settings service is failing, and still counts the call", async () => {
    const { createFakeSystemSettings } = await systemSettings();
    const settings = createFakeSystemSettings({ failing: true });
    await expect(settings.openSettings()).rejects.toBeInstanceOf(Error);
    expect(settings.openCount).toBe(1);
  });
});
