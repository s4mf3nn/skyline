# Plan SPEC-0009
Statut : PRÊT
Questions : aucune

Constats partagés :
- **Préalables faits** : #125, #126 sur main, SPEC-0005 livrée (`plan-gate deps` OK).
- **Interface figée** : « Contrat d'interface » de la spec, plus `normalizeHex(hex): string | null` (trim, `^[0-9a-f]{6}$` sans casse, minuscules) dans `routes/index.ts`, lu par le cache (CA10) et `buildAircraftUrl` (CA2).
- **Isolation** : `routes/index.ts` n'importe que `scene`, `clock`, `errors` et ses voisins purs (`fake`, `lookup`, `estimate`), jamais `adsbdb.ts`, `zod`, `hooks.ts`, `block.tsx`. Ni `console.*` ni `monitoring` (CA21).
- **Contrats** : `describe.skip` de SPEC-0009 gardés jusqu'à T5 (retrait local sans commit permis).
- **Bibliothèques** : zod 4.6.5 (cache) ; Hermes `Intl` (cache) ; RNTL 14.1.0 (Context7 `/callstack/react-native-testing-library` v13.3.3 : `*ByRole` ne voit une `View` que si `accessible`, nom = `accessibilityLabel`).

## Groupe 1 (parallèle)
### T1 : Contrat des routes, faux et cache de session
- Périmètre : src/shared/routes/index.ts, src/shared/routes/fake.ts, src/shared/routes/lookup.ts, src/shared/routes/routes.test.ts, src/shared/errors.ts, src/shared/services/index.tsx, docs/adr/0001-stack.md
- Dépend de : aucune
- Risque : élevé (zone sensible `src/shared/routes/`, interface consommée par T3 à T5)
- Critères de la spec couverts : CA1, CA8, CA9, CA10, CA13
- Définition de fini : `pnpm verify` vert ; bloc « session cache » du contrat vert en local ; `routes.test.ts` couvre CA1 (normalisation), `normalizeHex`, 9 999 / 10 000 ms, délai par clé ; « Services tiers » de l'ADR-0001 : adsbdb.com, `src/shared/routes/`. Interface figée ci-dessus.
- Conception :
  ```diff
   src/shared/routes
  +├── index.ts        # types, constantes, normalize*, ré-exports
  +├── fake.ts         # createFakeRouteSource
  +├── lookup.ts       # createFlightLookup
  +└── routes.test.ts
  ~src/shared/errors.ts            # + ROUTE_UNAVAILABLE
  ~src/shared/services/index.tsx   # + routes?: FlightLookup
  ```
  ```ts
  // lookup.ts : un moteur générique, deux tables (route par indicatif, type par hex)
  type Entry<T> = { kind: "settled"; result: LookupResult<T> } | { kind: "pending"; promise: Promise<LookupResult<T>> } | { kind: "failed"; atMs: number }
  ```
  ```diff
   lookup.route(callsign)
  +  normalizeCallsign(callsign) ?? → { status: "unknown" }   # rien gardé, source non appelée (CA10)
  +  settled → résultat ; pending → même promesse ; failed et now - atMs < 10 000 → unavailable
  +  source.fetchRoute(clé) → found | unknown gardé ; rejet → failed { atMs: clock.now() }
  ```
  Ordre de construction :
  1. `normalizeCallsign`, `normalizeHex` et le faux (CA1, CA10) ; vérifiés par `routes.test.ts`.
  2. `route()` : garde et requête partagée (CA8) ; contrat en local.
  3. Délai de reprise, `aircraftType()` (CA9) ; contrat en local.
  Scénarios de changement :
  - Relance avec délai croissant (hors périmètre) : `lookup.ts` seul.
  - Cache sur disque (hors périmètre) : `lookup.ts` et un service de stockage ; accepté.

### T2 : Position du passage et heure HH:MM partagée
- Périmètre : src/shared/scene/model.ts, src/shared/scene/passage.ts, src/shared/scene/passage.test.ts, tests/acceptance/SPEC-0004.test.ts, src/shared/clock/format.ts, src/shared/clock/index.ts, src/shared/clock/clock.test.ts, src/features/passages/service.ts, src/shared/states/index.ts
- Dépend de : aucune
- Risque : moyen (scène et format partagés par les deux écrans)
- Critères de la spec couverts : CA11, CA12
- Définition de fini : `pnpm verify` vert ; retrait des trois `it.skip` « Amendement SPEC-0009 » de `SPEC-0004.test.ts` (seule modification), verts ; contrats SPEC-0006 et SPEC-0008 inchangés et verts.
- Conception :
  ```diff
  ~src/shared/scene/model.ts     # Passage + latitude, longitude (position à nowMs)
  ~src/shared/scene/passage.ts   # predictPassage : extrapolation en ligne droite, avant ou arrière
  +src/shared/clock/format.ts    # formatClockTime
  ~src/shared/clock/index.ts     # ré-export (routes/index.ts n'a pas le droit d'importer shared/format)
  ~src/features/passages/service.ts, src/shared/states/index.ts   # délèguent
  ```
  ```ts
  formatClockTime(timestampMs: number, timeZone: string): string   // "HH:MM", 24 h, formatToParts
  ```
  Ordre de construction :
  1. Position du passage ; contrat SPEC-0004 vert.
  2. `formatClockTime` et délégations ; SPEC-0006 et SPEC-0008 verts.
  Scénarios de changement :
  - Heure sur 12 h selon l'appareil : `clock/format.ts` seul.
  - Extrapolation sur l'orthodromie : `passage.ts` seul.

## Groupe 2 (après fusion du groupe 1)
### T3 : Client adsbdb.com et branchement
- Périmètre : src/shared/routes/adsbdb.ts, src/shared/routes/adsbdb-response.ts, src/shared/routes/adsbdb.test.ts, src/main.tsx
- Dépend de : T1
- Risque : élevé (second hôte sortant, indicatif et hex dans le chemin, réponse externe à valider)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA21
- Définition de fini : `pnpm verify` vert ; bloc « adsbdb.com client » vert en local ; `adsbdb.test.ts` couvre 404 sans `unknown`, `fetch` sourd au signal, `clearTimeout`, message sans URL ni corps. Interface figée ci-dessus.
- Conception :
  ```diff
   src/shared/routes
  +├── adsbdb.ts            # URL, requête, délai, erreurs (motif de shared/adsb/adsblol.ts)
  +├── adsbdb-response.ts   # schémas Zod jitless : corps → FlightRoute | null, type | null
  +└── adsbdb.test.ts
  ~src/main.tsx            # routes: createFlightLookup({ source: createAdsbdbRouteSource({ fetch }), clock })
  ```
  ```ts
  parseRouteBody(body: unknown): FlightRoute | null      // lève ROUTE_UNAVAILABLE (CA6)
  parseAircraftBody(body: unknown): string | null
  ```
  ```diff
   fetchRoute(callsign)
  +  buildCallsignUrl(callsign) ?? return null           # sans fetch (CA3)
  +  request(url) : AbortController, setTimeout(8 000), Promise.race ; GET, Accept seul
  +    hors 2xx et ≠ 404 → rejet ; response.json()
  +  parseRouteBody(body)
  +  catch → AppError("ROUTE_UNAVAILABLE", message fixe) ; finally clearTimeout
  ```
  Ordre de construction :
  1. `buildCallsignUrl`, `buildAircraftUrl` (CA1, CA2) ; contrat Vitest en local.
  2. `fetchRoute` : route complète, champs invalides, inconnu (CA3 à CA5).
  3. Échecs et délai (CA6), `fetchAircraftType` (CA7), `main.tsx` ; `pnpm dev` sur simulateur.
  Scénarios de changement :
  - Backend du MVP à la place d'adsbdb : nouveau client et `main.tsx`.
  - `icao_type` au lieu de `type` : `adsbdb-response.ts` seul.

### T4 : Estimations, formats et bloc route des cartes
- Périmètre : src/shared/routes/estimate.ts, src/shared/routes/estimate.test.ts, src/shared/routes/index.ts, src/shared/routes/hooks.ts, src/shared/routes/block.tsx, src/features/passages/service.ts, src/features/passages/components/overhead-card.tsx, src/features/passages/components/upcoming-card.tsx, src/features/passages/components/passage-card.native.test.tsx
- Dépend de : T1, T2
- Risque : élevé (zone `src/shared/routes/`, crochet hors du cycle de 10 s)
- Critères de la spec couverts : CA11, CA12, CA14, CA15, CA18, CA19, CA20
- Définition de fini : `pnpm verify` vert ; bloc « estimates and formats » vert en local, et les tests natifs CA14, CA15, CA18 à CA20 hors assertions `ciel-*` ; aucun calcul dans les `.tsx`. Interface figée ci-dessus.
- Conception :
  ```diff
   src/shared/routes
  +├── estimate.ts   # estimateFlight, formatRoute*, formatEstimatedArrival, skyRouteView
  ~├── index.ts      # ré-exporte estimate.ts
  +├── hooks.ts      # useFlightInfo
  +└── block.tsx     # RouteBlock (passage-route-<hex>)
  ~src/features/passages/service.ts             # PassageCard + callsign
  ~src/features/passages/components/*-card.tsx  # RouteBlock, type d'appareil
  ```
  ```ts
  useFlightInfo(hex: string | null, callsign: string | null): { route: FlightRoute | null; aircraftType: string | null }
  RouteBlock(props: { hex: string; callsign: string | null; theme: AirlineTheme }): ReactElement | null
  // vue pure de Ciel (T5), EstimateInput = entrée d'estimateFlight : chaque ligne null si incomplète
  skyRouteView(input: EstimateInput & { timeZone: string }): { codes; cities; arrival: string | null; progressPercent: number | null }
  ```
  ```diff
   UpcomingCard / OverheadCard
  +  useFlightInfo(card.hex, card.callsign) → aircraftType ?? card.aircraftType → AirlineColumn
  +  RouteBlock → useFlightInfo
  +    useServices().routes, useScene() → snapshotAtMs
  +    useEffect([routes, hex, callsign, snapshotAtMs]) tant que non définitif :
  +      routes.route(callsign), routes.aircraftType(hex) → setState (ignoré après démontage)
  +    formatRouteCodes, formatRouteCities → chaque ligne seulement complète
  ```
  Ordre de construction :
  1. `estimate.ts` (CA11, CA12) ; bloc Vitest du contrat.
  2. `useFlightInfo` et `RouteBlock` sur la carte à venir (CA14, CA15) ; contrat natif en local.
  3. Carte « En ce moment », type dans la colonne, réponse retenue et reprise (CA18 à CA20).
  Scénarios de changement :
  - Heure de départ estimée (MVP) : `estimate.ts` et `block.tsx`.
  - Préchargement (hors périmètre) : `hooks.ts` et le contrôleur de scène ; accepté.

## Groupe 3 (après fusion du groupe 2)
### T5 : Route de Ciel et activation des contrats
- Périmètre : src/shared/routes/block.tsx, src/features/ciel/screens/sky-screen.tsx, src/features/ciel/service.ts, src/features/ciel/service.test.ts, src/features/ciel/hooks/sky-store.ts, src/features/ciel/hooks/sky-store.test.ts, src/features/ciel/hooks/use-sky-presence.ts, src/features/ciel/hooks/use-shown-sky.ts, tests/acceptance/SPEC-0009.test.ts, tests/acceptance/SPEC-0009.native.test.tsx, docs/factory/libs-cache.md
- Dépend de : T1, T2, T3, T4
- Risque : élevé (clôture : active les scénarios cachés)
- Critères de la spec couverts : CA13, CA16, CA17, CA21
- Définition de fini : `pnpm verify` vert ; retrait de **tous** les `describe.skip` (trois dans `SPEC-0009.test.ts`, un dans le `.native`), seule modification, tous verts ; SPEC-0005 vert ; entrée RNTL au cache ; capture simulateur dans la PR.
- Conception :
  ```diff
  ~src/shared/routes/block.tsx          # + SkyRouteBlock (ciel-route-*)
   src/features/ciel
  ~├── screens/sky-screen.tsx           # SkyRouteBlock ; Text ciel-aircraft-type dans sky-value-aircraft
  ~├── service.ts                       # buildSkyView(passage, aircraftType = null)
  ~├── hooks/sky-store.ts               # + shownAtMs (heure de scène du dernier avion montré)
  ~├── hooks/use-sky-presence.ts        # update(state, nowMs)
  ~└── hooks/use-shown-sky.ts           # useFlightInfo, rend { view, passage, shownAtMs }
  ```
  ```diff
   SkyScreen
  ~  useShownSky() → useFlightInfo(shown.hex, shown.callsign) ; buildSkyView(shown, aircraftType)
  +  SkyRouteBlock({ passage, nowMs: shownAtMs, theme })
  +    useFlightInfo → skyRouteView({ route, position: passage, groundSpeedKmh, nowMs, timeZone })
  +    codes, villes, heures (— | ~HH:MM)
  +    <View accessible accessibilityRole="progressbar" accessibilityLabel="Progression du vol" accessibilityValue={{ min: 0, max: 100, now }}>
  ```
  Ordre de construction :
  1. Type d'appareil sur Ciel (CA13, `ciel-aircraft-type`) ; contrats SPEC-0005 et natif en local.
  2. `SkyRouteBlock` complet puis partiel (CA16, CA17).
  3. `shownAtMs` (avion retenu figé, INV9), `.skip` retirés, CA21.
  Scénarios de changement :
  - Repère rond ou autre style de barre : `block.tsx` seul.
  - Heure de départ estimée (MVP) : `skyRouteView` et `SkyRouteBlock`, deux fichiers.
