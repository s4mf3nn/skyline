import type { LocationService, Position } from "./index";

/** Lit « latitude,longitude » ; renvoie `undefined` si le texte est absent ou hors des bornes. */
export function parseManualPosition(raw: string | undefined): Position | undefined {
  const parts = raw?.split(",").map((part) => part.trim());
  if (parts?.length !== 2 || parts.some((part) => part === "")) return undefined;
  const [latitude, longitude] = parts.map(Number);
  if (latitude === undefined || longitude === undefined) return undefined;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return undefined;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

/** Position fixée à la main : la permission est accordée d'office, le cap reste celui du service réel. */
export function createManualLocation(position: Position, base: LocationService): LocationService {
  return {
    requestPermission: async () => "granted",
    getPosition: async () => ({ ...position }),
    watchHeading: (onHeading) => base.watchHeading(onHeading),
  };
}

/** La position manuelle n'est choisie qu'en développement et si la valeur demandée est valide. */
export function chooseLocation(input: {
  isDev: boolean;
  requested: string | undefined;
  real: LocationService;
}): LocationService {
  const position = input.isDev ? parseManualPosition(input.requested) : undefined;
  return position ? createManualLocation(position, input.real) : input.real;
}
