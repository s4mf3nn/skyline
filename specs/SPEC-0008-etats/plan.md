# Plan SPEC-0008
Statut : PRÊT
Questions : aucune

Constats partagés :
- **Interface figée** : celle du « Contrat d'interface » de la spec, plus deux ajouts compatibles décrits en T1 (`color?` de `StaleNoticeView`) et T2 (`openSettingsQuietly`).
- **Contrôleur inchangé** : `SceneState` (`src/shared/scene/controller.ts`) porte déjà `loading`, `denied`, `unavailable` et `ready` avec `snapshotAtMs` et `nowMs` ; le retour à `loading` après un refus (CA9) et `unavailable` sans instantané (CA8) y sont déjà. Aucune tâche ne touche `src/shared/scene/`.
- **Contrats** : `tests/acceptance/SPEC-0008.test.ts` et `SPEC-0008.native.test.tsx` gardent leur `describe.skip` jusqu'à T3. Une tâche peut retirer un `.skip` en local pour vérifier ses critères, sans commiter ce retrait.

## Groupe 1 (parallèle)
### T1 : Logique des états d'attente et composants de notice partagés
- Périmètre : src/shared/states/, docs/factory/UI.md
- Dépend de : aucune
- Risque : moyen (code partagé lu par les deux écrans ; textes exacts du contrat)
- Critères de la spec couverts : CA1, CA2, CA3
- Définition de fini : `pnpm verify` vert ; `src/shared/states/index.test.ts` couvre CA1 à CA3 (bornes 179 999 / 180 000, futur, chaque état, `ready` avec survol seul, vide et périmé ensemble, `09:00` en `Europe/Paris`) ; `notice.native.test.tsx` couvre `testID`, textes, bouton présent seulement avec `action` et `onAction`, rôle `button` et nom « Ouvrir les réglages » ; `index.ts` n'importe que les types de `src/shared/scene/` ; section « États standard » de `docs/factory/UI.md` remplie. Contrats : `.skip` laissé. Interface figée ci-dessus.
- Conception :
  ```diff
   src/shared/states
  +├── index.ts               # NOUVEAU : STALE_AFTER_MS, isStale, formatDataTime, stateNotice, staleNotice (pur)
  +├── index.test.ts
  +├── notice.tsx             # NOUVEAU : StateNoticeView, StaleNoticeView (rendu seul)
  +└── notice.native.test.tsx
  ~docs/factory/UI.md         # MODIFIÉ : « États standard »
  ```
  ```ts
  StateNoticeView(props: { notice: StateNotice; onAction?: () => void }): ReactElement
  // ajout proposé : color (défaut ink sur fond neutre) pour Ciel, qui passe theme.small
  StaleNoticeView(props: { screen: "passages" | "ciel"; notice: StaleNotice; color?: string }): ReactElement
  ```
  ```diff
   stateNotice(state)
  +  switch (state.status) → notice fixe ; "ready" : overhead === null && upcoming.length === 0 ? EMPTY : null
   staleNotice(state, timeZone)
  +  state.status === "ready" && isStale(state.snapshotAtMs, state.nowMs) ? { text: `Données de ${formatDataTime(…)} : …` } : null
  ```
  Ordre de construction :
  1. `stateNotice` et ses quatre textes, puis `StateNoticeView` qui les rend ; vérifiés par `index.test.ts` et `notice.native.test.tsx`.
  2. `isStale`, `formatDataTime` (copie de `formatLocalTime`, `formatToParts`), `staleNotice`, puis `StaleNoticeView` ; mêmes tests, puis le contrat Vitest en local.
  Scénarios de changement :
  - Texte corrigé ou traduit : `index.ts` seul (les textes vivent dans les constantes de notice).
  - Délai de péremption réglable (hors périmètre) : `STALE_AFTER_MS` dans `index.ts` seul.
  - Bouton « Réessayer » (hors périmètre) : `action` de la notice `unavailable` et le branchement dans l'écran.

### T2 : Service SystemSettings (interface, faux, Linking) et branchement
- Périmètre : src/shared/system-settings/, src/shared/services/index.tsx, src/main.tsx, docs/adr/0001-stack.md, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : moyen (nouveau service injecté, câblage de `main.tsx` ; aucune donnée personnelle)
- Critères de la spec couverts : CA4, CA7
- Définition de fini : `pnpm verify` vert ; `system-settings.test.ts` couvre le faux (`openCount`, `failing`), `openSettingsQuietly` (rejet avalé, rien loggé) et `native.ts` avec `vi.mock("react-native")` (même procédé que `lifecycle.test.ts`) ; `AppServices.systemSettings?` facultatif ; ligne « Services tiers » de l'ADR-0001 complétée (`src/shared/system-settings/`, `Linking` de React Native) ; entrée `react-native 0.86.3 (Linking.openSettings)` au cache. Contrats : `.skip` laissé.
- Conception :
  ```diff
   src/shared/system-settings
  +├── index.ts                 # NOUVEAU : SystemSettings, createFakeSystemSettings, openSettingsQuietly (sans React Native)
  +├── native.ts                # NOUVEAU : createLinkingSystemSettings() → Linking.openSettings()
  +└── system-settings.test.ts
  ~src/shared/services/index.tsx # MODIFIÉ : systemSettings?: SystemSettings
  ~src/main.tsx                  # MODIFIÉ : systemSettings: createLinkingSystemSettings()
  ```
  ```ts
  interface SystemSettings { openSettings(): Promise<void> }
  createFakeSystemSettings(options?: { failing?: boolean }): SystemSettings & { readonly openCount: number }
  // ajout proposé : appel sans attente ni trace (CA7, INV7), testable sous Vitest
  openSettingsQuietly(settings: SystemSettings): void
  ```
  Ordre de construction :
  1. Interface, faux et `openSettingsQuietly` ; vérifiés par `system-settings.test.ts`.
  2. `native.ts`, champ de `AppServices`, câblage de `main.tsx` ; `pnpm dev`, le service est construit sans erreur.
  Scénarios de changement :
  - Ouvrir une autre page des réglages (Android, `ACTION_LOCATION_SOURCE_SETTINGS`) : `native.ts` seul.
  - Remplacer `Linking` par `expo-linking` : `native.ts` seul.

## Groupe 2 (après fusion du groupe 1)
### T3 : États sur Prochains passages, ligne périmée sur Ciel et activation des contrats
- Périmètre : src/features/passages/screens/passages-screen.tsx, src/features/passages/screens/passages-screen.native.test.tsx, src/features/passages/service.ts, src/features/passages/service.test.ts, src/features/ciel/screens/sky-screen.tsx, src/features/ciel/screens/sky-screen.native.test.tsx, src/features/ciel/service.ts, tests/acceptance/SPEC-0008.test.ts, tests/acceptance/SPEC-0008.native.test.tsx
- Dépend de : T1, T2
- Risque : moyen (modifie les deux écrans livrés ; INV9 et INV7 à préserver)
- Critères de la spec couverts : CA5, CA6, CA7, CA8, CA9, CA10, CA11, CA12, CA13
- Définition de fini : `pnpm verify` vert ; retrait des **deux** `describe.skip` de `tests/acceptance/SPEC-0008.test.ts` et `SPEC-0008.native.test.tsx` (seule modification permise), tous leurs tests verts ainsi que ceux de SPEC-0005 à SPEC-0007 ; aucun calcul dans les `.tsx` ; captures simulateur jointes à la PR (refus et bouton vers les réglages, retour avec chargement puis cartes, mode avion plus de 3 min).
- Conception :
  ```diff
   src/features/passages
  ~├── service.ts                       # MODIFIÉ : passagesScreenOf(view, timeZone), métrique staleNoticeTopPt
  ~└── screens/passages-screen.tsx      # MODIFIÉ : notice à la place de la liste, ligne périmée en surimpression
   src/features/ciel
  ~├── service.ts                       # MODIFIÉ : CIEL_METRICS.staleNoticeTopPt
  ~└── screens/sky-screen.tsx           # MODIFIÉ : useScene() + staleNotice, ligne en surimpression
  ```
  ```ts
  passagesScreenOf(view: SceneView, timeZone: string): {
    cards: PassageCard[]; notice: StateNotice | null; stale: StaleNotice | null }
  ```
  ```diff
   PassagesScreen
  +  passagesScreenOf(useScene(), timeZone)
  +  stale ? <StaleNoticeView screen="passages" …/> (position absolue en haut)
  +  notice ? <StateNoticeView notice onAction={systemSettings && (() => openSettingsQuietly(systemSettings))}/>
  ~        : <FlatList …/>                                   # inchangée
   SkyScreen
  +  staleNotice(useScene().state, timeZone) → <StaleNoticeView screen="ciel" color={theme.small}/>
  ```
  Ordre de construction :
  1. Notices `loading`, `empty`, `unavailable` à la place de la liste (CA5, CA6, CA8, CA12) ; contrat natif en local.
  2. Notice `denied`, bouton et service facultatif (CA7, CA9, CA13) ; même contrat.
  3. Ligne périmée sur Prochains passages puis sur Ciel (CA10, CA11), retrait des `.skip` ; captures simulateur.
  Scénarios de changement :
  - Autre disposition de la ligne périmée : `passages-screen.tsx` et `sky-screen.tsx` (deux écrans, accepté : la spec confie le placement à chaque écran).
  - Nouvel état d'attente (ex. source des routes) : `src/shared/states/index.ts` seul, l'écran rend toute notice.
