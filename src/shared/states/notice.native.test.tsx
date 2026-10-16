import { fireEvent, render, screen } from "@testing-library/react-native";
import { StaleNoticeView, StateNoticeView } from "./notice";

const DENIED = {
  kind: "denied",
  title: "Localisation désactivée",
  detail: "Détail",
  action: "Ouvrir les réglages",
} as const;

describe("StateNoticeView", () => {
  it("renders testID, title and detail without button when no action", async () => {
    await render(
      <StateNoticeView notice={{ kind: "loading", title: "Recherche des avions…", detail: null, action: null }} />,
    );
    expect(screen.getByTestId("passages-notice-loading")).toBeOnTheScreen();
    expect(screen.getByText("Recherche des avions…")).toBeOnTheScreen();
    expect(screen.queryByTestId("passages-notice-action")).toBeNull();
  });

  it("shows the button only with both action and onAction", async () => {
    const onAction = jest.fn();
    await render(<StateNoticeView notice={DENIED} />);
    expect(screen.queryByTestId("passages-notice-action")).toBeNull();
    await screen.rerender(<StateNoticeView notice={DENIED} onAction={onAction} />);
    fireEvent.press(screen.getByRole("button", { name: "Ouvrir les réglages" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("passages-notice-action")).toBeOnTheScreen();
  });
});

describe("StaleNoticeView", () => {
  it("renders the text under the screen testID", async () => {
    await render(
      <StaleNoticeView screen="ciel" notice={{ text: "Données de 09:00 : mise à jour impossible" }} color="#fff" />,
    );
    expect(screen.getByTestId("data-stale-notice-ciel")).toBeOnTheScreen();
    expect(screen.getByText("Données de 09:00 : mise à jour impossible")).toBeOnTheScreen();
  });
});
