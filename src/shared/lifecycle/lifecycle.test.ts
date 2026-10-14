import { beforeEach, describe, expect, it, vi } from "vitest";

// `react-native` est natif : il est remplacé, le module réel n'est jamais chargé.
const reactNative = vi.hoisted(() => ({
  AppState: { currentState: "active", addEventListener: vi.fn() },
}));
vi.mock("react-native", () => reactNative);

import { createAppStateLifecycle } from "./app-state";
import { createFakeLifecycle } from "./index";

describe("createFakeLifecycle", () => {
  it("calls nothing before enterForeground", () => {
    const lifecycle = createFakeLifecycle();
    const listener = vi.fn();
    lifecycle.onForeground(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("calls every listener on enterForeground", () => {
    const lifecycle = createFakeLifecycle();
    const first = vi.fn();
    const second = vi.fn();
    lifecycle.onForeground(first);
    lifecycle.onForeground(second);
    lifecycle.enterForeground();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops calling a listener after unsubscribe", () => {
    const lifecycle = createFakeLifecycle();
    const kept = vi.fn();
    const removed = vi.fn();
    lifecycle.onForeground(kept);
    const unsubscribe = lifecycle.onForeground(removed);
    unsubscribe();
    lifecycle.enterForeground();
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });
});

describe("createAppStateLifecycle", () => {
  type Change = (state: string) => void;
  let emit: Change;
  const remove = vi.fn();

  beforeEach(() => {
    remove.mockReset();
    reactNative.AppState.currentState = "active";
    reactNative.AppState.addEventListener.mockReset();
    reactNative.AppState.addEventListener.mockImplementation((_type: string, callback: Change) => {
      emit = callback;
      return { remove };
    });
  });

  function subscribe() {
    const listener = vi.fn();
    const unsubscribe = createAppStateLifecycle().onForeground(listener);
    return { listener, unsubscribe };
  }

  it("calls the listener on background to active", () => {
    const { listener } = subscribe();
    emit("background");
    emit("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("calls the listener on inactive to active", () => {
    const { listener } = subscribe();
    emit("inactive");
    emit("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores active to active and active to background", () => {
    const { listener } = subscribe();
    emit("active");
    emit("background");
    expect(listener).not.toHaveBeenCalled();
  });

  it("removes the AppState subscription on unsubscribe", () => {
    const { unsubscribe } = subscribe();
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
