import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { parseAdsbLolBody } from "./adsblol-response";

const full = {
  hex: "3C6444",
  flight: "DLH123  ",
  lat: 48.5,
  lon: 2.5,
  alt_baro: 35000,
  gs: 450,
  track: 90,
  seen_pos: 0,
  extra: "ignored",
};

const one = (entry: unknown) => parseAdsbLolBody({ ac: [entry] });

describe("parseAdsbLolBody", () => {
  it("converts units, lowercases hex and trims the callsign", () => {
    const [aircraft] = one(full);
    expect(aircraft).toEqual({
      hex: "3c6444",
      callsign: "DLH123",
      latitude: 48.5,
      longitude: 2.5,
      altitudeM: 35000 * 0.3048,
      groundSpeedKmh: 450 * 1.852,
      trackDeg: 90,
    });
  });

  it("keeps the order of ac", () => {
    const result = parseAdsbLolBody({ ac: [full, { ...full, hex: "000001" }] });
    expect(result.map((a) => a.hex)).toEqual(["3c6444", "000001"]);
  });

  it("returns an empty list for { ac: [] }", () => {
    expect(parseAdsbLolBody({ ac: [] })).toEqual([]);
  });

  it("discards aircraft on the ground", () => {
    expect(one({ ...full, alt_baro: "ground" })).toEqual([]);
  });

  it("keeps an aircraft with a zero ground speed", () => {
    const [aircraft] = one({ ...full, gs: 0 });
    expect(aircraft?.groundSpeedKmh).toBe(0);
  });

  it("discards non ICAO hex such as ~ prefixed addresses", () => {
    expect(one({ ...full, hex: "~abc123" })).toEqual([]);
    expect(one({ ...full, hex: "abc12" })).toEqual([]);
    expect(one({ ...full, hex: "zzzzzz" })).toEqual([]);
  });

  it("sets invalid optional fields to null without discarding the aircraft", () => {
    const [aircraft] = one({ ...full, flight: 42, alt_baro: "high", gs: -1, track: 361 });
    expect(aircraft).toMatchObject({ callsign: null, altitudeM: null, groundSpeedKmh: null, trackDeg: null });
  });

  it("sets absent optional fields to null", () => {
    const [aircraft] = one({ hex: "abc123", lat: 1, lon: 2 });
    expect(aircraft).toMatchObject({ callsign: null, altitudeM: null, groundSpeedKmh: null, trackDeg: null });
  });

  it("sets a blank callsign to null", () => {
    expect(one({ ...full, flight: "   " })[0]?.callsign).toBeNull();
  });

  it("discards entries without a valid position", () => {
    expect(one({ ...full, lat: "48" })).toEqual([]);
    expect(one({ ...full, lat: 91 })).toEqual([]);
    expect(one({ ...full, lon: -181 })).toEqual([]);
    expect(one({ hex: "abc123", lon: 2 })).toEqual([]);
  });

  it("discards entries that are not objects", () => {
    expect(parseAdsbLolBody({ ac: [null, 3, "x", [], full] })).toHaveLength(1);
  });

  it("treats a missing or negative seen_pos as 0", () => {
    const { seen_pos: _omit, ...withoutSeenPos } = full;
    expect(one(withoutSeenPos)[0]?.latitude).toBe(48.5);
    expect(one({ ...full, seen_pos: -5, track: 0 })[0]?.latitude).toBe(48.5);
  });

  it("advances the position by seen_pos", () => {
    const [aircraft] = one({ ...full, track: 0, gs: 194.4384, seen_pos: 10 });
    expect(aircraft?.latitude).toBeGreaterThan(48.5);
  });

  it("discards an aircraft at a pole once its position is advanced", () => {
    expect(one({ ...full, lat: 90, seen_pos: 5 })).toEqual([]);
  });

  it.each([null, "text", 3, [], {}, { ac: null }, { ac: {} }, { ac: "x" }])(
    "rejects an unreadable body %j with ADSB_UNAVAILABLE",
    (body) => {
      expect(() => parseAdsbLolBody(body)).toThrow(AppError);
      try {
        parseAdsbLolBody(body);
      } catch (error) {
        expect((error as AppError).code).toBe("ADSB_UNAVAILABLE");
      }
    },
  );
});
