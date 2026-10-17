import { render } from "@testing-library/react-native";
import { AIRLINES, UNKNOWN_AIRLINE } from "./index";
import { AirlineLivery, getLiverySource } from "./livery";

// Deux compagnies factices : les vraies images sont posées par une tâche ultérieure.
jest.mock("./livery-codes.gen", () => ({ LIVERY_CODES: ["AFR", "IBE"] }));
jest.mock("./liveries.gen", () => ({ LIVERY_SOURCES: { AFR: { testUri: "afr.png" }, IBE: { testUri: "ibe.png" } } }));

const byCode = (code: string) => {
  const airline = AIRLINES.find((a) => a.code === code);
  if (!airline) throw new Error(`Missing airline ${code}`);
  return airline;
};

describe("livery", () => {
  it("returns a distinct source per airline with a livery", () => {
    expect(getLiverySource(byCode("AFR"))).toEqual({ testUri: "afr.png" });
    expect(getLiverySource(byCode("IBE"))).toEqual({ testUri: "ibe.png" });
  });

  it("returns null without livery, unknown airline included", () => {
    expect(getLiverySource(byCode("EZY"))).toBeNull();
    expect(getLiverySource(UNKNOWN_AIRLINE)).toBeNull();
  });

  it("renders an image with the given size and testID", async () => {
    const screen = await render(<AirlineLivery airline={byCode("AFR")} width={40} height={60} testID="livery" />);
    const image = screen.getByTestId("livery");
    expect(image.props.source).toEqual({ testUri: "afr.png" });
    expect(image.props.accessibilityLabel).toBe(`Livrée ${byCode("AFR").name}`);
  });

  it("renders nothing without livery", async () => {
    const screen = await render(<AirlineLivery airline={UNKNOWN_AIRLINE} width={40} height={60} testID="livery" />);
    expect(screen.queryByTestId("livery")).toBeNull();
  });
});
