# Plan SPEC-0006
Statut : PRÊT
Questions :
1. Emplacement de `flightLabel` et `formatMetric`. SPEC-0006 (« Contrat d'interface ») les place dans `src/features/passages/service.ts`, dont les seuls imports seraient `src/shared/airlines/` et `src/shared/scene/`. SPEC-0005, fusionnée après (CA18 et son test de contrat), les déplace dans `src/shared/format/index.ts`, ré-exportées par `service.ts`, et exige un amendement textuel de SPEC-0006 **avant** `/plan SPEC-0006` ; cet amendement n'est pas sur main. Recommandation : poser `src/shared/format/` dès T1 (les contrats des deux specs passent tels quels) et fusionner l'amendement textuel de SPEC-0006 avec cette PR de plan, puis passer le statut à `PRÊT`. Le plan ci-dessous est écrit pour cette réponse ; l'autre réponse (formats dans `service.ts`, déplacés par SPEC-0005) ne change que le périmètre de T1.

Constats partagés :
- **Interface figée** : celle du « Contrat d'interface » de la spec, plus deux fonctions de `service.ts` qui sortent tout calcul des `.tsx` (`docs/factory/UI.md`) : `gaugePercent(progress: number): number` (`Math.round(100 × progress)`, valeur de la jauge, CA15) et `cardsOf(view: SceneView, timeZone: string): PassageCard[]` (`buildCards` sur une scène `ready`, `[]` pour tout autre statut, CA18). `flightLabel` et `formatMetric` vivent dans `src/shared/format/index.ts` (question 1), `service.ts` et `index.ts` les ré-exportent.
- **Une seule source de temps** : l'écran et les cartes lisent l'heure dans `state.nowMs` de `useScene` (tick d'une seconde, SPEC-0004) ; aucun composant ne lit l'horloge ni ne pose son propre minuteur. C'est ce qui garantit que le compte à rebours et la bascule « En ce moment » tombent au même tick (CA14 : jamais `00:00`).
- **Registre** : `src/features.gen.ts` est généré et ignoré par git ; la feature `passages` entre dans l'application dès que `src/features/passages/index.ts` existe (T4 seulement).
- **Contrats** : `tests/acceptance/SPEC-0006.test.ts` et `tests/acceptance/SPEC-0006.native.test.tsx` gardent leurs `describe.skip` jusqu'à T4. Une tâche peut retirer un `.skip` en local pour vérifier ses critères, sans commiter ce retrait.
- **Bibliothèques consultées par le planner** (aucune entrée au cache) : Context7 `/react/react-native-website` (doc 0.87, la plus proche de 0.86.3) : `snapToInterval` s'emploie avec `decelerationRate="fast"`, `FlatList` est un `PureComponent` (re-rendu quand `data` change) ; Context7 `/discord/hermes` (`doc/IntlAPIs.md`, `PlatformIntlApple.mm`) : `Intl.DateTimeFormat` de Hermes prend `timeZone` et `hourCycle: "h23"` sur iOS et Android, mais le motif iOS est localisé : assembler `HH:MM` depuis `formatToParts`, jamais depuis `format()` ni `toLocaleString` (séparateur de milliers fait à la main, CA5).

## Groupe 1 (parallèle)
### T1 : Formats partagés et logique du carrousel
- Périmètre : src/shared/format/, src/features/passages/service.ts, src/features/passages/service.test.ts, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : moyen (`service.ts` et `src/shared/` : logique métier lue par deux écrans, arrondis et bornes sensibles à la mutation)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA8
- Définition de fini : `pnpm verify` vert. Le contrat Vitest « logique du carrousel » (CA1 à CA8) passe en local avec `.skip` retiré, sans commiter ce retrait ; le test CA18 de `tests/acceptance/SPEC-0005.test.ts` passe aussi en local (ré-export identique). `src/shared/format/format.test.ts` couvre `formatMetric` (négatif, `0.5`, `999.5` qui passe à `1 000`) et `flightLabel` (indicatif de moins de quatre caractères, compagnie sans code IATA, minuscules). `service.test.ts` couvre `formatCountdown` à `-0` et à `0.4`, `formatLocalTime` à minuit (`00:xx`, jamais `24:xx`), `gaugePercent` à 0, 0,005 et 1, `cardsOf` pour chaque statut de `SceneState`. Aucun import de `react-native` ni de `react` dans `src/shared/format/` et `service.ts`. Le cache reçoit deux entrées : `react-native 0.86.3` (`FlatList`, calage) et Hermes (`Intl.DateTimeFormat`), sources ci-dessus. L'interface figée ci-dessus s'applique.
- Conception :
  ```diff
   src/shared/format
  +├── index.ts           # NOUVEAU : flightLabel, formatMetric (Vitest, sans React)
  +└── format.test.ts
   src/features/passages
  +├── service.ts         # NOUVEAU : PASSAGES_METRICS, formats de temps, visibilité, buildCards, cardsOf ; ré-exporte format
  +└── service.test.ts
  ```
  ```ts
  // src/shared/format/index.ts
  flightLabel(callsign: string | null, airline: Airline): string   // /^[A-Z]{3}\d/ et airline.iata[0] → remplace le préfixe
  formatMetric(value: number | null): string                       // groupes de 3 joints par U+00A0, "—" pour null
  // src/features/passages/service.ts : contrat de la spec, plus
  gaugePercent(progress: number): number
  cardsOf(view: SceneView, timeZone: string): PassageCard[]
  ```
  ```diff
   PassagesScreen (T4)
  +  cardsOf(view, timeZone)
  +    buildCards({ scene, nowMs, headingDeg, timeZone })
  +      resolveAirline(callsign) → airlineTheme(airline)          (src/shared/airlines)
  +      upcomingCard(passage, ...) → formatCountdown, formatLocalTime, arrowAngleDeg(arrivalBearingDeg, heading)
  +      overheadCard(passage, ...) → visibilityProgress, visibilityRemainingMs, arrowAngleDeg(trackDeg, heading)
  +      flightLabel, formatMetric                                 (src/shared/format)
  ```
  Ordre de construction :
  1. `buildCards` rend les cartes dans l'ordre (survol puis passages), `kind` et `hex` seuls, autres champs à `—` ; `PASSAGES_METRICS`. Vérifié par les tests CA1 et CA7 (ordre, scène vide) du contrat.
  2. `src/shared/format/` et les champs communs (compagnie, thème, vol, altitude, vitesse). Vérifié par CA5, CA6 et CA7 (champs) du contrat, et `format.test.ts`.
  3. Carte à venir puis carte « En ce moment » : `formatCountdown`, `formatLocalTime` (`formatToParts`, `h23`), visibilité, flèche. Vérifié par CA2, CA3, CA4, CA8.
  4. `cardsOf` et `gaugePercent`, ré-exports. Vérifié par `service.test.ts` et le CA18 de SPEC-0005 en local.
  Scénarios de changement :
  - Type d'appareil et route fournis (SPEC-0009) : `service.ts` (champs de `PassageCard`, `buildCards`) et le composant qui les affiche (T3). Deux fichiers, accepté.
  - Heure en 12 h selon le réglage de l'appareil : `formatLocalTime` seul (`service.ts`).
  - Règle du vol en forme IATA corrigée (ex. préfixe de deux lettres) : `src/shared/format/index.ts` seul ; Ciel et Passages suivent.

### T2 : Source ADS-B de démonstration
- Périmètre : src/shared/adsb/demo.ts, src/shared/adsb/demo.test.ts, src/main.tsx
- Dépend de : aucune
- Risque : élevé (zone sensible `**/shared/adsb/`, revue `full` ; branchement dans `src/main.tsx` qui ne doit jamais atteindre un build livré)
- Critères de la spec couverts : CA9
- Définition de fini : `pnpm verify` vert. Le contrat Vitest « source de démonstration » (CA9) passe en local avec `.skip` retiré, sans commiter ce retrait. `demo.test.ts` couvre : `hex` en hexadécimal minuscule, rayon de 10 km (tous les avions dedans), liste identique pour deux sources créées à la même heure, aucun appel réseau ni log (`console` espionné). `src/shared/adsb/index.ts` n'est pas modifié. `src/main.tsx` passe la même instance d'horloge à la source et à l'application, et ne branche la démonstration que sous `__DEV__` (typé par `react-native`). Aucune position reçue n'est stockée hors de l'appel.
- Conception :
  ```diff
   src/shared/adsb
  +├── demo.ts         # NOUVEAU : createDemoAdsbSource, voies fixes extrapolées à l'heure de l'horloge
  +└── demo.test.ts
  ~src/main.tsx        # MODIFIÉ : adsb = __DEV__ ? createDemoAdsbSource(clock) : createEmptyAdsbSource()
  ```
  ```ts
  createDemoAdsbSource(clock: Clock): AdsbSource
  // interne
  interface DemoLane { callsign: string | null; offsetKm: number; trackDeg: number; altitudeM: number; phase: number }
  const DEMO_LANES: readonly DemoLane[]       // 8 voies, toutes de même période, phases réparties de période / 8
  laneAircraft(lane: DemoLane, index: number, query: AdsbQuery, nowMs: number): Aircraft
  ```
  ```diff
   main.tsx → createApp({ services: { clock, adsb, ... } })
  -  adsb: createEmptyAdsbSource()
  +  adsb: __DEV__ ? createDemoAdsbSource(clock) : createEmptyAdsbSource()
   useScene → controller.query → adsb.fetchAircraft(query)
  +  demo : clock.now() → position le long de chaque voie, plan local autour de (query.latitude, query.longitude)
  ```
  Ordre de construction :
  1. Une voie qui traverse la position demandée, branchée dans `main.tsx` sous `__DEV__`. Vérifié par le test « same list at the same time » du contrat et par `pnpm dev` (aucune erreur au lancement).
  2. Huit voies dans le rayon (demi-longueur bornée par `query.radiusKm`), `hex` par voie et par cycle. Vérifié par le test « moving aircraft, distinct hex, inside the radius ».
  3. Phases réparties et indicatifs (AFR, IBE, RYR, KLM, un indicatif inconnu). Vérifié par les tests « at least 3 passages » et « three known airlines » du contrat.
  Scénarios de changement :
  - Source réelle adsb.lol (SPEC-0007) : `src/main.tsx` seul ; la démonstration reste pour le développement.
  - Nouveau cas de démonstration (avion lent à `100:00`, avion sans indicatif) : `DEMO_LANES` dans `demo.ts` seul.
  - Démonstration choisie à l'exécution (réglage développeur) plutôt que par `__DEV__` : `src/main.tsx` seul.

## Groupe 2 (après fusion du groupe 1)
### T3 : Cartes « à venir » et « En ce moment »
- Périmètre : src/features/passages/components/
- Dépend de : T1
- Risque : moyen (rendu re-joué à chaque seconde pour chaque carte visible ; la fluidité exigée par le brief n'est vérifiée qu'en relecture et sur cible réelle)
- Critères de la spec couverts : CA12, CA15, CA16
- Définition de fini : `pnpm verify` vert. `components/passage-card.native.test.tsx` rend des cartes construites par `buildCards` (T1) et couvre : fond `theme.bg` et hauteur 650 sur `passage-card-<hex>`, couleurs `theme.big` (compte à rebours) et `theme.small` (libellés), libellés de CA12 et CA15, aucun `passage-route-<hex>`, `passage-tail-<hex>` présent, jauge `progressbar` « Visibilité » de valeur `gaugePercent(progress)`, flèche absente si `arrowAngleDeg` est `null`, sinon `rotate` et attributs décoratifs de CA16. Aucun calcul dans les `.tsx` : toute valeur affichée vient d'un champ de `PassageCard` ou de `gaugePercent`. Les composants sous-jacents (colonne, dérive, flèche) sont mémoïsés sur des props primitives. L'interface figée ci-dessus s'applique.
- Conception :
  ```diff
   src/features/passages/components
  +├── passage-card.tsx                # NOUVEAU : conteneur (testID, 650 pt, fond, rayon, marge), aiguille vers l'une des deux cartes
  +├── upcoming-card.tsx               # NOUVEAU : compte à rebours, « Passe à », « Regardez » + cardinal + flèche
  +├── overhead-card.tsx               # NOUVEAU : « Au-dessus de vous », « EN CE / MOMENT », jauge, Altitude, Vitesse, Direction
  +├── airline-column.tsx              # NOUVEAU : Compagnie, Vol, Appareil + AirlineTail (passage-tail-<hex>), mémoïsé
  +├── direction-arrow.tsx             # NOUVEAU : View rotate(arrowAngleDeg) + flèche SVG, décorative, null sans cap
  +├── visibility-gauge.tsx            # NOUVEAU : progressbar « Visibilité », piste theme.track
  +└── passage-card.native.test.tsx
  ```
  ```ts
  PassageCardView(props: { card: PassageCard }): ReactElement   // mémoïsé ; seul export lu par l'écran (T4)
  DirectionArrow(props: { hex: string; angleDeg: number | null; color: string }): ReactElement | null
  VisibilityGauge(props: { progress: number; theme: AirlineTheme }): ReactElement
  ```
  ```diff
   FlatList.renderItem (T4)
  +  PassageCardView({ card })
  +    card.kind === "upcoming" → UpcomingCard → Text(countdown) · DirectionArrow · AirlineColumn
  +    card.kind === "overhead" → OverheadCard → VisibilityGauge(gaugePercent) · DirectionArrow · AirlineColumn
  +      AirlineColumn → AirlineTail(palette = card.airline.tail)      (src/shared/airlines/tail.tsx)
  ```
  Ordre de construction :
  1. `PassageCardView` : conteneur coloré et compte à rebours seul, rendu depuis une carte de `buildCards`. Vérifié par le test natif (fond, hauteur, `02:14`).
  2. Carte à venir complète et `AirlineColumn` avec la dérive. Vérifié par les libellés et couleurs de CA12 dans le test natif.
  3. Carte « En ce moment » et jauge. Vérifié par CA15 dans le test natif.
  4. `DirectionArrow`. Vérifié par la rotation et les attributs de CA16 dans le test natif.
  Scénarios de changement :
  - Images de dérive réelles (SPEC-0010) : `airline-column.tsx` seul (la dérive vient d'un composant partagé de `src/shared/airlines/`).
  - Bloc route et type d'appareil (SPEC-0009) : nouveau composant de route et `upcoming-card.tsx` ; `service.ts` pour les champs (T1). Accepté : une nouvelle donnée affichée.
  - Libellés traduits : chaque carte porte ses textes (trois fichiers) ; accepté tant qu'aucune langue n'est annoncée (`docs/PRODUCT.md`).

## Groupe 3 (après fusion du groupe 2)
### T4 : Écran Prochains passages, feature et activation des contrats
- Périmètre : src/features/passages/index.ts, src/features/passages/screens/, src/app.native.test.tsx, tests/acceptance/SPEC-0006.test.ts, tests/acceptance/SPEC-0006.native.test.tsx
- Dépend de : T1, T2, T3
- Risque : moyen (la feature entre dans le registre généré et remplace l'écran d'accueil de l'application ; l'écran lit la scène et le cap)
- Critères de la spec couverts : CA10, CA11, CA13, CA14, CA17, CA18, CA19
- Définition de fini : `pnpm verify` vert avec le `.skip` retiré des **deux** `describe` de `tests/acceptance/SPEC-0006.test.ts` et du `describe` de `tests/acceptance/SPEC-0006.native.test.tsx` (tâche de clôture : ce retrait active les scénarios cachés en CI). `src/app.native.test.tsx` : le test du registre vide passe `features: []` explicitement (le registre généré contient désormais `passages`). `screens/passages-screen.native.test.tsx` couvre ce que le contrat ne joue pas : changement de fuseau sans plantage, liste vide sans erreur ni log. Aucun log, aucun appel au suivi des erreurs dans l'écran. PR : capture du parcours sur simulateur iPhone (393 × 852 pt) avec la source de démonstration (calage, comptes à rebours, bascule à 00:00, flèche), comparée à `03-passages-en-ce-moment.png`, `04-passages-prochain.png` et `05-passages-suivant.png`, écarts listés. L'interface figée ci-dessus s'applique.
- Conception :
  ```diff
   src/features/passages
  +├── index.ts                               # NOUVEAU : feature { name: "passages", order: 1, screen }, ré-exporte flightLabel, formatMetric
  +└── screens
  +    ├── passages-screen.tsx                # NOUVEAU : useScene → cardsOf → FlatList calée
  +    └── passages-screen.native.test.tsx
  ~src/app.native.test.tsx                    # MODIFIÉ : registre vide explicite (features: [])
  ```
  ```ts
  export const feature: Feature   // { name: "passages", order: 1, screen: PassagesScreen }, sans presence (INV9)
  PassagesScreen(): ReactElement
  ```
  ```diff
   app/index.tsx → main.tsx → createApp → pagerRoot(features.gen) → PassagesScreen
  +  useScene()                                                   (src/shared/scene, SPEC-0004)
  +  cardsOf(view, Intl.DateTimeFormat().resolvedOptions().timeZone)   (service.ts, T1)
  +  FlatList testID="passages-list" data=cards keyExtractor=hex
  +    snapToInterval / contentContainerStyle ← PASSAGES_METRICS, decelerationRate="fast", disableIntervalMomentum
  +    renderItem → PassageCardView({ card })                     (components, T3)
  ```
  Ordre de construction :
  1. `index.ts` et un écran qui rend la `FlatList` calée avec `cardsOf`. Vérifié par CA10, CA11 et CA12 du contrat natif en local.
  2. Ticks, bascule, cap et rafraîchissement, sans code nouveau attendu (tout vient de `useScene` et `buildCards`). Vérifié par CA13, CA14, CA16 et CA17.
  3. États sans scène, absence de log, `src/app.native.test.tsx`, retrait des `.skip`. Vérifié par CA18, CA19, `pnpm verify`, puis capture sur simulateur.
  Scénarios de changement :
  - États de chargement, refus, hors ligne et liste vide (SPEC-0008) : `passages-screen.tsx` (`ListEmptyComponent`) et `cardsOf` ou une fonction voisine dans `service.ts`. Deux fichiers, accepté.
  - Minuteur de 10 s et pause en arrière-plan (SPEC-0007) : aucun fichier de la feature, tout est dans `useScene`.
  - Scène partagée entre Ciel et Passages (amendement de SPEC-0004) : aucun fichier si la signature de `useScene` ne change pas.
