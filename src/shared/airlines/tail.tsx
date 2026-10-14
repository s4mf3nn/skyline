import type { ReactElement } from "react";
import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Path } from "react-native-svg";
import type { TailPalette } from "./types";

// Géométrie recopiée de `Fin.dc.html` (docs/brief) : ce sont des tracés, pas des couleurs.
const FIN_PATH = "M 36 14 Q 40 2 54 2 L 150 2 L 460 440 L 116 440 Z";
const STRIPE1_PATH = "M 0 300 L 320 160 L 320 236 L 0 376 Z";
const STRIPE2_PATH = "M 0 394 L 320 254 L 320 286 L 0 426 Z";
const DISC = { cx: 176, cy: 196, r: 66 };

// Miroir horizontal : la dérive est orientée vers la gauche (viewBox de 300 de large).
const MIRROR = "matrix(-1 0 0 1 300 0)";

interface AirlineTailProps {
  palette: TailPalette;
  width: number;
  height: number;
}

/** Dérive générique dessinée ; une bande ou un disque `null` n'est pas rendu. */
export function AirlineTail({ palette, width, height }: AirlineTailProps): ReactElement {
  // Identifiant par instance : deux dérives d'un même écran ne partagent pas leur découpage.
  const clipId = `fin-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <Svg viewBox="0 0 300 440" width={width} height={height}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={FIN_PATH} />
        </ClipPath>
      </Defs>
      <G transform={MIRROR}>
        <Path d={FIN_PATH} fill={palette.base} />
        <G clipPath={`url(#${clipId})`}>
          {palette.stripe1 !== null && <Path d={STRIPE1_PATH} fill={palette.stripe1} />}
          {palette.stripe2 !== null && <Path d={STRIPE2_PATH} fill={palette.stripe2} />}
          {palette.disc !== null && <Circle cx={DISC.cx} cy={DISC.cy} r={DISC.r} fill={palette.disc} />}
        </G>
      </G>
    </Svg>
  );
}
