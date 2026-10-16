# Plan SPEC-0004
Statut : PRÊT

Plan v3 : registre complet des tâches de la spec, pour que chaque critère ait sa tâche (`node scripts/plan-gate.mjs lint`). T1 à T5 sont **livrées** sur main (PR #68, #69, #70, #71, #103) : aucune n'est à relancer par `/implement`. Leur conception détaillée d'origine reste dans l'historique git (`git show 7accde1:specs/SPEC-0004-calcul-scene/plan.md` pour T1 à T4, `git show 018c1c4:specs/SPEC-0004-calcul-scene/plan.md` pour T5) ; les blocs ci-dessous la résument telle que livrée.

Constats partagés :
- Les `describe` des deux contrats sont actifs. Restent les trois `it.skip` « Amendement SPEC-0009 » (CA4, `latitude` et `longitude` de `Passage`) de `tests/acceptance/SPEC-0004.test.ts` : ils sont portés par **SPEC-0009 T2** (« Position du passage et heure HH:MM partagée », périmètre `src/shared/scene/model.ts`, `passage.ts`, `passage.test.ts` et ce contrat), pas par une tâche de ce plan, pour ne pas poser deux baux sur les mêmes fichiers.
- Interface figée : le « Contrat d'interface » de la spec, plus `normalizeDeg(deg): number` (`geo.ts`) ; projection en plan local autour de l'observateur ; logique du crochet dans `controller.ts` (sans React), `use-scene.ts` n'est qu'une liaison.
- Écart assumé : `AppLifecycle.onBackground` est facultatif dans `src/shared/lifecycle/index.ts` (contrats figés de SPEC-0005, 0006, 0009 et 0010 qui fournissent un cycle de vie sans lui), alors que la spec l'écrit obligatoire.

## Groupe 1 (parallèle)
### T1 : Géométrie, points cardinaux et modèle de la scène
- État : livrée (#68)
- Périmètre : src/shared/scene/index.ts, src/shared/scene/model.ts, src/shared/scene/geo.ts, src/shared/scene/geo.test.ts
- Dépend de : aucune
- Risque : moyen (module partagé lu par les deux écrans ; bornes des secteurs, `-0` et 360 sont des pièges de mutation)
- Critères de la spec couverts : CA1, CA2, CA3, CA4
- Définition de fini : tests CA1 à CA3 et « CA4 : exports the constants of the brief » du contrat verts ; `geo.test.ts` prend chaque borne (22,5, 337,5, 360, -10, 720, `-0`). CA4 n'est couvert ici que pour les constantes et les types (calcul : T3).
- Conception :
  ```diff
   src/shared/scene
  +├── index.ts      # point d'entrée
  +├── model.ts      # types du contrat, SceneInput, 5 constantes du brief
  +├── geo.ts        # normalizeDeg, groundDistanceKm, bearingDeg, cardinalPoint, arrowAngleDeg
  +└── geo.test.ts
  ```
  ```ts
  normalizeDeg(deg: number): number                  // [0, 360), jamais -0
  cardinalPoint(deg: number): CardinalPoint          // floor((normalizeDeg(deg) + 22,5) / 45) % 8
  arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null
  ```
  Scénarios de changement :
  - Seuil ou rayon du brief modifié : `model.ts` seul.
  - Libellés cardinaux à 16 secteurs : `model.ts` et `geo.ts`, accepté.

### T2 : Acquisition de l'observateur et service de premier plan
- État : livrée (#69)
- Périmètre : src/shared/location/index.ts, src/shared/location/acquire.ts, src/shared/location/acquire.test.ts, src/shared/lifecycle/, src/shared/services/index.tsx, src/main.tsx, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : élevé (zone sensible `src/shared/location/` : la position y est lue avant de partir vers la source ADS-B)
- Critères de la spec couverts : CA10
- Définition de fini : tests CA10 du contrat verts ; `acquire.test.ts` couvre accord, refus sans `getPosition`, `LOCATION_DENIED` à la lecture, autres erreurs propagées ; aucun log ni suivi des erreurs dans `acquire.ts`. Le service `AppLifecycle` (`onForeground`) posé ici est complété par T5 pour CA11.
- Conception :
  ```diff
   src/shared
  ~├── location/index.ts    # ObserverFix, export acquireObserver
  +├── location/acquire.ts  # permission puis position
  +├── lifecycle/           # AppLifecycle, fake.ts, app-state.ts (importé par main.tsx seul)
  ~└── services/index.tsx   # AppServices.lifecycle?: AppLifecycle
  ```
  ```diff
   acquireObserver(location)
  +  requestPermission()   # denied → { status: "denied" }, sans lecture
  +  getPosition()         # LOCATION_DENIED → denied ; autre rejet propagé
  ```
  Scénarios de changement :
  - Suivi continu de la position (hors périmètre) : `location/index.ts`, `expo.ts`, `fake.ts` ; `acquire.ts` inchangé.
  - Bouton « ouvrir les réglages » (SPEC-0008) : une méthode de `LocationService`, ni `acquire.ts` ni `lifecycle/`.

## Groupe 2 (après fusion du groupe 1)
### T3 : Calcul de la scène (passages, survol en cours, prochains passages)
- État : livrée (#70) ; amendement SPEC-0009 de CA4 (`latitude`, `longitude`) porté par SPEC-0009 T2 (ci-dessus)
- Périmètre : src/shared/scene/index.ts, src/shared/scene/passage.ts, src/shared/scene/passage.test.ts, src/shared/scene/scene.ts, src/shared/scene/scene.test.ts
- Dépend de : T1
- Risque : moyen (fonction pure, mais elle porte INV1 à INV4, lus par les deux écrans ; seuils et égalités sont des pièges de mutation)
- Critères de la spec couverts : CA4, CA5, CA6, CA7, CA8, CA9
- Définition de fini : tests CA4 à CA9 du contrat verts (hors les trois `it.skip` de l'amendement SPEC-0009) ; `scene.test.ts` couvre chaque cas limite de la spec (bornes 4 et 80 km, `windowEndMs === nowMs`, doublon de `hex`, égalités, 12 passages, survol maintenu au-delà des seuils).
- Conception :
  ```ts
  isUsable(aircraft: Aircraft): boolean   // INV2
  predictPassage(aircraft: Aircraft, observer: Position, takenAtMs: number, nowMs: number): Passage
  computeScene(input: SceneInput): Scene
  ```
  ```diff
   computeScene
  +  firstOccurrences → filter(isUsable) → map(predictPassage) → filter(windowEndMs > nowMs)
  +  heldOverhead (CA8, sans seuils) ?? enteringOverhead (CA7, ≤ 4 km, ≤ 80 km, plus proche puis hex)
  +  upcoming : non commencé, seuils, ≠ survol, tri (passageTimeMs, hex), slice(0, MAX_UPCOMING)
  ```
  Scénarios de changement :
  - Âge de la position ADS-B (SPEC-0007) : `passage.ts` seul.
  - Hystérésis au lieu du maintien sans seuil : `scene.ts` et une constante de `model.ts`.
  - Grand cercle au lieu du plan local : `passage.ts` seul.

## Groupe 3 (après fusion du groupe 2)
### T4 : Crochet useScene et activation des contrats
- État : livrée (#71)
- Périmètre : src/shared/scene/index.ts, src/shared/scene/controller.ts, src/shared/scene/controller.test.ts, src/shared/scene/use-scene.ts, tests/acceptance/SPEC-0004.test.ts, tests/acceptance/SPEC-0004.native.test.tsx
- Dépend de : T1, T2, T3
- Risque : élevé (la position quitte l'appareil dans la requête construite ici : arrondi à 3 décimales, aucun log ni suivi des erreurs, INV7)
- Critères de la spec couverts : CA12, CA13, CA14, CA15, CA16, CA17, CA18
- Définition de fini : `describe.skip` des deux contrats retirés (seule modification) ; contrat natif vert ; `controller.test.ts` couvre `adsbQueryFor` (arrondi, sans `-0`, rayon 80), refus puis accord, erreurs avec et sans instantané, réponse en retard, `stop()`, tick d'une seconde, cap normalisé, absence de `lifecycle` ; aucun `console.*` ni `monitoring` dans le module.
- Conception :
  ```ts
  createSceneController(services: SceneServices, onChange: (view: SceneView) => void): SceneController
  adsbQueryFor(position: Position): AdsbQuery   // 3 décimales, radiusKm = FORECAST_RADIUS_KM
  useScene(): SceneView & { refresh(): void }
  ```
  ```diff
   useScene → createSceneController (magasin partagé depuis SPEC-0005)
  +  watchHeading → normalizeDeg ; lifecycle?.onForeground(acquire) ; tick 1 s → computeScene
  +  acquire : acquireObserver → adsb.fetchAircraft(adsbQueryFor(observer)) ; requête périmée ignorée
  ```
  Scénarios de changement :
  - Minuteur de 10 s et pause (SPEC-0007) : `controller.ts` seul.
  - Données périmées (SPEC-0008) : aucun fichier, `snapshotAtMs` et `nowMs` suffisent.

## Groupe 4 (après fusion du groupe 3)
### T5 : AppLifecycle.onBackground et activation des tests CA11
- État : livrée (#103)
- Périmètre : src/shared/lifecycle/index.ts, src/shared/lifecycle/fake.ts, src/shared/lifecycle/app-state.ts, src/shared/lifecycle/lifecycle.test.ts, tests/acceptance/SPEC-0004.test.ts
- Dépend de : T2
- Risque : moyen (code partagé lu par le crochet de la scène ; une erreur de transition d'`AppState` couperait ou doublerait le rafraîchissement de SPEC-0007)
- Critères de la spec couverts : CA11
- Définition de fini : les deux `it.skip` « CA11 » retirés (seule modification du contrat) ; `lifecycle.test.ts` couvre `active → background | inactive` (appelé), `background → background`, `inactive → background`, `background → active` (non appelé), `remove()` au désabonnement.
- Conception :
  ```diff
   createAppStateLifecycle()
     onForeground(l) : previous ∈ {inactive, background}, next = active → l()
  +  onBackground(l) : previous = active, next ∈ {inactive, background} → l()
  ```
  Scénarios de changement :
  - `inactive` ne compte plus comme arrière-plan : `app-state.ts` seul.
  - Second événement de cycle de vie : `index.ts`, `fake.ts`, `app-state.ts`, accepté (capacité nouvelle du service).
