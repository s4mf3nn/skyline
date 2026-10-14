/** Palette de la dérive d'une compagnie : `null` quand l'élément est absent. */
export interface TailPalette {
  base: string;
  stripe1: string | null;
  stripe2: string | null;
  disc: string | null;
}

export interface Airline {
  /** Code OACI principal en majuscules, `xx` pour la compagnie inconnue. */
  code: string;
  name: string;
  country: string | null;
  primary: string;
  /** Couleur de texte avant correction par `fit()`. */
  secondary: string;
  iata: readonly string[];
  icao: readonly string[];
  tail: TailPalette;
}

export interface AirlineTheme {
  bg: string;
  big: string;
  small: string;
  track: string;
}
