# Plan SPEC-0005
Statut : PRÊT
Questions :
1. **Amendement de SPEC-0003 absent (page absente, `feature.presence`).** La spec le pose comme prérequis de `/plan` et le met « Hors périmètre » ; il n'est pas sur main : `Feature` n'a pas de `presence`, `Pager` monte toujours deux pages et s'ouvre sur la page 0, `createApp` fige la racine. Le contrat natif de SPEC-0005 (CA7, CA8, CA13, CA14, CA15) joue pourtant ce comportement. Recommandation : l'absorber dans ce plan (T2), avec un amendement textuel de SPEC-0003 (« s'ouvre sur Ciel », page absente) et du « Hors périmètre » de SPEC-0005 fusionné avec cette PR de plan, comme pour `src/shared/format/` dans le plan de SPEC-0006 ; le retrait pendant un glissement (INV9), que nul contrat ne joue, est couvert par `pager.native.test.tsx`. Autre réponse : attendre `/new-spec SPEC-0003` (amendement et tests de contrat), puis retirer T2 de ce plan.
2. **Amendement de SPEC-0004 absent (une seule scène par application, INV1).** `useScene` crée un contrôleur par appelant : avec le crochet de présence (appelé par le pager) et l'écran Passages, chaque application demanderait deux fois la permission et interrogerait deux fois la source, et INV1 ne tiendrait que parce que les deux contrôleurs démarrent au même instant. Recommandation : l'absorber dans ce plan (T1, `useScene` garde sa signature, ses contrats passent tels quels), avec l'amendement textuel de SPEC-0004. Autres réponses : attendre `/new-spec SPEC-0004` puis retirer T1 ; ou accepter deux contrôleurs (T1 supprimée, risque d'écart d'un tick entre Ciel et la carte « En ce moment »).
3. **Statut de la spec.** `spec.md` sur main porte `Statut : BROUILLON` alors que sa PR (#72) est fusionnée. Recommandation : passer à `VALIDÉE` dans l'amendement textuel des questions 1 et 2. Le chargement d'Archivo (amendement de SPEC-0002) ne bloque pas : la spec dit qu'il est sans effet sur les critères, et le token `font-archivo` existe déjà.

Réponses du propriétaire (2026-10-15) : 1, 2 et 3 confirmées selon les recommandations ; amendements textuels de SPEC-0003, SPEC-0004 et SPEC-0005 fusionnés avec cette PR.

Constats partagés :
- **Interface figée du pager (T2, lue par T4 et T5)** : `src/shared/feature.ts` exporte `type PageName = "ciel" | "passages"` et `Feature.presence?: (displayedPage: PageName) => boolean`. Le pager nomme les pages par leur index (`0` = `"ciel"`, `1` = `"passages"`, convention déjà écrite sur `PageIndex`), appelle `presence` dans un composant sonde monté hors de l'écran, et une page sans `presence` est toujours présente (contrats de SPEC-0003 inchangés).
- **Interface figée de la scène (T1)** : `useScene(): SceneView & { refresh(): void }` ne change pas ; seule sa source change (un magasin par application, fourni par `createApp`).
- **Interface figée de Ciel (T3, T4, lue par T5)** : celle du « Contrat d'interface » de la spec, plus `skyInputOf(state: SceneState): { scene: Scene | null; denied: boolean }` dans `service.ts` ; `useSkyPresence(displayedPage: SkyPage): boolean` (le `presence` de la feature) et `useShownSky(): SkyView | null` (lu par l'écran) dans `src/features/ciel/hooks/`.
- **Contrats** : `tests/acceptance/SPEC-0005.test.ts` et `tests/acceptance/SPEC-0005.native.test.tsx` gardent leur `describe.skip` jusqu'à T5. Une tâche peut retirer un `.skip` en local pour vérifier ses critères, sans commiter ce retrait. `src/features.gen.ts` est généré : la feature `ciel` entre dans l'application dès que `src/features/ciel/index.ts` existe (T5 seulement).
- **Bibliothèques consultées par le planner** : cache (`react-native-reanimated 4.5.1`, `react-native-gesture-handler 2.32`) ; Context7 `/software-mansion/react-native-reanimated/4.1.5` (rappel de `withTiming` : `finished` vaut `false` si l'animation est interrompue) et `/software-mansion/react-native-gesture-handler` (doc de `main`, pas de version 2.32 : aucune garantie qu'`enabled(false)` annule un geste actif). D'où les choix de T2 : retrait de page piloté par un minuteur JS de `PAGER_METRICS.transitionMs` (déterministe sous les minuteurs factices de Jest) et annulation du geste par une valeur partagée lue dans les callbacks, pas par `enabled`.

## Groupe 1 (parallèle)
### T1 : Une seule scène par application
- Périmètre : src/shared/scene/store.ts, src/shared/scene/store.test.ts, src/shared/scene/provider.tsx, src/shared/scene/use-scene.ts, src/shared/scene/index.ts, src/app.tsx
- Dépend de : aucune
- Risque : moyen (code partagé lu par les deux écrans et par la présence de Ciel ; `createApp` du socle modifié)
- Critères de la spec couverts : CA8, CA17
- Définition de fini : `pnpm verify` vert, contrats de SPEC-0004 et SPEC-0006 inchangés et verts. `store.test.ts` (Vitest, faux de `src/shared/`) couvre : contrôleur démarré au premier abonné seulement (aucune requête ni permission sans abonné), deux abonnés pour une seule requête et une seule demande de permission, arrêt du contrôleur et désabonnement du cap au départ du dernier abonné, `refresh` relayé, deux magasins créés sur deux jeux de services indépendants. `useScene` garde sa signature (interface figée ci-dessus). Aucun log.
- Conception :
  ```diff
   src/shared/scene
  +├── store.ts          # NOUVEAU : createSceneStore, un contrôleur partagé, compté par abonnés
  +├── store.test.ts
  +├── provider.tsx      # NOUVEAU : SceneProvider, un magasin par ServicesProvider
  ~├── use-scene.ts      # MODIFIÉ : lit le magasin du contexte (useSyncExternalStore)
  ~└── index.ts          # MODIFIÉ : exporte SceneProvider
  ~src/app.tsx           # MODIFIÉ : <ServicesProvider><SceneProvider><Screen/></SceneProvider></ServicesProvider>
  ```
  ```ts
  interface SceneStore {
    getView(): SceneView
    subscribe(listener: () => void): () => void   // premier abonné : createSceneController ; dernier parti : stop()
    refresh(): void
  }
  createSceneStore(services: SceneServices): SceneStore
  SceneProvider(props: { children: ReactNode }): ReactElement      // useServices() → useMemo(createSceneStore)
  useScene(): SceneView & { refresh(): void }                      // inchangé
  ```
  ```diff
   PassagesScreen / présence de Ciel (T4)
  -  useScene() → createSceneController(services, setView)   # un contrôleur par appelant
  +  useScene() → useContext(SceneStoreContext)
  +    useSyncExternalStore(store.subscribe, store.getView)
  +      store : un createSceneController par application → location, adsb, clock
  ```
  Ordre de construction :
  1. `SceneProvider` monté par `createApp`, magasin qui délègue à un seul contrôleur démarré tout de suite. Vérifié par les contrats natifs de SPEC-0004 et SPEC-0006.
  2. Démarrage au premier abonné, arrêt au dernier. Vérifié par `store.test.ts` et le test CA16 de SPEC-0004 (désabonnement du cap au démontage).
  3. Deux abonnés, une requête ; deux applications, deux magasins. Vérifié par `store.test.ts`.
  Scénarios de changement :
  - Minuteur de 10 s et pause en arrière-plan (SPEC-0007) : `controller.ts` seul ; le magasin ne fait que relayer.
  - Données effacées au refus de permission en cours d'usage (SPEC-0008) : `controller.ts` seul.

### T2 : Pager à page absente
- Périmètre : src/shared/feature.ts, src/shared/pager/
- Dépend de : aucune
- Risque : moyen (composant partagé monté par `createApp`, geste et animation sur le fil d'interface ; les contrats de SPEC-0003 doivent rester verts)
- Critères de la spec couverts : CA7, CA13, CA14, CA15
- Définition de fini : `pnpm verify` vert, contrats de SPEC-0003 inchangés et verts. `index.test.ts` couvre les fonctions pures ci-dessous (deux pages présentes, une absente, page affichée qui disparaît, réapparition pendant la transition). `pager.native.test.tsx` joue, avec des features factices dont `presence` lit une variable du test : une seule page sans indicateur ni geste, ouverture sur la page présente, apparition sans changement de page affichée, retrait immédiat d'une page non affichée, retrait de la page affichée à la fin des 380 ms (écran encore monté à 100 ms), retrait annulé si la page réapparaît avant la fin, retrait pendant un glissement (`fireGestureHandler`) : la bande rejoint la page restante et le relâchement ne change pas de page, `presence` reçoit `"ciel"` puis `"passages"` selon la page affichée. Interface figée ci-dessus.
- Conception :
  ```diff
  ~src/shared/feature.ts           # MODIFIÉ : PageName, Feature.presence?
   src/shared/pager
  ~├── index.ts                    # MODIFIÉ : fonctions pures de présence
  ~├── index.test.ts
  +├── presence-probe.tsx          # NOUVEAU : appelle feature.presence(displayedPage), remonte le booléen
  ~├── pager.tsx                   # MODIFIÉ : présence, emplacement vide, retrait différé, geste bridé
  ~└── pager.native.test.tsx
  ```
  ```ts
  type PageName = "ciel" | "passages"
  type PagePresence = readonly [boolean, boolean]
  pageName(page: PageIndex): PageName
  initialPresence(pages: readonly [Feature, Feature]): PagePresence   // vrai pour une page sans presence
  initialPage(present: PagePresence): PageIndex                       // première page présente
  pageAfterPresence(page: PageIndex, present: PagePresence): PageIndex // l'autre page si `page` disparaît
  keepsMounted(present: boolean, mounted: boolean, transitioning: boolean): boolean
  swipeAllowed(present: PagePresence): boolean                        // les deux pages présentes
  PresenceProbe(props: { presence: (p: PageName) => boolean; displayedPage: PageName; onChange(present: boolean): void }): null
  ```
  ```diff
   createApp → Pager({ pages })
  +  PresenceProbe × page avec presence → presence(pageName(page)) → setPresent
  +  page = pageAfterPresence(page, present)          # transition de 380 ms si la page affichée disparaît
  +  mounted[i] = keepsMounted(present[i], mounted[i], transitioning)   # minuteur JS de transitionMs
  +  PageSlot : écran si mounted[i], sinon View vide de même largeur (offsets inchangés)
  +  swipeEnabled (valeur partagée) = swipeAllowed(present) → onUpdate ignoré, onEnd revient au repos
  +  PageIndicator seulement si les deux pages sont montées
  ```
  Ordre de construction :
  1. `Feature.presence` et la sonde ; une page absente rend un emplacement vide, sans indicateur, ouverture sur la page présente. Vérifié par `pager.native.test.tsx` (une page) et les contrats de SPEC-0003.
  2. Apparition et retrait immédiat d'une page non affichée. Vérifié par `pager.native.test.tsx`.
  3. Retrait de la page affichée : transition, démontage différé, annulation. Vérifié par `pager.native.test.tsx` (100 ms, 500 ms).
  4. Geste bridé pendant un retrait. Vérifié par `fireGestureHandler` dans `pager.native.test.tsx`.
  Scénarios de changement :
  - Une troisième page conditionnelle (MVP) : `PageName`, `PagePresence` et les fonctions de `index.ts`, puis `pager.tsx` ; accepté, le pager est borné à deux pages par SPEC-0003.
  - Transition de retrait de durée différente : `PAGER_METRICS` seul.

### T3 : Logique pure de l'écran Ciel
- Périmètre : src/features/ciel/service.ts, src/features/ciel/service.test.ts
- Dépend de : aucune
- Risque : moyen (`service.ts` : règle de présence d'INV9, ordre des six règles sensible à la mutation)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5, CA18
- Définition de fini : `pnpm verify` vert. Le contrat Vitest (`tests/acceptance/SPEC-0005.test.ts`) passe en local avec `.skip` retiré, sans commiter ce retrait, CA18 compris (déjà satisfait par `src/shared/format/`, aucune modification). `service.test.ts` couvre ce que le contrat ne joue pas : `skyInputOf` pour chaque statut de `SceneState`, chaque règle de `nextSkyState` isolée (une seule condition vraie), entrées gelées (`Object.freeze`) non modifiées, même objet `passage` rendu en `retenu`. Seuls imports : `src/shared/airlines/index.ts`, `src/shared/scene/index.ts`, `src/shared/format/index.ts` ; ni React ni horloge. Interface figée ci-dessus.
- Conception :
  ```diff
   src/features/ciel
  +├── service.ts         # NOUVEAU : CIEL_METRICS, SKY_ABSENT, buildSkyView, nextSkyState, skyInputOf
  +└── service.test.ts
  ```
  ```ts
  type SkyPage = "ciel" | "passages"   // même valeurs que PageName (src/shared/feature.ts, T2)
  buildSkyView(passage: Passage): SkyView
  nextSkyState(input: { previous: SkyState; scene: Scene | null; denied: boolean; displayedPage: SkyPage }): SkyState
  skyInputOf(state: SceneState): { scene: Scene | null; denied: boolean }   // ready → scene ; denied → denied
  ```
  ```diff
   useSkyPresence (T4)
  +  skyInputOf(view.state) → nextSkyState({ previous, scene, denied, displayedPage })
   useShownSky (T4)
  +  buildSkyView(shown)
  +    resolveAirline(callsign) → airlineTheme(airline)            (src/shared/airlines)
  +    formatMetric(groundSpeedKmh | altitudeM), flightLabel       (src/shared/format)
  ```
  Ordre de construction :
  1. `CIEL_METRICS`, `buildSkyView` avec les six lignes. Vérifié par CA1 et CA2 du contrat.
  2. `nextSkyState`, règles 1 à 6 dans l'ordre, une fonction par règle si besoin de lisibilité. Vérifié par CA3 et CA4.
  3. Scène `null`, immutabilité, `skyInputOf`. Vérifié par CA5 et `service.test.ts`.
  Scénarios de changement :
  - Type d'appareil fourni (SPEC-0009) : la ligne `aircraft` de `buildSkyView` seule.
  - Nouvelle règle de présence (ex. avion retenu limité dans le temps) : `nextSkyState` et une entrée de plus ; `use-sky-presence.ts` (T4) passe la nouvelle entrée. Deux fichiers, accepté.

## Groupe 2 (après fusion du groupe 1)
### T4 : Crochet de présence et avion montré, par application
- Périmètre : src/features/ciel/hooks/
- Dépend de : T1, T3
- Risque : moyen (état par application qui survit au démontage de l'écran ; ordre des mises à jour entre scène, page affichée et retrait différé du pager)
- Critères de la spec couverts : CA6, CA12, CA13, CA15, CA16, CA17
- Définition de fini : `pnpm verify` vert. `hooks/sky-store.test.ts` (Vitest) couvre : état initial `SKY_ABSENT` et `shown` nul ; `shown` suit `state.passage` quand il est non nul et garde le dernier avion quand l'état passe à `absent` (CA13) ; abonnés notifiés une fois par changement, pas pour un état identique ; `skyStoreFor` rend le même magasin pour les mêmes services et deux magasins pour deux jeux de services (CA17). Le crochet ne logge rien et n'appelle pas le suivi des erreurs. Interface figée ci-dessus.
- Conception :
  ```diff
   src/features/ciel/hooks
  +├── sky-store.ts           # NOUVEAU : état de Ciel + avion montré, un magasin par AppServices
  +├── sky-store.test.ts
  +├── use-sky-presence.ts    # NOUVEAU : presence de la feature (appelé par la sonde du pager)
  +└── use-shown-sky.ts       # NOUVEAU : vue de l'avion montré, lue par l'écran
  ```
  ```ts
  interface SkySnapshot { state: SkyState; shown: Passage | null }
  interface SkyStore { get(): SkySnapshot; update(state: SkyState): void; subscribe(listener: () => void): () => void }
  createSkyStore(): SkyStore
  skyStoreFor(services: AppServices): SkyStore     // WeakMap<AppServices, SkyStore>
  useSkyPresence(displayedPage: SkyPage): boolean  // presence !== "absent"
  useShownSky(): SkyView | null                    // buildSkyView(shown), mémoïsé sur shown
  ```
  ```diff
   Pager → PresenceProbe → useSkyPresence(displayedPage)
  +  store = skyStoreFor(useServices())
  +  view = useScene()                                         (src/shared/scene, T1)
  +  useEffect([view.state, displayedPage]) :
  +    store.update(nextSkyState({ previous: store.get().state, ...skyInputOf(view.state), displayedPage }))
  +  useSyncExternalStore(store.subscribe, store.get).state.presence !== "absent"
   SkyScreen (T5) → useShownSky() → store.get().shown → buildSkyView
  ```
  Ordre de construction :
  1. `createSkyStore` et `skyStoreFor`. Vérifié par `sky-store.test.ts`.
  2. `useSkyPresence` branché sur une feature provisoire dans un test local (non commité) avec un écran sonde. Vérifié par CA7, CA8 et CA14 du contrat natif en local.
  3. `useShownSky` et retenue. Vérifié par CA12, CA13 et CA15 du contrat natif en local avec l'écran de T5 bouchonné, ou à défaut en T5.
  Scénarios de changement :
  - Avion retenu effacé au retour au premier plan (évolution du cycle « Page Ciel ») : `nextSkyState` (T3) et l'entrée passée par `use-sky-presence.ts`. Deux fichiers, accepté.
  - Pager qui fournit un emplacement d'état par page (au lieu de la `WeakMap`) : `skyStoreFor` seul.

## Groupe 3 (après fusion du groupe 2)
### T5 : Écran Ciel, feature et activation des contrats
- Périmètre : src/features/ciel/index.ts, src/features/ciel/screens/, tests/acceptance/SPEC-0005.test.ts, tests/acceptance/SPEC-0005.native.test.tsx
- Dépend de : T1, T2, T3, T4
- Risque : moyen (la feature entre dans le registre généré et ajoute une page conditionnelle à l'application livrée)
- Critères de la spec couverts : CA6, CA8, CA9, CA10, CA11, CA12, CA16, CA17
- Définition de fini : `pnpm verify` vert avec le `.skip` retiré du `describe` de `tests/acceptance/SPEC-0005.test.ts` et du `describe` de `tests/acceptance/SPEC-0005.native.test.tsx` (tâche de clôture : ce retrait active les scénarios cachés en CI). `screens/sky-screen.native.test.tsx` couvre ce que le contrat ne joue pas : aucun texte d'unité (`km/h`, `m`) dans l'écran, `fontVariant` `tabular-nums` sur les valeurs, rendu `null` sans avion montré. Aucun calcul dans le `.tsx` : couleurs et valeurs viennent de `SkyView`, mesures de `CIEL_METRICS`. Aucun log ni appel au suivi des erreurs. PR : capture du parcours sur simulateur iPhone (393 × 852 pt) avec la source de démonstration (apparition à gauche, ouverture, colonne à `top` 448, dérive en bas à gauche, retenue, retrait), comparée à `01-ciel-iberia.png` et `02-ciel-air-france.png`, écarts listés. Interface figée ci-dessus.
- Conception :
  ```diff
   src/features/ciel
  +├── index.ts                         # NOUVEAU : feature { name: "ciel", order: 0, screen: SkyScreen, presence: useSkyPresence }
  +└── screens
  +    ├── sky-screen.tsx               # NOUVEAU : fond, colonne d'infos, dérive, accent du pager
  +    └── sky-screen.native.test.tsx
  ```
  ```ts
  export const feature: Feature   // presence: useSkyPresence (Feature.presence de T2)
  SkyScreen(): ReactElement | null
  ```
  ```diff
   Pager → PageSlot(0) → SkyScreen
  +  view = useShownSky()                                            (hooks, T4)
  +  usePagerAccent(view?.theme.small ?? null)                       (src/shared/pager)
  +  View testID="sky-screen" style={{ backgroundColor: view.theme.bg }}
  +    colonne (CIEL_METRICS) : view.rows → Text sky-label-<key> (big, 0,7) · Text sky-value-<key> (big)
  +    View testID="sky-tail" → AirlineTail(view.airline.tail, 272 × 399, left −60)   (src/shared/airlines/tail.tsx)
  ```
  Ordre de construction :
  1. `index.ts` et un écran qui rend `sky-screen` sur `theme.bg`. Vérifié par CA6, CA7 et CA8 du contrat natif.
  2. Colonne d'infos, dérive, accent. Vérifié par CA9, CA10 et CA11.
  3. Retenue, retrait, deux applications, retrait des `.skip`. Vérifié par CA12 à CA17 et `pnpm verify`, puis capture sur simulateur.
  Scénarios de changement :
  - Flèche et bloc route (SPEC-0009) : un composant de route dans `screens/` (ou `components/`) et les champs de `SkyView` dans `service.ts`. Deux fichiers, accepté.
  - Images de dérive réelles (SPEC-0010) : `sky-screen.tsx` seul (choix du composant de dérive).
