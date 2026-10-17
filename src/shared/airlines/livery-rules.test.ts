import { describe, expect, it, vi } from "vitest";
import { AIRLINES, hasLivery, LIVERY_CODES, LIVERY_CREDIT, resolveAirline, UNKNOWN_AIRLINE } from "./index";

// Deux codes de la table : la liste réelle est vide tant qu'aucune image n'est posée.
vi.mock("./livery-codes.gen", () => ({ LIVERY_CODES: ["AFR", "IBE"] }));

const byCode = (code: string) => {
  const airline = AIRLINES.find((a) => a.code === code);
  if (!airline) throw new Error(`Missing airline ${code}`);
  return airline;
};

describe("livery rules", () => {
  it("has a livery exactly when the code is listed", () => {
    expect(LIVERY_CODES).toEqual(["AFR", "IBE"]);
    expect(hasLivery(byCode("AFR"))).toBe(true);
    expect(hasLivery(resolveAirline("IBE3166"))).toBe(true);
    expect(hasLivery(byCode("EZY"))).toBe(false);
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
