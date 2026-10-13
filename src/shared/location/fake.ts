import { AppError } from "../errors";
import type { LocationPermission, LocationService, Position } from "./index";

interface FakeLocationOptions {
  permission: LocationPermission;
  position: Position;
}

/** Localisation factice : permission et position fixées, cap poussé à la main par `setHeading`. */
export function createFakeLocation(options: FakeLocationOptions): LocationService & {
  setHeading(degrees: number): void;
} {
  const listeners = new Set<(degrees: number) => void>();

  return {
    requestPermission: async () => options.permission,
    async getPosition() {
      if (options.permission !== "granted") {
        throw new AppError("LOCATION_DENIED", "Location permission denied");
      }
      return { ...options.position };
    },
    watchHeading(onHeading) {
      listeners.add(onHeading);
      return () => {
        listeners.delete(onHeading);
      };
    },
    setHeading(degrees) {
      for (const listener of [...listeners]) listener(degrees);
    },
  };
}
