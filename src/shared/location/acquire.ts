import { AppError } from "../errors";
import type { LocationService, ObserverFix } from "./index";

/**
 * Demande la permission puis lit la position, à chaque appel (jamais de cache : l'observateur a pu bouger).
 * Aucun log ici : la position ne doit pas fuiter.
 */
export async function acquireObserver(location: LocationService): Promise<ObserverFix> {
  const permission = await location.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  try {
    return { status: "granted", position: await location.getPosition() };
  } catch (error) {
    // Permission retirée entre les deux appels : même issue qu'un refus. Les autres erreurs remontent telles quelles.
    if (error instanceof AppError && error.code === "LOCATION_DENIED") return { status: "denied" };
    throw error;
  }
}
