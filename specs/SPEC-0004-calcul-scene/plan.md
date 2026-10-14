# Plan SPEC-0004
Statut : PRÊT

Constats partagés :
- **Emplacement** : le calcul vit dans `src/shared/scene/` (zone `**/shared/`, risque moyen), l'acquisition dans `src/shared/location/` (zone sensible, revue `full`), le premier plan dans le nouveau `src/shared/lifecycle/`. Aucun n'est une feature : `pnpm gen` ne s'applique pas.
- **Interface figée** : celle du « Contrat d'interface » de la spec, plus `normalizeDeg(deg): number` (ramène dans [0, 360), jamais `-0`), exporté par `geo.ts` (T1) et lu par `cardinalPoint`, `arrowAngleDeg`, `computeScene` (T3) et le cap du crochet (T4). `src/shared/scene/index.ts` n'importe ni `react-native` ni module natif ; seul `use-scene.ts` (T4) importe `react`.
- **Projection** : l'extrapolation se fait dans un plan local autour de l'observateur (x vers l'est, y vers le nord, en km : `Δlon · cos(lat observateur) · R`, `Δlat · R`, R = 6371 km), comme la géométrie des tests de contrat ; toutes les distances de `computeScene` (passage, distance au sol à `nowMs`, seuils de 4 et 80 km) sont mesurées dans ce plan, pour que les bornes incluses tombent juste. `groundDistanceKm` (CA1) reste la formule de haversine.
- **Couverture** : `vitest.config.ts` compte tout `src/**/*.ts`. La logique du crochet vit donc dans `controller.ts` (sans React, couvert et muté sous Vitest) ; `use-scene.ts` n'est qu'une liaison React de quelques lignes, jouée par le contrat Jest.
- **Contrats** : `tests/acceptance/SPEC-0004.test.ts` et `tests/acceptance/SPEC-0004.native.test.tsx` gardent leurs `describe.skip` jusqu'à T4. Une tâche peut retirer un `.skip` en local pour vérifier ses critères, sans commiter ce retrait.

## Groupe 1 (parallèle)
### T1 : Géométrie, points cardinaux et modèle de la scène
- Périmètre : src/shared/scene/index.ts, src/shared/scene/model.ts, src/shared/scene/geo.ts, src/shared/scene/geo.test.ts
- Dépend de : aucune
- Risque : moyen (module partagé lu par les deux écrans ; bornes des secteurs, `-0` et 360 sont des pièges de mutation)
- Critères de la spec couverts : CA1, CA2, CA3, CA4
- Définition de fini : `pnpm verify` vert. `geo.test.ts` prend chaque borne : 22,5 (`NE`), 22,4999 (`N`), 337,5 (`N`), 360, -10, 720 ; `arrowAngleDeg` qui donnerait -0 ou 360 ; cap `null` ; gisements aux quatre points cardinaux ; distance symétrique et nulle. Les tests CA1 à CA3 et « CA4 : exports the constants of the brief » du contrat Vitest passent en local avec `.skip` retiré, sans commiter ce retrait. L'interface figée ci-dessus s'applique ; CA4 n'est couvert ici que pour les constantes et les types (le calcul est à T3).
- Conception :
  ```diff
   src/shared/scene
  +├── index.ts      # NOUVEAU : point d'entrée, réexporte model.ts et geo.ts (T3 et T4 y ajoutent leurs exports)
  +├── model.ts      # NOUVEAU : CardinalPoint, AircraftSnapshot, Passage, Scene, SceneInput ; 5 constantes du brief
  +├── geo.ts        # NOUVEAU : normalizeDeg, groundDistanceKm, bearingDeg, cardinalPoint, arrowAngleDeg
  +└── geo.test.ts
  ```
  ```ts
  // model.ts : types recopiés du contrat d'interface, plus
  interface SceneInput { snapshot: AircraftSnapshot; observer: Position; nowMs: number; previousOverheadHex: string | null }
  const OVERHEAD_THRESHOLD_KM = 4, FORECAST_RADIUS_KM = 80, MAX_UPCOMING = 10,
        WINDOW_HALF_LENGTH_KM = 5, REFRESH_INTERVAL_MS = 10_000
  // geo.ts
  normalizeDeg(deg: number): number                       // ((deg % 360) + 360) % 360, puis -0 → 0
  groundDistanceKm(a: Position, b: Position): number      // haversine, R = 6371
  bearingDeg(from: Position, to: Position): number        // atan2 sphérique, puis normalizeDeg
  cardinalPoint(deg: number): CardinalPoint               // secteur floor((normalizeDeg(deg) + 22,5) / 45) % 8
  arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null
  ```
  ```diff
   (aucun appelant dans cette tâche)
  +computeScene (T3) → cardinalPoint(trackDeg), cardinalPoint(arrivalBearingDeg), normalizeDeg
  +useScene (T4)     → normalizeDeg(cap reçu)
  +écrans (SPEC-0005, SPEC-0006) → arrowAngleDeg(cible, headingDeg)
  ```
  Ordre de construction :
  1. `index.ts` qui réexporte `model.ts` (types et constantes). Vérifié par le test de constantes du contrat (CA4).
  2. `normalizeDeg`, `cardinalPoint`, `arrowAngleDeg` : vérifiés par les tests CA2 et CA3 du contrat et par les bornes de `geo.test.ts`.
  3. `groundDistanceKm`, `bearingDeg` : vérifiés par les tests CA1 du contrat.
  Scénarios de changement :
  - Seuil ou rayon du brief modifié (4 km, 80 km, ±5 km) : `model.ts` seul.
  - Libellés cardinaux traduits ou passés à 16 secteurs : `model.ts` (type) et `geo.ts` (`cardinalPoint`). Deux fichiers, accepté.
  - Ciel gagne une flèche (exclue en v0 par le propriétaire) : aucun fichier de ce module, `arrowAngleDeg` suffit.

### T2 : Acquisition de l'observateur et service de premier plan
- Périmètre : src/shared/location/index.ts, src/shared/location/acquire.ts, src/shared/location/acquire.test.ts, src/shared/lifecycle/, src/shared/services/index.tsx, src/main.tsx, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : élevé (zone sensible `**/shared/location/` : c'est là que la position est lue avant de partir vers la source ADS-B)
- Critères de la spec couverts : CA10, CA11
- Définition de fini : `pnpm verify` vert. `acquire.test.ts` couvre : permission accordée, refusée (aucun `getPosition`), `LOCATION_DENIED` à la lecture (rend `denied`), autre `AppError` et `Error` brute propagées telles quelles, nouvelle lecture à chaque appel. `src/shared/lifecycle/lifecycle.test.ts` couvre le faux (plusieurs listeners, désabonnement, rien avant `enterForeground`) et `app-state.ts` avec `vi.mock("react-native")` (même motif que `src/shared/location/expo.test.ts`) : listener appelé sur `background → active` et `inactive → active`, pas sur `active → active` ni `active → background`, `remove()` appelé au désabonnement. `AppServices.lifecycle` est facultatif : les contrats de SPEC-0000 et SPEC-0003 restent verts sans le fournir. `src/main.tsx` fournit `createAppStateLifecycle()`. Aucun log, aucun appel au suivi des erreurs dans `acquire.ts`. Les tests CA10 et CA11 du contrat Vitest passent en local avec `.skip` retiré, sans commiter ce retrait. Le cache reçoit l'entrée `react-native 0.86.3` (`AppState`) vérifiée dans `node_modules`.
- Conception :
  ```diff
   src/shared
   ├── location
  ~│   ├── index.ts         # MODIFIÉ : + ObserverFix, export { acquireObserver } from "./acquire"
  +│   ├── acquire.ts       # NOUVEAU : acquireObserver (permission puis position)
  +│   └── acquire.test.ts
   ├── lifecycle
  +│   ├── index.ts         # NOUVEAU : AppLifecycle, export { createFakeLifecycle } (aucun module natif)
  +│   ├── fake.ts          # NOUVEAU : createFakeLifecycle
  +│   ├── app-state.ts     # NOUVEAU : createAppStateLifecycle (AppState de React Native), importé par main.tsx seul
  +│   └── lifecycle.test.ts
   └── services
  ~    └── index.tsx        # MODIFIÉ : AppServices.lifecycle?: AppLifecycle
  ~src/main.tsx             # MODIFIÉ : lifecycle: createAppStateLifecycle()
  ```
  ```ts
  type ObserverFix = { status: "granted"; position: Position } | { status: "denied" }
  acquireObserver(location: LocationService): Promise<ObserverFix>
  interface AppLifecycle { onForeground(listener: () => void): () => void }
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void }
  createAppStateLifecycle(): AppLifecycle   // un abonnement AppState par listener, état précédent gardé
  ```
  ```diff
   useScene (T4) → createSceneController
  +  acquireObserver(location)
  +    location.requestPermission()          # "denied" → { status: "denied" }, sans lecture
  +    location.getPosition()                # rejet LOCATION_DENIED → { status: "denied" } ; autre rejet propagé
  +  lifecycle?.onForeground(reacquire)
  +    AppState.addEventListener("change", next) # précédent ∈ {inactive, background} et next = "active" → listener()
  ```
  Ordre de construction :
  1. `acquireObserver` exporté par `location/index.ts`, cas accordé puis refusé. Vérifié par les tests CA10 du contrat (`.skip` retiré en local) et `acquire.test.ts`.
  2. Cas `LOCATION_DENIED` à la lecture et propagation des autres erreurs. Vérifié par `acquire.test.ts` (bornes du `code`).
  3. `AppLifecycle`, faux, champ facultatif de `AppServices`. Vérifié par les tests CA11 du contrat et par `pnpm test:render` (contrats SPEC-0000 et SPEC-0003 verts).
  4. `app-state.ts` branché dans `main.tsx`. Vérifié par `lifecycle.test.ts` (module remplacé), puis sur simulateur : passage en arrière-plan et retour, un appel par retour (journal temporaire non commité).
  Scénarios de changement :
  - Pause en arrière-plan (SPEC-0007) : `AppLifecycle` gagne `onBackground` ; `lifecycle/index.ts`, `fake.ts`, `app-state.ts`. Trois fichiers du même service, accepté : c'est une capacité nouvelle du service, pas une règle dispersée.
  - Suivi continu de la position (hors périmètre) : `LocationService` gagne `watchPosition` ; `location/index.ts`, `expo.ts`, `fake.ts`. `acquire.ts` inchangé.
  - Bouton « ouvrir les réglages » (SPEC-0008) : nouvelle méthode de `LocationService`, sans toucher `acquire.ts` ni `lifecycle/`.

## Groupe 2 (après fusion du groupe 1)
### T3 : Calcul de la scène (passages, survol en cours, prochains passages)
- Périmètre : src/shared/scene/index.ts, src/shared/scene/passage.ts, src/shared/scene/passage.test.ts, src/shared/scene/scene.ts, src/shared/scene/scene.test.ts
- Dépend de : T1
- Risque : moyen (fonction pure, mais elle porte INV1 à INV4, lus par les deux écrans ; seuils et égalités sont des pièges de mutation)
- Critères de la spec couverts : CA4, CA5, CA6, CA7, CA8, CA9
- Définition de fini : `pnpm verify` vert. `passage.test.ts` couvre l'approche, l'éloignement, le passage à côté, la vitesse nulle ou `null`, le cap `null`, l'altitude 0, négative et `null`, le cap 360, l'extrapolation à rebours et l'arrondi des heures. `scene.test.ts` couvre chaque cas limite de la spec : instantané vide, 4 km et 80 km exacts (gardés), `windowEndMs === nowMs` (disparu), `passageTimeMs === nowMs` (survol, absent de `upcoming`), doublon de `hex` (première occurrence, même inexploitable), égalités d'heure et de distance (`hex`), 12 passages (10 gardés), survol maintenu au-delà de 4 km et de 80 km, survol précédent absent, inexploitable ou pas encore entré. Les tests CA4 à CA9 du contrat Vitest passent en local avec `.skip` retiré, sans commiter ce retrait. Aucun `Date.now()`, aucune boucle sur l'horloge. L'interface figée ci-dessus s'applique.
- Conception :
  ```diff
   src/shared/scene
  ~├── index.ts        # MODIFIÉ : + export { computeScene } from "./scene"
  +├── passage.ts      # NOUVEAU : exploitabilité (INV2) et extrapolation d'un avion en ligne droite, plan local
  +├── passage.test.ts
  +├── scene.ts        # NOUVEAU : computeScene : doublons, seuils, survol (entrée et maintien), tri et limite
  +└── scene.test.ts
  ```
  ```ts
  // passage.ts
  isUsable(aircraft: Aircraft): boolean    // vitesse > 0, cap connu, altitude > 0 ou null
  predictPassage(aircraft: Aircraft, observer: Position, takenAtMs: number, nowMs: number): Passage
  // scene.ts
  computeScene(input: SceneInput): Scene
  ```
  ```diff
   computeScene({ snapshot, observer, nowMs, previousOverheadHex })
  +  firstOccurrences(snapshot.aircraft)                 # un avion par hex, avant tout contrôle
  +  .filter(isUsable)
  +  .map(a → predictPassage(a, observer, snapshot.takenAtMs, nowMs))
  +    toLocalKm(observer, a) ; closestApproach(p0, u) ; window ±5 km / vitesse ; arrival = position à passageTimeMs
  +  .filter(p → windowEndMs > nowMs)                    # fin exclue
  +  heldOverhead(passages, previousOverheadHex, nowMs)  # dans sa fenêtre, sans seuils (CA8)
  +    ?? enteringOverhead(passages, nowMs)              # fenêtre en cours, ≤ 4 km, ≤ 80 km, plus proche puis hex (CA7)
  +  upcoming = passages.filter(non commencé, ≤ 4 km, ≤ 80 km, ≠ survol).sort(passageTimeMs, hex).slice(0, MAX_UPCOMING)
  ```
  Ordre de construction :
  1. `computeScene` exporté par `index.ts`, avec `predictPassage` sur un avion qui survole l'observateur et `upcoming` non trié. Vérifié par « CA4 : computes the passage of an aircraft flying straight over the observer » du contrat.
  2. Passage à côté, fenêtre, gisement d'arrivée, cap 360, arrondi, extrapolation à rebours. Vérifié par les autres tests CA4 et CA9 du contrat et par `passage.test.ts`.
  3. Exploitabilité, seuils, doublons, tri et limite de `upcoming`. Vérifié par les tests CA5 et CA6 du contrat et par `scene.test.ts`.
  4. Survol en cours : entrée puis maintien. Vérifié par les tests CA7 et CA8 du contrat et par `scene.test.ts`.
  Scénarios de changement :
  - Prise en compte de l'âge de la position ADS-B (SPEC-0007) : `Aircraft` gagne `seenAtMs` ; `predictPassage` extrapole depuis lui (`passage.ts`), plus le client réel. Un fichier de ce module.
  - Seuils d'entrée et de maintien distincts (hystérésis au lieu du maintien sans seuil) : `scene.ts` seul (`heldOverhead`), plus une constante dans `model.ts`.
  - Grand cercle au lieu du plan local (précision au-delà de 80 km) : `passage.ts` seul ; `scene.ts` ne voit que des distances.

## Groupe 3 (après fusion du groupe 2)
### T4 : Crochet useScene et activation des contrats
- Périmètre : src/shared/scene/index.ts, src/shared/scene/controller.ts, src/shared/scene/controller.test.ts, src/shared/scene/use-scene.ts, tests/acceptance/SPEC-0004.test.ts, tests/acceptance/SPEC-0004.native.test.tsx
- Dépend de : T1, T2, T3
- Risque : élevé (la position quitte l'appareil dans la requête construite ici : arrondi à 3 décimales, aucun log ni suivi des erreurs, INV7)
- Critères de la spec couverts : CA12, CA13, CA14, CA15, CA16, CA17, CA18 (et clôture de CA1 à CA18)
- Définition de fini : `pnpm verify` vert. `controller.test.ts` (Vitest, `vi.useFakeTimers`, faux de `src/shared/`) couvre : `adsbQueryFor` (arrondi, valeurs négatives, rayon 80), refus, refus puis accord (`loading` puis `ready`), erreur de source et de position sans puis avec instantané, réponse en retard ignorée, aucune mise à jour ni requête après `stop()`, tick d'une seconde qui transmet le survol précédent, pas de requête toutes les 10 s, cap ramené dans [0, 360), absence de `lifecycle`. `use-scene.ts` ne contient aucune décision (création du contrôleur, `useState`, nettoyage). Aucun `console.*`, aucun appel à `monitoring` dans le module. **Les `.skip` des `describe` de `tests/acceptance/SPEC-0004.test.ts` (les deux) et de `tests/acceptance/SPEC-0004.native.test.tsx` sont retirés** : c'est la seule modification permise de ces fichiers. Tout le contrat de SPEC-0004 passe ; ceux de SPEC-0000 et SPEC-0003 restent verts. L'interface figée et la règle de couverture ci-dessus s'appliquent.
- Conception :
  ```diff
   src/shared/scene
  ~├── index.ts            # MODIFIÉ : + useScene, SceneState, SceneView
  +├── controller.ts       # NOUVEAU : createSceneController, adsbQueryFor ; aucune dépendance à React
  +├── controller.test.ts
  +└── use-scene.ts        # NOUVEAU : useScene, liaison React du contrôleur
  ```
  ```ts
  type SceneServices = Pick<AppServices, "clock" | "location" | "adsb" | "lifecycle">
  interface SceneView { state: SceneState; headingDeg: number | null }
  interface SceneController { refresh(): void; stop(): void }
  createSceneController(services: SceneServices, onChange: (view: SceneView) => void): SceneController  // démarre à la création
  adsbQueryFor(position: Position): AdsbQuery   // lat et lon arrondies à 3 décimales, radiusKm = FORECAST_RADIUS_KM
  useScene(): SceneView & { refresh(): void }
  ```
  ```diff
   écran → useScene()
  +  useServices() ; useEffect([services]) → createSceneController(services, setView) ; nettoyage → stop()
  +    location.watchHeading(deg → headingDeg = normalizeDeg(deg))
  +    lifecycle?.onForeground(acquire)            # denied → loading avant la lecture (CA15)
  +    setInterval(publish, 1000)                   # computeScene(snapshot, observer, clock.now(), overheadHex)
  +    acquire() : requestId += 1
  +      acquireObserver(location) → denied : mémoire effacée, { status: "denied" }
  +      adsb.fetchAircraft(adsbQueryFor(observer)) → requête périmée ou stop() : ignorée
  +      snapshot = { aircraft, takenAtMs: clock.now() } ; publish()
  +      erreur : instantané antérieur ? publish() : { status: "unavailable" }
  +  refresh() → même requête avec l'observateur connu (acquire() s'il n'y en a pas)
  ```
  Ordre de construction :
  1. `useScene` exporté par `index.ts`, contrôleur qui passe de `loading` à `ready` avec la requête arrondie. Vérifié par les tests CA12 du contrat natif (`.skip` retiré en local) et par `adsbQueryFor` dans `controller.test.ts`.
  2. Tick d'une seconde avec survol précédent, `refresh()`, cap et désabonnement. Vérifié par les tests CA13 et CA16.
  3. Refus, retour au premier plan, erreurs, réponse en retard, démontage. Vérifié par les tests CA14, CA15, CA17 et CA18, puis `controller.test.ts` complet.
  4. Retrait des trois `.skip`, `pnpm verify`.
  Scénarios de changement :
  - Rafraîchissement toutes les 10 s et pause en arrière-plan (SPEC-0007) : `controller.ts` (second minuteur sur `REFRESH_INTERVAL_MS`, arrêt et reprise des minuteurs), plus `onBackground` côté `lifecycle/` (voir T2). Un fichier de ce module.
  - Données périmées (SPEC-0008) : `SceneState` « ready » expose déjà `snapshotAtMs` et `nowMs` ; l'écran calcule l'âge. Aucun fichier de ce module, sauf si l'état devient un statut à part (`model.ts`, `controller.ts`).
  - Avion retenu et présence de Ciel (INV9, SPEC-0005) : fonction pure de la feature Ciel, qui lit `Scene` ; aucun fichier de ce module.
