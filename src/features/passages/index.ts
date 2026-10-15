import type { Feature } from "../../shared/feature";
import { PassagesScreen } from "./screens/passages-screen";

export { flightLabel, formatMetric } from "./service";

// Pas de crochet de présence : la page Prochains passages est toujours présente.
export const feature: Feature = { name: "passages", order: 1, screen: PassagesScreen };
