# Plan SPEC-0003
Statut : PRÊT
Décision humaine (2026-10-14) : le plan est livré tel quel. INV9 de `docs/DOMAIN.md` (Ciel absent du pager sans avion, ouverture sur Prochains passages) est reporté dans un amendement porté par SPEC-0005, qui reprendra `src/app.tsx` et `pager.tsx`. La signature du crochet de présence est laissée à cet amendement.

Le découpage ci-dessous suit la spec actuelle. Il reste valable pour T1 (logique pure), quoi que décide l'amendement. T2 et T3 sont à reprendre si l'amendement rend le nombre de pages variable pendant l'exécution.

Constats partagés :
- **Emplacement** : tout le module vit dans `src/shared/pager/` (zone `**/shared/`, risque moyen d'après `docs/factory/RISK.md`). Ce n'est pas une feature, `pnpm gen` ne s'applique pas. Aucune feature n'existe encore dans `src/features/` : les tests montent des features factices.
- **Interface figée** (posée par T1, recopiée du « Contrat d'interface » de la spec) : `PageIndex`, `PagerMetrics`, `IndicatorTrait`, `PAGER_METRICS`, `lockAxis`, `draggedOffset`, `settlePage`, `indicatorTraits`, `selectPages`, `usePagerAccent`. T1 ajoute aussi ces exports, consommés par T2 et T3 : `PAGER_LAYOUT`, `restOffset`, `pageValueText`, `stepPage`, `pagerRoot`, `PageAccents`, `activeAccent`, `withAccent`, `PageAccentContext`. `index.ts` n'importe que `react` (et `import type` de `../feature`) : jamais `react-native`, Reanimated ni Gesture Handler.
- **Worklets** : `lockAxis`, `draggedOffset`, `settlePage` et `restOffset` sont appelés depuis les callbacks du geste, qui tournent sur le fil d'interface. Chacune commence donc par la directive `'worklet';`. Reanimated 4 ne transforme pas automatiquement en worklet une fonction importée d'un autre fichier (Context7 `/software-mansion/react-native-reanimated/4.1.5`, « Manually Workletize Imported Functions »). Sous Vitest, la directive n'a aucun effet. Cette règle est citée pour la 4.1.5 : T2 la revérifie à la 4.5.1 installée (et le pont fil d'interface vers JS pour `setPage` en `onEnd`, par `scheduleOnRN`) avant de l'inscrire au cache.
- **Contrats** : `tests/acceptance/SPEC-0003.test.ts` et `tests/acceptance/SPEC-0003.native.test.tsx` gardent leur `describe.skip` jusqu'à T3. Une tâche peut retirer un `.skip` en local pour vérifier ses critères, sans commiter ce retrait.

## Groupe 1 (parallèle)
### T1 : Logique pure du pager et accent de page
- Périmètre : src/shared/pager/index.ts, src/shared/pager/index.test.ts, src/shared/pager/accent.ts, src/shared/pager/accent.test.ts
- Dépend de : aucune
- Risque : moyen (code partagé lu par `createApp` et par les deux futurs écrans ; les bornes de seuil, d'axe et d'ordre sont des pièges de mutation)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5, CA6
- Définition de fini : `pnpm verify` vert. `index.test.ts` prend chaque borne : 7,99 et 8 pt, `|dx| == |dy|`, 59,9 et 60 pt, glissement vers l'extérieur de 400 pt, `order` égaux, liste de 0, 1 et 3 features, liste reçue non modifiée. Il couvre aussi `pageValueText`, `stepPage` aux deux bords, `restOffset` et les trois formes de `pagerRoot`. `accent.test.ts` couvre `activeAccent` (crème par défaut, `null` vers crème, casse conservée) et `withAccent` (tuple neuf, l'autre page intacte). Le contrat Vitest passe en local avec `.skip` retiré, sans commiter ce retrait. L'interface figée ci-dessus s'applique.
- Conception :
  ```diff
   src/shared/pager
  +├── index.ts        # NOUVEAU : PAGER_METRICS, PAGER_LAYOUT, geste, traits, pages ; réexporte accent.ts (sens des imports : index.ts importe accent.ts ; accent.ts n'importe rien de index.ts)
  +├── index.test.ts
  +├── accent.ts       # NOUVEAU : contexte d'accent par page, usePagerAccent, activeAccent, withAccent
  +└── accent.test.ts
  ```
  ```ts
  // index.ts : interface de la spec, plus :
  const PAGER_LAYOUT: { indicatorTopPt: 50; indicatorGapPt: 5; defaultAccent: "#F4F1EA" }
  restOffset(page: PageIndex, width: number): number              // -page × width, worklet
  pageValueText(page: PageIndex): string                          // "Page 1 sur 2"
  stepPage(page: PageIndex, action: "increment" | "decrement"): PageIndex
  type PagerRoot =
    | { kind: "home" }
    | { kind: "single"; feature: Feature }
    | { kind: "pager"; pages: readonly [Feature, Feature] }
  pagerRoot(features: readonly Feature[]): PagerRoot              // selectPages, puis la forme
  // accent.ts
  type PageAccents = readonly [string | null, string | null]
  interface PageAccentSlot { setAccent(color: string | null): void }
  const PageAccentContext: Context<PageAccentSlot | null>         // null hors pager : hook sans effet
  usePagerAccent(color: string | null): void                      // useContext + useEffect(slot?.setAccent)
  activeAccent(accents: PageAccents, page: 0 | 1, fallback: string): string  // accents[page] ?? fallback ; index.ts passe PAGER_LAYOUT.defaultAccent
  withAccent(accents: PageAccents, page: 0 | 1, color: string | null): PageAccents
  ```
  ```diff
   (aucun appelant dans cette tâche : T2 pour le geste et l'accent, T3 pour pagerRoot)
  +lockAxis → draggedOffset → settlePage → restOffset   # ordre d'appel dans le geste (T2)
  ```
  Ordre de construction :
  1. `PAGER_METRICS`, `PAGER_LAYOUT`, `indicatorTraits`, `pageValueText`, `stepPage` : c'est ce que l'indicateur lit. Vérifié par `index.test.ts` et par le test CA1 et CA5 du contrat (`.skip` retiré en local).
  2. `lockAxis`, `draggedOffset`, `settlePage`, `restOffset` avec la directive `'worklet'` : la chaîne du geste. Vérifiée par les tests CA2 à CA4 du contrat et par les bornes de `index.test.ts`.
  3. `selectPages` et `pagerRoot`, puis `accent.ts` (contexte, hook, `activeAccent`, `withAccent`). Vérifiés par CA6 et par `accent.test.ts`.
  Scénarios de changement :
  - Seuil de vitesse (geste de lancer, hors périmètre) : `settlePage` gagne un paramètre `velocity` ; `index.ts` et l'appel `onEnd` de `pager.tsx` (T2). Deux fichiers, accepté.
  - Valeur du handoff modifiée (seuil, durée, couleur crème) : `index.ts` seul (`PAGER_METRICS` ou `PAGER_LAYOUT`).
  - Troisième page (MVP, nouveau cadrage) : `PageIndex`, le tuple de `indicatorTraits`, `PageAccents`, `pagerRoot`, plus `pager.tsx` et `indicator.tsx`. Évolution dispersée, acceptée : la spec fixe deux pages, et le passage à N pages relève d'un nouveau cadrage (cahier des charges, section 10). On n'abstrait pas pour ce cas.

## Groupe 2 (après fusion du groupe 1)
### T2 : Composant Pager, indicateur accessible et réglage Jest
- Périmètre : src/shared/pager/pager.tsx, src/shared/pager/indicator.tsx, src/shared/pager/pager.native.test.tsx, jest.config.cjs, jest.setup.cjs, babel.config.cjs, docs/factory/libs-cache.md, docs/factory/UI.md
- Dépend de : T1
- Risque : moyen (geste et animation sur le fil d'interface, réglage de test partagé par tous les tests de rendu ; `babel.config.cjs` n'est modifié que si le plugin worklets manque)
- Critères de la spec couverts : CA9, CA10
- Définition de fini : `pnpm verify` vert. `pager.native.test.tsx` rend `<Pager pages={[a, b]} />` directement, sans `createApp`. Il montre : les deux écrans montés côte à côte ; la valeur « Page 1 sur 2 » puis « Page 2 sur 2 » après `increment`, sans effet au bord ; l'état local d'un écran gardé après un changement de page ; l'indicateur qui n'englobe pas les contrôles des pages ; les tailles, l'opacité et l'accent des traits (`testID` `pager-indicator-trait-0` et `-1`), y compris un accent changé pendant l'affichage et `null` qui revient au crème. Un glissement simulé avec `fireGestureHandler` (`react-native-gesture-handler/jest-utils`, à confirmer à la version installée) de -60 pt change de page, et un de -59,9 pt n'en change pas ; ce test exerce `onUpdate` et `onEnd` seulement : l'utilitaire ne joue pas `onTouchesMove`, donc l'activation par `lockAxis` n'est pas couverte ici (elle l'est par les tests purs de T1). Si l'utilitaire est absent ou ne rejoue pas le `Pan`, la définition de fini se replie sur les tests purs de T1 plus le parcours manuel de T3, et T2 le consigne dans le résumé de PR au lieu de s'arrêter. `jest.config.cjs` charge `react-native-gesture-handler/jestSetup.js` (`setupFiles`) et `jest.setup.cjs` (`setupFilesAfterEnv`, `setUpTests()` de Reanimated) ; les tests de rendu existants restent verts. Le cache reçoit les entrées Reanimated 4.5.1 et Gesture Handler 2.32 vérifiées. `docs/factory/UI.md` liste `Pager` dans « Composants de base ». Le `.tsx` ne contient aucun calcul (l'interface figée ci-dessus s'applique) et aucune valeur en dur hors de `PAGER_METRICS`, `PAGER_LAYOUT` et des tokens.
- Conception :
  ```diff
   jest.config.cjs        # MODIFIÉ : setupFiles (Gesture Handler), setupFilesAfterEnv (jest.setup.cjs)
  +jest.setup.cjs         # NOUVEAU : require("react-native-reanimated").setUpTests()
   src/shared/pager
  +├── pager.tsx          # NOUVEAU : Pager : racine Gesture Handler, bande, Pan, état page et accents
  +├── indicator.tsx      # NOUVEAU : PageIndicator : élément réglable et deux traits
  +└── pager.native.test.tsx
  ```
  ```ts
  Pager(props: { pages: readonly [Feature, Feature] }): ReactElement
  PageIndicator(props: { page: PageIndex; accent: string; onStep(action: "increment" | "decrement"): void }): ReactElement
  ```
  ```diff
   <Pager pages>
  +  useState<PageIndex>(0), useState<PageAccents>([null, null]), useWindowDimensions().width
  +  GestureHandlerRootView
  +    GestureDetector(Gesture.Pan().manualActivation(true))
  +      onTouchesMove → lockAxis(dx, dy) → state.activate() | state.fail()
  +      onUpdate      → offset = restOffset(page, w) + draggedOffset(page, translationX)
  +      onEnd         → target = settlePage(page, translationX) ; withTiming(restOffset(target, w)) ; setPage sur le fil JS
  +      Animated.View (bande 2 × w, non accessible)
  +        PageAccentContext.Provider(slot de la page i) → View(w) → pages[i].screen
  +    PageIndicator(page, activeAccent(accents, page), onStep → setPage(stepPage(page, action)))
  +      View accessible, role "adjustable", label « Indicateur de page », value pageValueText(page)
  +        Animated.View × 2 : indicatorTraits(page)[i] + backgroundColor, transition CSS de 300 ms
  +  useEffect([page, w]) → offset = withTiming(restOffset(page, w), 380 ms, Easing.bezier(...easing))
  ```
  Ordre de construction :
  1. Réglage Jest, puis `Pager` sans geste ni animation : les deux écrans dans la bande, l'indicateur réglable avec sa valeur et `increment` / `decrement`. Vérifié par `pager.native.test.tsx` (montage, valeur, état local gardé, indicateur distinct des pages).
  2. Traits et accent : `indicatorTraits` et `activeAccent` passés en style simple, avec la transition CSS de Reanimated 4 (`transitionProperty`, `transitionDuration`). On confirme d'abord sous Jest que `toHaveStyle` lit bien la valeur d'arrivée. Sinon : `useAnimatedStyle` avec `withTiming`, et le contrat (`toHaveStyle`) est vérifié en local avant d'aller plus loin. Vérifié par les cas CA10 du test.
  3. Bande animée et geste `Pan` en worklets (`'worklet'` côté T1). Vérifié par `fireGestureHandler` (seuil de 60 pt), puis à la main sur simulateur, avec deux features temporaires non commitées, en attendant T3.
  Scénarios de changement :
  - Transition de couleur entre deux compagnies (SPEC-0005) : `indicator.tsx` seul (`backgroundColor` ajouté à `transitionProperty`).
  - INV9 (Ciel absent, une page dynamique, retrait par la transition de 380 ms, geste annulé) : `pager.tsx` (pages variables, page de repos), `index.ts` (`PageIndex` et `pagerRoot`), `src/app.tsx` (T3). Cela fait plus de deux fichiers et sort du module : c'est ce que l'amendement de SPEC-0005 reprendra.
  - Racine Gesture Handler requise par un autre geste (carrousel de SPEC-0006) : elle monte de `pager.tsx` vers `createApp` (`src/app.tsx`). Deux fichiers, accepté : le `FlatList` de SPEC-0006 n'en a pas besoin.

## Groupe 3 (après fusion du groupe 2)
### T3 : Montage du pager par createApp et activation des contrats
- Périmètre : src/app.tsx, src/app.native.test.tsx, src/shared/feature.ts, src/shared/feature.test.ts, tests/acceptance/SPEC-0003.test.ts, tests/acceptance/SPEC-0003.native.test.tsx
- Dépend de : T1, T2
- Risque : moyen (modifie la fabrique `createApp` du socle, par laquelle passent tous les écrans ; le contrat de SPEC-0000 doit rester vert)
- Critères de la spec couverts : CA7, CA8 (et clôture de CA1 à CA10)
- Définition de fini : `pnpm verify` vert. `createApp` monte `Pager` sur `pagerRoot(guardFeatures(features ?? registry, build))` à la place de `pickScreen`, et garde sa signature. `pickScreen` est retiré de `src/shared/feature.ts`, et `src/shared/feature.test.ts` est supprimé, car il ne teste que `pickScreen`. `src/app.native.test.tsx` réécrit le cas « deux features » (pager monté, deux écrans visibles) et garde les cas « erreur de rendu » et « registre vide ». **Les `.skip` des `describe` de `tests/acceptance/SPEC-0003.test.ts` et de `tests/acceptance/SPEC-0003.native.test.tsx` sont retirés** : c'est la seule modification permise de ces fichiers. Tout le contrat de SPEC-0003 passe, et celui de SPEC-0000 (CA1, CA3, CA5) reste vert. La PR joint la capture du parcours sur simulateur iPhone (glissement, résistance au bord, défilement vertical laissé à la page, indicateur à `top` 50 et espacé de 5, retour au premier plan), faite avec deux features de test **locales, non commitées**.
- Conception :
  ```diff
   src
  ~├── app.tsx               # MODIFIÉ : pickScreen → pagerRoot ; branche "pager" → <Pager pages />
  ~├── app.native.test.tsx   # MODIFIÉ : cas à deux features = pager
   └── shared
  ~    ├── feature.ts        # MODIFIÉ : - pickScreen (l'interface Feature reste)
  -    └── feature.test.ts   # SUPPRIMÉ : ne testait que pickScreen
   tests/acceptance
  ~    ├── SPEC-0003.test.ts         # .skip retiré
  ~    └── SPEC-0003.native.test.tsx # .skip retiré
  ```
  ```ts
  createApp({ services, features, build }: AppOptions): ComponentType   // signature inchangée (SPEC-0000)
  ```
  ```diff
   createApp
  -  pickScreen(guardFeatures(features ?? registry, build), guardScreen(HomeScreen, "home", build))
  +  root = pagerRoot(guardFeatures(features ?? registry, build))      // selectPages dedans
  +  "home"   → guardScreen(HomeScreen, "home", build)
  +  "single" → root.feature.screen
  +  "pager"  → function PagedApp() { return <Pager pages={root.pages} /> }
     App → ServicesProvider → Screen
  ```
  Ordre de construction :
  1. `createApp` passe par `pagerRoot` pour les formes « home » et « single », avec le même rendu qu'avant. Vérifié par le contrat de SPEC-0000 et par `src/app.native.test.tsx`.
  2. La forme « pager » monte `Pager`. Vérifié par le contrat natif de SPEC-0003, `.skip` retiré (CA7 et CA8 : ordre par `order`, troisième feature absente, réouverture sur la page 1).
  3. Retrait de `pickScreen` et de son test, retrait des deux `.skip`, `pnpm verify`, puis parcours à la main sur simulateur avec deux features locales.
  Scénarios de changement :
  - INV9 (pages variables pendant l'exécution) : la décision « home, single ou pager » prise une fois dans `createApp` passe dans le rendu. Fichiers touchés : `src/app.tsx`, `index.ts`, `pager.tsx`. C'est la règle dispersée reportée à SPEC-0005.
  - Une page affichée par défaut autre que la première (ouverture sur Prochains passages, INV9) : l'état initial de `Pager` (`pager.tsx`) et `pagerRoot` (`index.ts`). Deux fichiers, accepté.
