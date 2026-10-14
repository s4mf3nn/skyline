import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import type { AdsbSource } from "../adsb";
import type { Clock } from "../clock";
import type { AppLifecycle } from "../lifecycle";
import type { LocationService } from "../location";
import type { ErrorReporter } from "../monitoring";

/**
 * Les services tiers, injectés dans l'application : des faux en test, les implémentations réelles en prod.
 * `lifecycle` est facultatif : sans lui, l'application ne se réactualise simplement pas au retour au premier plan.
 */
export interface AppServices {
  clock: Clock;
  location: LocationService;
  adsb: AdsbSource;
  monitoring: ErrorReporter;
  lifecycle?: AppLifecycle;
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }): ReactElement {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/** Services de l'application ; échoue hors d'un `ServicesProvider` (erreur de programmation, pas d'état métier). */
export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (services === null) throw new Error("useServices must be used inside a ServicesProvider");
  return services;
}
