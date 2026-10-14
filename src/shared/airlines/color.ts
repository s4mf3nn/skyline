import { AppError } from "../errors";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const CREAM = "#F4F1EA";
const INK = "#1D1D1B";

type Rgb = [number, number, number];

// Valide à l'entrée : tout calcul de couleur passe par ici.
function parseHex(color: string): Rgb {
  if (!HEX_COLOR.test(color)) {
    throw new AppError("INVALID_COLOR", `Invalid color: expected #RRGGBB, got "${color}"`);
  }
  const channel = (start: number) => Number.parseInt(color.slice(start, start + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

function toHex(channels: Rgb): string {
  const hex = channels.map((value) => Math.round(value).toString(16).padStart(2, "0"));
  return `#${hex.join("").toUpperCase()}`;
}

// Linéarisation sRGB, seuil 0.03928 repris tel quel du handoff (data.js).
function linear(value: number): number {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const [r, g, b] = parseHex(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Interpole `a` vers `b` canal par canal, rendu en #RRGGBB majuscules. */
export function mix(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  return toHex([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]);
}

/** Rapport de contraste WCAG 2.x, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Rend `fg` tel quel s'il atteint `target` sur `bg`, sinon le rapproche du blanc ou du noir. */
export function fit(fg: string, bg: string, target: number): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  // Accumulation flottante volontaire : elle reproduit data.js à l'identique.
  for (let t = 0.02; t <= 0.6001; t += 0.02) {
    const lighter = mix(fg, "#FFFFFF", t);
    if (contrastRatio(lighter, bg) >= target) return lighter;
    const darker = mix(fg, "#000000", t);
    if (contrastRatio(darker, bg) >= target) return darker;
  }
  return contrastRatio(CREAM, bg) > contrastRatio(INK, bg) ? CREAM : INK;
}
