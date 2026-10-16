// Point d'entrée : l'interface, le faux et l'appel discret (aucun module natif). L'implémentation réelle vit dans `native.ts`.
export interface SystemSettings {
  /** Ouvre les réglages de l'application dans le système. Rejette si le système refuse. */
  openSettings(): Promise<void>;
}

/** Réglages factices : comptent les appels ; avec `failing`, `openSettings()` rejette (le compteur augmente quand même). */
export function createFakeSystemSettings(options: { failing?: boolean } = {}): SystemSettings & {
  readonly openCount: number;
} {
  let openCount = 0;
  return {
    get openCount() {
      return openCount;
    },
    async openSettings() {
      openCount += 1;
      if (options.failing === true) throw new Error("system settings unavailable");
    },
  };
}

/**
 * Ouvre les réglages sans attendre le résultat. Un rejet est avalé : rien n'est loggé ni envoyé au suivi des erreurs.
 */
export function openSettingsQuietly(settings: SystemSettings): void {
  settings.openSettings().catch(() => undefined);
}
