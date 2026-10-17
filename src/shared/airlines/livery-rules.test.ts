import { describe, expect, it } from "vitest";
import { AIRLINES, hasLivery, LIVERY_CODES, LIVERY_CREDIT, resolveAirline, UNKNOWN_AIRLINE } from "./index";

describe("livery rules", () => {
  it("has a livery exactly when the code is listed", () => {
    const listed = AIRLINES.find((airline) => LIVERY_CODES.includes(airline.code));
    const unlisted = AIRLINES.find((airline) => !LIVERY_CODES.includes(airline.code));
    if (listed) expect(hasLivery(listed)).toBe(true);
    if (unlisted) expect(hasLivery(unlisted)).toBe(false);
  });

  it("has no livery for the unknown airline", () => {
    expect(hasLivery(UNKNOWN_AIRLINE)).toBe(false);
    expect(hasLivery(resolveAirline(null))).toBe(false);
    expect(hasLivery(resolveAirline("ZZZ123"))).toBe(false);
  });

  it("exposes the credit notice", () => {
    expect(LIVERY_CREDIT).toBe(
      "Images des compagnies : Inflight Feed (inflightfeed.com) ; livrées © leurs compagnies. Utilisées pour identifier les vols, sans affiliation.",
    );
  });
});
