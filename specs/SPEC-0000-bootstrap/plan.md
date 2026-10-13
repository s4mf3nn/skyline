# Plan SPEC-0000
Statut : PRÊT

Décisions de l'humain (2026-10-13), prises avant ce plan :
- **Typage du contrat de rendu de SPEC-0001.** `tests/acceptance/SPEC-0001.native.test.tsx` appelle `createApp` avec l'option `build`, que SPEC-0001 ajoute. T3 remplace l'exclusion générique de `tsconfig.test.json` par une exclusion ciblée de ce seul fichier, commentée « retirée par la tâche de SPEC-0001 qui ajoute `build` ». La liste de contrôle de SPEC-0000 et les contraintes de SPEC-0001 sont amendées en ce sens dans la même PR que ce plan.
- **Texte de la permission de localisation** : « Skyline utilise ta position pour trouver les avions qui passent au-dessus de toi. »
- **Identifiants de l'application** (`ios.bundleIdentifier`, `android.package`) : le socle ne les pose pas, SPEC-0001 les fixe avec EAS. Le parcours sur simulateur de T4 passe par un development build local dont l'identifiant n'est pas commité.
- **Dépendances** : un paquet pair ou de types exigé par une ligne du tableau de l'ADR-0001 est couvert par cette ligne (`jest`, `@types/jest`, `test-renderer`, `@react-native/jest-preset`, `@types/react`, pairs d'Expo Router). Chacun est cité dans le résumé de PR avec la justification « ADR-0001 ».

Constats partagés par les tâches :
- **Deux lanceurs, une règle par extension.** Un fichier `.ts` de `src/` est de la logique : joué, couvert et muté par Vitest, sans import de React Native. Un fichier `.tsx` de `src/` est du rendu : joué par Jest (`*.native.test.tsx`), hors des seuils de couverture et de la mutation. Aucun calcul dans un `.tsx`.
- **Point d'entrée d'un service tiers.** `src/shared/<service>/index.ts` n'exporte que l'interface, ses types et le faux : le contrat Vitest le charge par chemin, il ne doit importer aucun module natif. L'implémentation réelle vit dans un fichier nommé du même dossier (`system.ts`, `expo.ts`, `empty.ts`, `noop.ts`) et n'est importée que par `src/main.tsx`.
- **Interfaces figées** : celles du « Contrat d'interface » de la spec, noms compris. `AppServices` est défini dans `src/shared/services/`, `Feature` dans `src/shared/feature.ts` (une feature n'importe que `src/shared/`) ; `src/app.tsx` les réexporte.
- **`package.json` est en `"type": "module"`** : un fichier de configuration écrit en CommonJS (`module.exports`) y échoue sous le nom `.js`. Chaque tâche vérifie le nom que l'outil charge réellement et retient `.js` (nom de la spec) ou `.cjs`, un seul fichier par outil.
- **Dépendances** : `npx expo install`, jamais `pnpm add` d'une dernière version ; versions du tableau de l'ADR-0001. Context7 n'a la doc Expo que jusqu'à `sdk-56` : forme à confirmer dans `node_modules`, puis à noter dans `docs/factory/libs-cache.md`.
- **Contrat** : les deux fichiers de contrat gardent leur `describe.skip` jusqu'à T4. Pour vérifier une tranche, une tâche peut retirer le `.skip` en local, sans le commiter.

## Groupe 1 (seul)
### T1 : Projet Expo SDK 57, style NativeWind et commande dev
- Périmètre : package.json, pnpm-lock.yaml, biome.json, app.json, babel.config.js, babel.config.cjs, metro.config.js, metro.config.cjs, tailwind.config.js, tailwind.config.cjs, global.css, nativewind-env.d.ts, tsconfig.json, .gitignore, .env.example, app/_layout.tsx, assets/fonts/, tests/unit/expo-config.test.ts, docs/factory/UI.md, docs/factory/libs-cache.md, tests/unit/ci-data.test.ts, tests/unit/security-scan.test.ts
- Dépend de : aucune
- Risque : élevé (`app.json` est en zone sensible : permission de localisation ; `package.json` fixe les versions de tout le projet)
- Critères de la spec couverts : CA4, CA2
- Définition de fini : `pnpm verify` vert ; `tests/unit/expo-config.test.ts` vert (permission « pendant l'utilisation » seule, aucune localisation en arrière-plan, script `dev` sans port en dur) ; `PORT=<port libre> pnpm dev` démarre Metro et le bundle iOS se compile ; `npx expo install --check` ne signale aucun écart de version ; `node scripts/pre-review.mjs zones` relu. Les constats ci-dessus s'appliquent (extension des fichiers de configuration, dépendances).
- Notes :
  - Installe le runtime et le style seulement : `expo`, `react`, `react-native`, `expo-router` et ses pairs, `nativewind`, `tailwindcss` 3.4, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `react-native-svg`, `expo-location`, `expo-font`, `@types/react`. Jest et RNTL sont posés par T3, Sentry par SPEC-0001.
  - `app/_layout.tsx` est le layout du socle : il n'entre dans le périmètre d'aucune tâche de feature. Il importe `global.css`, charge Archivo (`useFonts`) et rend `<Slot />` ; aucune liste d'écrans. La route `app/index.tsx` est posée par T3 : d'ici là, Expo Router affiche son écran par défaut.
  - Archivo : fichier TTF statique du dépôt Google Fonts, avec sa licence `OFL.txt`, dans `assets/fonts/`. Pas de paquet `@expo-google-fonts/archivo` (hors tableau). Une seule graisse suffit au titre ; la spec du thème fixe les instances condensées.
  - `biome.json` : `pnpm lint` lit tous les fichiers du dépôt. Règle-le pour qu'il accepte `global.css` (directives `@tailwind`), `app.json` et les fichiers de configuration `.cjs`, sans désactiver de règle dans `src/` ; si un fichier ne peut pas être lu par Biome, exclus ce seul fichier avec un commentaire.
  - `app.json` : aucun secret, aucun identifiant d'application, texte de permission fixé ci-dessus. `.env.example` : `EXPO_PUBLIC_SENTRY_DSN=` avec une valeur factice.
  - `tsconfig.json` : `jsx`, `lib`, alias `@/*` vers `src/*`, `app` et les fichiers `*.d.ts` dans `include` ; garde les options strictes actuelles et ce dont `tests/unit` a besoin. `tsconfig.test.json` et `vitest.config.ts` ne sont pas touchés ici (T3).
  - `tests/unit/ci-data.test.ts` et `tests/unit/security-scan.test.ts` : les types d'Expo (`expo/types/metro-require.d.ts`) rendent `NODE_ENV` obligatoire dans `ProcessEnv` pour tout le programme TypeScript ; ces deux tests passent un `env` réduit à `spawnSync` et y ajoutent `NODE_ENV: "test"`. Aucun autre changement.
  - `docs/factory/UI.md` : sections « Tokens de style », « Composants de base » (aucun à ce stade), « États standard », « Accessibilité ». La section « Tests d'interface » est remplie par T3.
- Conception :
  ```diff
   .
  ~├── package.json            # MODIFIÉ : dépendances Expo, script dev, factory.routeDirs / routeIgnore
  +├── app.json                # NOUVEAU : nom, slug, scheme, plugins expo-router, expo-font, expo-location
  +├── babel.config.(js|cjs)   # NOUVEAU : babel-preset-expo avec jsxImportSource nativewind, preset nativewind/babel
  +├── metro.config.(js|cjs)   # NOUVEAU : withNativeWind(config, { input: "./global.css" })
  +├── tailwind.config.(js|cjs)# NOUVEAU : preset nativewind, tokens neutres, content = app/ et src/
  +├── global.css              # NOUVEAU : directives @tailwind (Tailwind 3)
  +├── nativewind-env.d.ts     # NOUVEAU : types de className
  ~├── tsconfig.json           # MODIFIÉ : jsx, lib, alias @/, include app
  ~├── .gitignore              # MODIFIÉ : .expo/, ios/, android/, expo-env.d.ts
  +├── .env.example            # NOUVEAU : EXPO_PUBLIC_SENTRY_DSN factice
  +├── app/_layout.tsx         # NOUVEAU : layout du socle (global.css, police, Slot)
  +├── assets/fonts/           # NOUVEAU : Archivo (TTF) et OFL.txt
  +├── tests/unit/expo-config.test.ts  # NOUVEAU : garde de la permission et du script dev
  ~└── docs/factory/UI.md      # MODIFIÉ : tokens, états, accessibilité
  ```
  ```jsonc
  // package.json
  "main": "expo-router/entry",
  "scripts": { "dev": "pnpm gen && expo start --port $PORT" },
  "factory": { "routeDirs": ["app"], "routeIgnore": ["_layout.tsx", "+*"] }
  // app.json, plugin expo-location : permission « pendant l'utilisation » seulement
  ["expo-location", { "locationWhenInUsePermission": "Skyline utilise ta position pour trouver les avions qui passent au-dessus de toi.",
                      "isIosBackgroundLocationEnabled": false, "isAndroidBackgroundLocationEnabled": false }]
  // tailwind.config : tokens cités par docs/factory/UI.md
  colors: { ground: "#0C0C0C", ink: "#F4F1EA" }, fontFamily: { archivo: ["Archivo"] }
  ```
  ```diff
   pnpm dev
  +  pnpm gen                      # src/features.gen.ts
  +  expo start --port $PORT       # Metro, babel.config, metro.config (withNativeWind lit global.css)
  +    expo-router/entry
  +      app/_layout.tsx           # import "../global.css" ; useFonts({ Archivo }) ; <Slot />
  ```
  Ordre de construction :
  1. Expo, React Native, Expo Router, `app.json` minimal, Babel, Metro, `app/_layout.tsx` réduit à `<Slot />`, script `dev` ; vérifiée par `PORT=<port> pnpm dev` puis `curl localhost:<port>/status` (`packager-status:running`) et par la compilation du bundle iOS (`npx expo export --platform ios`, ou requête du bundle à Metro).
  2. NativeWind, Tailwind, `global.css`, tokens, police Archivo chargée dans le layout ; vérifiée par la même compilation du bundle et par `pnpm typecheck` (`className` typé).
  3. Permission de localisation, `.env.example`, `factory.routeDirs`, `.gitignore`, `UI.md` ; vérifiée par `tests/unit/expo-config.test.ts`, `pnpm verify` et `node scripts/pre-review.mjs zones`.
  Scénarios de changement :
  - Nouveau token du handoff (rayon, mesure, couleur neutre) : `tailwind.config` et `docs/factory/UI.md`.
  - Nouvelle permission de l'appareil (caméra au MVP) : `app.json` et `tests/unit/expo-config.test.ts`.
  - Montée de SDK Expo : `package.json`, `pnpm-lock.yaml`, `docs/factory/libs-cache.md` (PR dédiée, `npx expo install --fix`).

## Groupe 2 (après fusion du groupe 1)
### T2 : Services tiers, interfaces, faux et erreurs typées
- Périmètre : src/shared/errors.ts, src/shared/errors.test.ts, src/shared/clock/, src/shared/location/, src/shared/adsb/, src/shared/monitoring/, docs/factory/libs-cache.md
- Dépend de : T1
- Risque : élevé (`src/shared/location/`, `src/shared/adsb/` et `src/shared/monitoring/` sont en zone sensible, revue `full`)
- Critères de la spec couverts : CA5, cas limites
- Définition de fini : tests unitaires Vitest à côté de chaque fichier, verts, qui rejouent les cas « CA5 » de `tests/acceptance/SPEC-0000.test.ts`, les cas limites de la spec et les trois cas limites de `createExpoLocation` listés dans les notes ; ce contrat passe en local sans `.skip` pour ses cas CA5 (non commité) ; `pnpm verify` vert, seuils de couverture tenus sur tous les `.ts` posés. Lis `docs/factory/DOMAIN-SECURITY.md` avant de coder. Les interfaces sont figées et la règle du point d'entrée est ci-dessus.
- Notes :
  - Imports relatifs à l'intérieur de `src/shared/` : l'alias `@/` n'est connu de Vitest qu'après T3.
  - `location/expo.ts` est le seul fichier qui importe `expo-location`. Son test tourne sous Vitest avec `vi.mock("expo-location", fabrique)` : le module natif n'est jamais chargé. Si Vitest ne peut pas le remplacer ainsi, arrête-toi et signale-le (ne sors pas le fichier de la couverture).
  - `watchHeading` est synchrone alors que `watchHeadingAsync` renvoie une promesse : un désabonnement appelé avant sa résolution doit quand même retirer l'abonnement, et plus aucune valeur n'est transmise après.
  - `getPosition` lit l'état de la permission sans déclencher la demande (`getForegroundPermissionsAsync`) ; seule `requestPermission` la déclenche. Aucune position dans un log ni dans un message d'erreur.
  - Cas limites de `createExpoLocation`, chacun avec son test unitaire (`expo-location` remplacé) :
    - tout statut de permission autre que `granted` (dont `undetermined`) donne `"denied"` à `requestPermission` et `LOCATION_DENIED` à `getPosition`, jamais une position ;
    - `trueHeading` vaut `-1` quand le cap vrai est indisponible : `watchHeading` transmet alors `magHeading`, jamais `-1` ;
    - un rejet de `watchHeadingAsync` (permission refusée, capteur absent) ne devient pas un rejet de promesse non attrapé : aucune valeur n'est transmise, et la fonction de désabonnement renvoyée reste appelable sans erreur, y compris avant que l'abonnement soit établi.
  - Hors spec, donc non fait ici : conversion d'une autre panne de localisation en erreur typée, client adsb.lol, Sentry.
- Conception :
  ```diff
   src/shared
  +├── errors.ts            # NOUVEAU : AppError et les codes LOCATION_DENIED, ADSB_UNAVAILABLE
  +├── clock
  +│   ├── index.ts         # NOUVEAU : Clock, createFakeClock
  +│   ├── fake.ts          # NOUVEAU : horloge factice (advance)
  +│   └── system.ts        # NOUVEAU : horloge système (Date.now)
  +├── location
  +│   ├── index.ts         # NOUVEAU : LocationPermission, Position, LocationService, createFakeLocation
  +│   ├── fake.ts          # NOUVEAU : faux (setHeading)
  +│   └── expo.ts          # NOUVEAU : implémentation expo-location
  +├── adsb
  +│   ├── index.ts         # NOUVEAU : Aircraft, AdsbQuery, AdsbSource, createFakeAdsbSource
  +│   ├── fake.ts          # NOUVEAU : faux (queries, setAircraft, setUnavailable)
  +│   └── empty.ts         # NOUVEAU : source réelle provisoire, liste vide
  +└── monitoring
  +    ├── index.ts         # NOUVEAU : ErrorReporter, createFakeErrorReporter
  +    ├── fake.ts          # NOUVEAU : faux (events)
  +    └── noop.ts          # NOUVEAU : implémentation réelle provisoire, ne transmet rien
  ```
  ```ts
  // errors.ts
  type ErrorCode = "LOCATION_DENIED" | "ADSB_UNAVAILABLE"
  class AppError extends Error { readonly code: ErrorCode; constructor(code: ErrorCode, message: string) }
  // implémentations réelles, importées par src/main.tsx seulement
  createSystemClock(): Clock                    // clock/system.ts
  createExpoLocation(): LocationService         // location/expo.ts
  createEmptyAdsbSource(): AdsbSource           // adsb/empty.ts
  createNoopErrorReporter(): ErrorReporter      // monitoring/noop.ts
  // faux : signatures du contrat d'interface de la spec, inchangées
  ```
  ```diff
   createExpoLocation()
  +  requestPermission()  -> Location.requestForegroundPermissionsAsync()   # "granted" | "denied"
  +  getPosition()        -> Location.getForegroundPermissionsAsync()
  +                          refusée : rejette AppError("LOCATION_DENIED")
  +                          accordée : Location.getCurrentPositionAsync()  # { latitude, longitude }
  +  watchHeading(cb)     -> Location.watchHeadingAsync(...)                # cap vrai, sinon magnétique (voir notes)
  +                          renvoie () => abonnement.remove()
  ```
  Ordre de construction :
  1. `errors.ts` et l'horloge (`index.ts`, faux, horloge système) ; vérifiée par leurs tests et par le cas « fake clock » du contrat joué en local.
  2. Localisation : `index.ts` et le faux (permission, `LOCATION_DENIED`, désabonnement du cap), puis `expo.ts` avec `expo-location` remplacé ; vérifiée par les tests et par les trois cas « fake location » du contrat.
  3. Source ADS-B (faux, indisponibilité, champs `null` conservés, source vide) et suivi des erreurs (faux, contexte `{}` par défaut, `noop`) ; vérifiée par les tests, les cas du contrat et `pnpm verify`.
  Scénarios de changement :
  - Client adsb.lol (spec qui branche les données) : nouveau fichier dans `src/shared/adsb/`, et la ligne `adsb` de `src/main.tsx`.
  - Sentry (SPEC-0001) : nouveau fichier dans `src/shared/monitoring/`, et la ligne `monitoring` de `src/main.tsx`.
  - Champ ajouté à `Aircraft` : `src/shared/adsb/index.ts` ; le faux le transmet sans changement.
  - Nouveau code d'erreur métier : `src/shared/errors.ts` et le fichier qui le lève.

## Groupe 3 (après fusion du groupe 2)
### T3 : Jest, fabrique createApp, écran d'accueil et route
- Périmètre : package.json, pnpm-lock.yaml, jest.config.js, jest.config.cjs, vitest.config.ts, tsconfig.json, tsconfig.test.json, .github/workflows/ci.yml, src/app.tsx, src/app.native.test.tsx, src/main.tsx, src/HomeScreen.tsx, src/shared/services/, src/shared/feature.ts, src/shared/feature.test.ts, app/index.tsx, docs/factory/UI.md, docs/factory/libs-cache.md
- Dépend de : T1, T2
- Risque : élevé (`.github/workflows/ci.yml` et `pnpm verify` : outillage de la factory, revue humaine ; `src/app.tsx` est le point d'entrée de toutes les features)
- Critères de la spec couverts : CA1, CA2, CA3, CA5
- Définition de fini : `tests/acceptance/SPEC-0000.native.test.tsx` passe en local sans `.skip` (non commité) par `pnpm test:contract` ; `src/app.native.test.tsx` et `src/shared/feature.test.ts` verts ; `node scripts/contract-files.mjs list` affiche `native -> test:native` ; `pnpm verify` vert avec les deux contrats encore en `.skip` ; les deux mesures provisoires sont retirées. Les constats ci-dessus s'appliquent (règle par extension, interfaces figées, extension de `jest.config`).
- Notes :
  - Installe `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native` 14.1.0 et leurs pairs (couverts par l'ADR-0001, voir ci-dessus). RNTL 14 : `render` est asynchrone, les matchers (`toBeOnTheScreen`) sont actifs sans fichier de setup.
  - `test:native` reçoit les fichiers en arguments et écrit le rapport JSON de Jest dans `$CONTRACT_REPORT`. `test:render` joue les `src/**/*.native.test.tsx`, entre dans `pnpm verify` et dans une étape de la CI. `jest.config` lit `HOLDOUT=1` comme `vitest.config.ts` : les scénarios cachés ne sont joués que par `scripts/holdout.mjs`.
  - `vitest.config.ts` : retire la ligne provisoire `otherRunners.push(...)`, exclut `src/**/*.native.test.{ts,tsx}`, ajoute l'alias `@/`, et limite `coverage.include` aux `.ts` de `src/` avec un commentaire qui renvoie à la règle par extension.
  - `.github/workflows/ci.yml` : l'étape de mutation ne prend plus que les `.ts` de `src/` (retire le motif `.tsx` et l'exemple `src/server.ts`), avec le même commentaire ; ajoute l'étape « Tests de rendu » (`pnpm test:render`). Rien d'autre dans ce fichier.
  - `tsconfig.test.json` : retire l'`exclude` générique, ajoute les types de Jest et les `src/**/*.native.test.tsx` ; `tsconfig.json` exclut ces derniers. Décision ci-dessus : seule reste l'exclusion ciblée `tests/**/SPEC-0001.native.test.tsx`, commentée.
  - `app/index.tsx` est la seule route de la v0, posée par le socle : une ligne de réexport, `export { default } from "@/main";` (`scripts/pre-review.mjs check` refuse tout autre contenu). `app/_layout.tsx` n'est pas dans ce périmètre.
  - `src/HomeScreen.tsx` : fond `bg-ground`, titre « Skyline » en `text-ink font-archivo`, par les tokens de T1 ; aucune valeur en dur. `docs/factory/UI.md` : section « Tests d'interface » seulement.
- Conception :
  ```diff
   .
  ~├── package.json                 # MODIFIÉ : Jest, RNTL, test:native, test:render, verify, factory.contractRunners
  +├── jest.config.(js|cjs)         # NOUVEAU : preset jest-expo, testMatch selon HOLDOUT, alias @/
  ~├── vitest.config.ts             # MODIFIÉ : mesure provisoire retirée, alias @/, couverture des .ts seuls
  ~├── tsconfig.test.json           # MODIFIÉ : exclude générique retiré, types Jest
  ~├── tsconfig.json                # MODIFIÉ : exclut src/**/*.native.test.tsx
  ~├── .github/workflows/ci.yml     # MODIFIÉ : mutation des .ts seuls, étape test:render
  +├── app/index.tsx                # NOUVEAU : route fine, réexporte src/main.tsx
  +└── src
  +    ├── app.tsx                  # NOUVEAU : createApp ; réexporte AppServices et Feature
  +    ├── app.native.test.tsx      # NOUVEAU : rendu (ordre des features, registre par défaut)
  +    ├── main.tsx                 # NOUVEAU : export default createApp({ services réels })
  +    ├── HomeScreen.tsx           # NOUVEAU : écran d'accueil neutre, provisoire
  +    └── shared
  +        ├── feature.ts           # NOUVEAU : Feature, pickScreen
  +        └── services/index.tsx   # NOUVEAU : AppServices, ServicesProvider, useServices
  ```
  ```ts
  // src/app.tsx
  createApp(options: { services: AppServices; features?: readonly Feature[] }): ComponentType
  // src/shared/feature.ts
  interface Feature { name: string; order: number; screen: ComponentType }
  pickScreen(features: readonly Feature[], fallback: ComponentType): ComponentType
  // écran de la feature d'`order` le plus petit, `fallback` si la liste est vide ; ne modifie pas l'entrée
  // src/shared/services/index.tsx
  interface AppServices { clock: Clock; location: LocationService; adsb: AdsbSource; monitoring: ErrorReporter }
  ServicesProvider(props: { services: AppServices; children: ReactNode }): ReactElement
  useServices(): AppServices
  ```
  ```jsonc
  // package.json
  "scripts": { "test:native": "jest --json --outputFile=$CONTRACT_REPORT",
               "test:render": "jest --passWithNoTests <src>" },
  "factory": { "contractRunners": { "native": "test:native" } }
  ```
  ```diff
   app/index.tsx                       # export { default } from "@/main"
  +  src/main.tsx                     # export default : le composant construit ci-dessous
  +    createApp({ services: { clock: createSystemClock(), location: createExpoLocation(),
  +                            adsb: createEmptyAdsbSource(), monitoring: createNoopErrorReporter() } })
  +      features = options.features ?? registre de src/features.gen.ts
  +      <ServicesProvider services>
  +        pickScreen(features, HomeScreen)   # le choix de l'écran reste dans un .ts, couvert et muté
  +          useServices()             # lu par les écrans
  ```
  Ordre de construction :
  1. Jest, `jest.config`, `test:native`, `factory.contractRunners`, et `createApp` qui rend `HomeScreen` sans rien lire ; vérifiée par le cas CA1 du contrat de rendu joué en local par `pnpm test:contract`.
  2. `ServicesProvider`, `useServices`, `Feature`, `pickScreen`, montage de la première feature ; vérifiée par les cas CA3 et CA5 du contrat, `src/app.native.test.tsx` et `src/shared/feature.test.ts`.
  3. `src/main.tsx` et `app/index.tsx` avec les implémentations réelles de T2 ; vérifiée par `pnpm dev`, la compilation du bundle iOS et `node scripts/pre-review.mjs check` (route fine).
  4. Typage des `*.native.test.tsx`, couverture, `test:render`, `verify`, CI, retrait des mesures provisoires ; vérifiée par `pnpm verify` et `node scripts/contract-files.mjs list`.
  Scénarios de changement :
  - Pager à deux pages (spec de navigation) : `src/app.tsx`, `src/app.native.test.tsx` et `src/shared/feature.ts` (toutes les features triées au lieu de la première) ; `HomeScreen.tsx` supprimé.
  - Option `build` et écran d'erreur (SPEC-0001) : `src/app.tsx`, `src/app.native.test.tsx`, un nouvel écran d'erreur, `src/shared/monitoring/`, et l'exclusion ciblée de `tsconfig.test.json` retirée ; plus `package.json`, `app.json` et `eas.json` pour la livraison. Plus de deux fichiers, accepté : c'est une spec entière, pas une règle dispersée.
  - Cinquième service tiers (source des routes de vol) : son dossier `src/shared/<service>/`, `AppServices` dans `src/shared/services/index.tsx`, `src/main.tsx` ; les contrats existants, qui construisent `AppServices` à la main, demandent alors un champ de plus : accepté, c'est le prix d'une liste de services typée, et la spec qui l'ajoute le porte.
  - Nouveau test de rendu d'une feature : un fichier `*.native.test.tsx` à côté de l'écran, aucun fichier de configuration.

## Groupe 4 (après fusion du groupe 3)
### T4 : Clôture, activation du contrat et parcours sur simulateur
- Périmètre : tests/acceptance/SPEC-0000.test.ts, tests/acceptance/SPEC-0000.native.test.tsx
- Dépend de : T1, T2, T3
- Risque : faible (deux retraits de `.skip`, aucun code)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5, cas limites
- Définition de fini : retire `.skip` du `describe` des **deux** fichiers de contrat, et rien d'autre dans ces fichiers (`node scripts/check-contract.mjs`) ; c'est ce retrait qui active les scénarios cachés en CI. `pnpm verify` vert, tests de rendu Jest compris (CA2). Parcours sur cible réelle : l'application démarre sur simulateur iPhone 15 ou 16 et affiche l'écran d'accueil (fond `#0C0C0C`, titre « Skyline » crème, Archivo), capture jointe à la PR. Liste de contrôle du socle de la spec relue ligne à ligne dans le résumé de PR, dont `node scripts/pre-review.mjs zones`. Si un critère échoue, la correction est hors de ce périmètre : arrête-toi et signale la tâche à rouvrir.
