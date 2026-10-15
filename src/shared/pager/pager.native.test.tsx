import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import type { Feature } from "../feature";
import { usePagerAccent } from "./index";
import { Pager } from "./pager";

const CREAM = "#F4F1EA";

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} +1`} onPress={() => setCount(count + 1)}>
      <Text>{`${label}: ${count}`}</Text>
    </Pressable>
  );
}

function feature(name: string, order: number, Screen = () => <Counter label={name} />): Feature {
  return { name, order, screen: Screen };
}

function AccentScreen({ color }: { color: string | null }) {
  usePagerAccent(color);
  return <Text>accent</Text>;
}

async function renderPager(pages: readonly [Feature, Feature] = [feature("a", 0), feature("b", 1)]) {
  await render(<Pager pages={pages} />);
}

function indicator() {
  return screen.getByRole("adjustable", { name: "Indicateur de page" });
}

describe("Pager page presence", () => {
  let skyPresent = true;
  const seen: string[] = [];

  function presentFeature(): Feature {
    return {
      name: "sky",
      order: 0,
      screen: () => <Text>sky screen</Text>,
      presence: (displayed) => {
        seen.push(displayed);
        return skyPresent;
      },
    };
  }

  function others(): Feature {
    return feature("b", 1, () => <Text>passages screen</Text>);
  }

  async function pass(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    skyPresent = true;
    seen.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows a single page without indicator or gesture when the other is absent", async () => {
    skyPresent = false;
    await render(<Pager pages={[presentFeature(), others()]} />);
    expect(screen.getByText("passages screen")).toBeOnTheScreen();
    expect(screen.queryByText("sky screen")).toBeNull();
    expect(screen.queryByRole("adjustable", { name: "Indicateur de page" })).toBeNull();
  });

  it("keeps the displayed page when the absent page appears", async () => {
    skyPresent = false;
    const view = await render(<Pager pages={[presentFeature(), others()]} />);
    skyPresent = true;
    await view.rerender(<Pager pages={[presentFeature(), others()]} />);
    expect(screen.getByText("sky screen")).toBeOnTheScreen();
    expect(indicator()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
  });

  it("removes a page that is not displayed immediately", async () => {
    const view = await render(<Pager pages={[presentFeature(), others()]} />);
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    skyPresent = false;
    await view.rerender(<Pager pages={[presentFeature(), others()]} />);
    expect(screen.queryByText("sky screen")).toBeNull();
    expect(screen.queryByRole("adjustable", { name: "Indicateur de page" })).toBeNull();
  });

  it("removes the displayed page at the end of the transition", async () => {
    const view = await render(<Pager pages={[presentFeature(), others()]} />);
    skyPresent = false;
    await view.rerender(<Pager pages={[presentFeature(), others()]} />);
    await pass(100);
    expect(screen.getByText("sky screen")).toBeOnTheScreen();
    await pass(300);
    expect(screen.queryByText("sky screen")).toBeNull();
    expect(screen.getByText("passages screen")).toBeOnTheScreen();
  });

  it("cancels the removal when the page reappears before the end", async () => {
    const view = await render(<Pager pages={[presentFeature(), others()]} />);
    skyPresent = false;
    await view.rerender(<Pager pages={[presentFeature(), others()]} />);
    await pass(100);
    skyPresent = true;
    await view.rerender(<Pager pages={[presentFeature(), others()]} />);
    await pass(500);
    expect(screen.getByText("sky screen")).toBeOnTheScreen();
    expect(indicator()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
  });

  it("does not change page on release when a page disappears during a drag", async () => {
    const view = await render(<Pager pages={[presentFeature(), others()]} />);
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    const pan = getByGestureTestId("pager-pan");
    await act(async () => {
      fireGestureHandler(pan, [{ state: 2 }, { translationX: 30 }]);
    });
    skyPresent = false;
    await view.rerender(<Pager pages={[presentFeature(), others()]} />);
    await act(async () => {
      fireGestureHandler(pan, [{ translationX: 80, state: 5 }]);
    });
    await pass(500);
    expect(screen.getByText("passages screen")).toBeOnTheScreen();
    expect(screen.queryByText("sky screen")).toBeNull();
  });

  it("passes the displayed page name to presence", async () => {
    await render(<Pager pages={[presentFeature(), others()]} />);
    expect(seen.at(-1)).toBe("ciel");
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(seen.at(-1)).toBe("passages");
  });
});

describe("Pager", () => {
  it("mounts both screens side by side", async () => {
    await renderPager();
    expect(screen.getByText("a: 0")).toBeOnTheScreen();
    expect(screen.getByText("b: 0")).toBeOnTheScreen();
  });

  it("exposes the page as an adjustable value and steps with accessibility actions", async () => {
    await renderPager();
    expect(indicator()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(indicator()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(indicator()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(indicator()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
  });

  it("keeps the local state of a screen after a page change", async () => {
    await renderPager();
    await fireEvent.press(screen.getByRole("button", { name: "a +1" }));
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(screen.getByText("a: 1")).toBeOnTheScreen();
  });

  it("keeps page controls as separate accessible elements", async () => {
    await renderPager();
    expect(screen.getByRole("button", { name: "a +1" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "b +1" })).toBeOnTheScreen();
  });

  it("sizes the traits for the active page", async () => {
    await renderPager();
    expect(screen.getByTestId("pager-indicator-trait-0")).toHaveStyle({ width: 18, height: 4, opacity: 1 });
    expect(screen.getByTestId("pager-indicator-trait-1")).toHaveStyle({ width: 6, height: 4, opacity: 0.4 });
    await fireEvent(indicator(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(screen.getByTestId("pager-indicator-trait-0")).toHaveStyle({ width: 6, height: 4, opacity: 0.4 });
    expect(screen.getByTestId("pager-indicator-trait-1")).toHaveStyle({ width: 18, height: 4, opacity: 1 });
  });

  it("applies the declared accent, follows its changes and falls back to cream on null", async () => {
    function Host({ color }: { color: string | null }) {
      return <Pager pages={[feature("a", 0, () => <AccentScreen color={color} />), feature("b", 1)]} />;
    }
    const view = await render(<Host color="#112233" />);
    expect(screen.getByTestId("pager-indicator-trait-0")).toHaveStyle({ backgroundColor: "#112233" });
    await view.rerender(<Host color="#AABBCC" />);
    expect(screen.getByTestId("pager-indicator-trait-0")).toHaveStyle({ backgroundColor: "#AABBCC" });
    await view.rerender(<Host color={null} />);
    expect(screen.getByTestId("pager-indicator-trait-0")).toHaveStyle({ backgroundColor: CREAM });
  });

  it("uses cream when no page declares an accent", async () => {
    await renderPager();
    expect(screen.getByTestId("pager-indicator-trait-0")).toHaveStyle({ backgroundColor: CREAM });
  });

  describe("pan gesture", () => {
    async function drag(translationX: number) {
      await renderPager();
      await act(async () => {
        fireGestureHandler(getByGestureTestId("pager-pan"), [
          { state: 2 },
          { translationX },
          { translationX, state: 5 },
        ]);
      });
    }

    it("changes page on a -60 pt drag", async () => {
      await drag(-60);
      expect(indicator()).toHaveAccessibilityValue({ text: "Page 2 sur 2" });
    });

    it("stays on the page on a -59.9 pt drag", async () => {
      await drag(-59.9);
      expect(indicator()).toHaveAccessibilityValue({ text: "Page 1 sur 2" });
    });
  });
});
