import type { AdsbSource } from "./index";

/** Source réelle provisoire : aucune donnée tant que la spec du client adsb.lol n'est pas posée. */
export function createEmptyAdsbSource(): AdsbSource {
  return { fetchAircraft: async () => [] };
}
