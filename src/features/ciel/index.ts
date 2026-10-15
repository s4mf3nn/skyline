import type { Feature } from "../../shared/feature";
import { useSkyPresence } from "./hooks/use-sky-presence";
import { SkyScreen } from "./screens/sky-screen";

// Ciel est la page 0 du pager ; elle n'existe que pendant un survol ou tant que l'avion est retenu.
export const feature: Feature = { name: "ciel", order: 0, screen: SkyScreen, presence: useSkyPresence };
