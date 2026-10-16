import { describe, expect, it, vi } from "vitest";
import type { Passage } from "../../../shared/scene";
import type { AppServices } from "../../../shared/services";
import { SKY_ABSENT } from "../service";
import { createSkyStore, skyStoreFor } from "./sky-store";

const plane = { hex: "aaaaaa" } as Passage;
const other = { hex: "bbbbbb" } as Passage;

describe("createSkyStore", () => {
  it("starts absent with nothing shown", () => {
    expect(createSkyStore().get()).toEqual({ state: SKY_ABSENT, shown: null, shownAtMs: null });
  });

  it("follows the passage and keeps the last plane once absent", () => {
    const store = createSkyStore();
    store.update({ presence: "survol", passage: plane }, 1000);
    expect(store.get().shown).toBe(plane);
    store.update({ presence: "retenu", passage: plane }, 1000);
    store.update(SKY_ABSENT, 2000);
    expect(store.get()).toEqual({ state: SKY_ABSENT, shown: plane, shownAtMs: 1000 });
    store.update({ presence: "survol", passage: other }, 1000);
    expect(store.get().shown).toBe(other);
  });

  it("keeps the scene time of the last shown plane once absent", () => {
    const store = createSkyStore();
    store.update({ presence: "survol", passage: plane }, 1000);
    store.update({ presence: "retenu", passage: plane }, 1000);
    store.update(SKY_ABSENT, 9000);
    expect(store.get().shownAtMs).toBe(1000);
  });

  it("notifies once per change and not for an identical state", () => {
    const store = createSkyStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ presence: "survol", passage: plane }, 1000);
    store.update({ presence: "survol", passage: plane }, 1000);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.update(SKY_ABSENT, 2000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("skyStoreFor", () => {
  it("returns one store per services object", () => {
    const a = {} as AppServices;
    const b = {} as AppServices;
    expect(skyStoreFor(a)).toBe(skyStoreFor(a));
    expect(skyStoreFor(a)).not.toBe(skyStoreFor(b));
  });
});
