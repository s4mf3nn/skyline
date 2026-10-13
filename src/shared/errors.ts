// Codes d'erreur métier : en anglais, stables, testables par `code`.
export type ErrorCode = "LOCATION_DENIED" | "ADSB_UNAVAILABLE";

/** Erreur métier typée : le code sert aux appelants, le message n'est jamais affiché tel quel. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}
