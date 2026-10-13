import { describe, expect, it } from "vitest";
import { createEmptyAdsbSource } from "./empty";
import { type AdsbQuery, type Aircraft, createFakeAdsbSource } from "./index";

const AROUND_LYON: AdsbQuery = { latitude: 45.764, longitude: 4.8357, radiusKm: 80 };
const AIRLINER: Aircraft = {
  hex: "3944ef",
  callsign: "AFR1506",
  latitude: 45.91,
  longitude: 4.95,
  altitudeM: 11200,
  groundSpeedKmh: 830,
  trackDeg: 62,
};
const SILENT_GLIDER: Aircraft = {
  hex: "39ac45",
  callsign: null,
  latitude: 45.7,
  longitude: 4.6,
  altitudeM: null,
  groundSpeedKmh: null,
  trackDeg: null,
};

describe("fake ADS-B source", () => {
  it("returns the configured aircraft and records each query", async () => {
    const adsb = createFakeAdsbSource([AIRLINER]);
    await expect(adsb.fetchAircraft(AROUND_LYON)).resolves.toEqual([AIRLINER]);
    adsb.setAircraft([]);
    await expect(adsb.fetchAircraft({ ...AROUND_LYON, radiusKm: 4 })).resolves.toEqual([]);
    expect(adsb.queries).toEqual([AROUND_LYON, { ...AROUND_LYON, radiusKm: 4 }]);
  });

  it("keeps an aircraft with missing fields in the list, with null values", async () => {
    const adsb = createFakeAdsbSource([SILENT_GLIDER]);
    const [glider] = await adsb.fetchAircraft(AROUND_LYON);
    expect(glider).toEqual(SILENT_GLIDER);
    expect(glider?.callsign).toBeNull();
    expect(glider?.altitudeM).toBeNull();
    expect(glider?.groundSpeedKmh).toBeNull();
    expect(glider?.trackDeg).toBeNull();
  });

  it("rejects with ADSB_UNAVAILABLE while unavailable, then recovers", async () => {
    const adsb = createFakeAdsbSource([AIRLINER]);
    adsb.setUnavailable(true);
    await expect(adsb.fetchAircraft(AROUND_LYON)).rejects.toMatchObject({ code: "ADSB_UNAVAILABLE" });
    adsb.setUnavailable(false);
    await expect(adsb.fetchAircraft(AROUND_LYON)).resolves.toEqual([AIRLINER]);
  });

  it("is not changed by later edits of the list it was given", async () => {
    const given = [AIRLINER];
    const adsb = createFakeAdsbSource(given);
    given.push(SILENT_GLIDER);
    await expect(adsb.fetchAircraft(AROUND_LYON)).resolves.toEqual([AIRLINER]);
  });
});

describe("empty ADS-B source", () => {
  it("returns an empty list", async () => {
    await expect(createEmptyAdsbSource().fetchAircraft(AROUND_LYON)).resolves.toEqual([]);
  });
});
