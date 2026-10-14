# Cache des vérifications de bibliothèques

Faits déjà vérifiés dans la documentation (Context7 ou lecture de `node_modules`) à une **version précise**. Voir `docs/factory/CONTEXT7.md` pour la procédure. Entrées courtes, jamais de copie de doc. Une entrée dont la version ne correspond plus à `package.json` est périmée.

Format d'une entrée :

```
## <bibliothèque> <version épinglée>
Source : <Context7 `/org/projet/version`, ou fichier de `node_modules`> le AAAA-MM-JJ.
- <API> : <forme correcte, piège> (1 à 3 lignes).
```

<!-- Les entrées commencent ici. -->

## vitest 4.1.11
Source : Context7 `/vitest-dev/vitest/v4.1.6` (version la plus proche disponible) le 2026-10-02, formes confirmées par exécution en 4.1.11.
- `test.exclude` : étendre avec `[...configDefaults.exclude, "<glob>"]` (`configDefaults` vient de `vitest/config`) ; le remplacer seul retire les exclusions par défaut.
- Rapport JSON : `vitest run <fichiers> --reporter=json --outputFile=<chemin>` ; format Jest (`testResults[].name`, `.status`, `.message`, `.assertionResults[].status|fullName|failureMessages`).


## @sentry/mcp-server 0.42.0
Source : Context7 `/getsentry/sentry-mcp` le 2026-10-03, version lue sur le registre npm le même jour.
- Lancement stdio : `npx @sentry/mcp-server`, jeton dans `SENTRY_ACCESS_TOKEN` ; `SENTRY_HOST` seulement pour un Sentry auto-hébergé.
- Lecture seule : `MCP_SKILLS=inspect` (issues, événements, traces, releases) ; le skill `triage` demande `event:write`. Droits minimaux du jeton : `org:read`, `project:read`, `team:read`, `event:read`.


## expo 57.0.28
Source : `bundledNativeModules.json` d'`expo@57.0.28` (registre npm) le 2026-10-13 ; Context7 `/expo/expo/__branch__sdk-56` pour les API (pas de branche `sdk-57` disponible : forme à confirmer dans `node_modules` après installation).
- Versions natives alignées sur le SDK : `react-native` 0.86.3, `react` 19.2.3, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, `react-native-gesture-handler` ~2.32.0, `react-native-svg` 15.15.4, `@sentry/react-native` ~7.11.0. Installer avec `npx expo install`, pas `pnpm add` de la dernière version npm.
- `expo-location` : `requestForegroundPermissionsAsync()` déclenche la demande, `getForegroundPermissionsAsync()` lit seulement l'état. iOS n'a pas de `timeInterval` : seul `distanceInterval` règle la fréquence de `watchPositionAsync`.

## nativewind 4.2.7
Source : Context7 `/nativewind/nativewind/nativewind_4.2.0` le 2026-10-13, version lue sur le registre npm le même jour.
- NativeWind 4 fonctionne avec Tailwind **3** (moteur `react-native-css-interop`) ; Tailwind 4 demande NativeWind 5, encore en préversion.
- Configuration : `presets: [require("nativewind/preset")]` dans `tailwind.config.js`, `withNativeWind(config, { input: "./global.css" })` dans `metro.config.js`, preset `babel-preset-expo`.

## @sentry/react-native 7.11
Source : Context7 `/websites/sentry_io_platforms_react-native` le 2026-10-13 (doc non versionnée ; version du SDK Expo 57).
- `sendDefaultPii` vaut `false` par défaut : ne pas l'activer (l'exemple d'installation de la doc le met à `true`). Filtrer le reste dans `beforeSend(event)`, qui renvoie l'événement nettoyé.
- Expo : plugin de configuration `@sentry/react-native/expo` dans `app.json`, composant racine enveloppé par `Sentry.wrap`.

## Installation du socle Expo 57 (pnpm)
Source : lecture de `node_modules` et exécution de `expo start` le 2026-10-13.
- `package.json` est en `"type": "module"` : `babel.config.cjs`, `metro.config.cjs` et `tailwind.config.cjs` (CommonJS), chargés tels quels par Babel, Metro et Tailwind.
- Babel : `presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"]` ; `@babel/core` doit être épinglé en `^7` (pnpm résout sinon la version 8, hors pairs d'Expo).
- Pairs d'Expo Router à installer par `npx expo install` : `expo-constants`, `expo-linking`, `react-native-safe-area-context`, `react-native-screens`, `@expo/metro-runtime`, `@expo/log-box`.
- `expo-location` : options du plugin `locationWhenInUsePermission`, `isIosBackgroundLocationEnabled`, `isAndroidBackgroundLocationEnabled` (les deux derniers à `false`).
- Archivo : le dépôt google/fonts ne publie que la police variable ; l'instance statique est extraite avec `fontTools.varLib.instancer` (`wght=700 wdth=100`).
- pnpm : `react-native-css-interop@0.2.7` (moteur de NativeWind) doit être une dépendance directe, sinon `babel-preset-expo` ne résout pas `react-native-css-interop/jsx-runtime` ; `pnpm dedupe` après installation évite un second `react` / `react-native` (19.3.0 / 0.87.1).
- Types : `expo/types/metro-require.d.ts` rend `process.env.NODE_ENV` obligatoire dans `NodeJS.ProcessEnv` pour tout le programme TypeScript : un `spawnSync(..., { env: { PATH } })` doit fournir `NODE_ENV`.

## expo-location 57.0.21
Source : `node_modules/expo-location/build/Location.d.ts` et `Location.types.d.ts` le 2026-10-13.
- `watchHeadingAsync(callback, errorHandler?)` renvoie `Promise<LocationSubscription>` (`remove()`) ; `LocationHeadingObject.trueHeading` vaut `-1` si le cap vrai est indisponible, `magHeading` est toujours renseigné.
- `PermissionStatus.GRANTED | DENIED | UNDETERMINED` : seul `GRANTED` vaut accordé ; `getCurrentPositionAsync()` renvoie `{ coords: { latitude, longitude, ... }, timestamp }`.

## jest-expo 57.0.6 / @testing-library/react-native 14.1.0
Source : lecture de `node_modules` et exécution de `jest` le 2026-10-13.
- `package.json` est en `"type": "module"` : `jest.config.cjs` (CommonJS). Preset `jest-expo` ; alias `@/` par `moduleNameMapper`.
- Pairs à installer : `jest` ~29.7, `@types/jest`, `test-renderer` (pair de RNTL 14), `@react-native/jest-preset` épinglé à `0.86.3` (`expo install` en propose la 0.87.1, hors SDK).
- RNTL 14 : `render` asynchrone, `toBeOnTheScreen` sans setup. `jest --json --outputFile=$CONTRACT_REPORT` produit le rapport attendu par `scripts/contract-files.mjs`.

## expo-updates 57.0.26 / eas-cli 24.13.0
Source : `npx expo install expo-updates` (version du SDK 57) et registre npm le 2026-10-14 ; Context7 n'a pas de branche `sdk-57`.
- `app.json` : `runtimeVersion: { policy: "appVersion" }`, `updates.url` = `https://u.expo.dev/<projectId>`, `extra.eas.projectId`.
- `eas.json` : le canal se pose par profil de build (`channel`) ; `eas update --skip-bundler` publie `dist/` produit par `expo export`.

## @sentry/react-native 7.11.0 (Expo : sourcemaps et Metro)
Source : lecture de `node_modules/@sentry/react-native` et `expo export` le 2026-10-14.
- Plugin `app.json` : nom `@sentry/react-native/expo` (le script `sentry-expo-upload-sourcemaps` ne reconnaît que celui-là), options `organization` / `project`, jamais `authToken`. `SENTRY_DISABLE_AUTO_UPLOAD=true` coupe l'envoi pendant les builds EAS.
- Metro : `getSentryExpoConfig(__dirname)` depuis `@sentry/react-native/metro` remplace `getDefaultConfig` (Debug ID dans les bundles).
- `expo export` n'écrit les `.map` qu'avec `--source-maps` ; sans eux, `sentry-expo-upload-sourcemaps dist` saute chaque bundle sans échouer. Il lit `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` dans l'environnement. `sentry-cli` : `@sentry/cli` 2.58.4, lancé par `npx --package=@sentry/cli@2.58.4 sentry-cli`.

## react-native-svg 15.15.4
Source : lecture de `node_modules/react-native-svg` et rendu sous `jest-expo` le 2026-10-14.
- `G` prend `transform` en chaîne (`"matrix(-1 0 0 1 300 0)"`) ; `ClipPath` va dans `Defs` et s'applique par `clipPath="url(#id)"` sur un `G`.
- Piège : les `id` de `ClipPath` sont globaux à l'écran, un identifiant par instance (`useId`). Sous Jest, les couleurs sont des entiers ARGB dans `toJSON()`.

## react-native-reanimated 4.5.1 / react-native-worklets 0.10.1
Source : lecture de `node_modules` (`lib/typescript`) et exécution de `jest` le 2026-10-14 ; Context7 `/software-mansion/react-native-reanimated/4.1.5` pour la règle des worklets importés.
- Une fonction importée d'un autre fichier n'est pas transformée seule en worklet : elle porte la directive `'worklet';` (vérifiée à la 4.5.1 : le plugin worklets est inclus dans `babel-preset-expo`, aucune modification de `babel.config.cjs`).
- Pont fil d'interface vers JS : `scheduleOnRN(fn, ...args)` de `react-native-worklets` (`runOnJS` existe encore dans Reanimated mais l'ancien nom).
- Transition CSS : `transitionProperty` (tableau de propriétés) et `transitionDuration` (ms) dans le `style` d'un `Animated.View` ; `toHaveStyle` lit la valeur d'arrivée sous Jest.
- Jest : `jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"))` puis `require("react-native-reanimated").setUpTests()` dans `setupFilesAfterEnv`, sinon le module natif manque (`loadUnpackers`).

## react-native-gesture-handler 2.32
Source : lecture de `node_modules` (`jestSetup.js`, `lib/typescript/jestUtils`) et exécution de `jest` le 2026-10-14.
- Jest : `setupFiles: ["react-native-gesture-handler/jestSetup.js"]` ; `fireGestureHandler(getByGestureTestId(id), [{ state }, { translationX }, { translationX, state }])` de `react-native-gesture-handler/jest-utils`, geste nommé par `.withTestId(id)`.
- `fireGestureHandler` rejoue `onUpdate` / `onEnd`, pas `onTouchesMove` : l'activation manuelle n'est pas couverte. Dans RNTL 14, `fireEvent` et `act` s'attendent (`await`).

## react-native 0.86.3 (`AppState`)
Source : `node_modules/react-native/Libraries/AppState/AppState.d.ts` le 2026-10-14.
- `AppState.addEventListener("change", (state) => ...)` renvoie un objet avec `remove()` ; `AppState.currentState` vaut `active | background | inactive | unknown | extension`.
- Un retour au premier plan = passage de `background` ou `inactive` à `active`.

## react-native 0.86.3
Source : Context7 `/react/react-native-website` (doc 0.87, la plus proche de 0.86.3) le 2026-10-14.
- `FlatList` : `snapToInterval` s'emploie avec `decelerationRate="fast"` ; `FlatList` est un `PureComponent` (re-rendu quand `data` change).

## Hermes (moteur de react-native 0.86.3)
Source : Context7 `/discord/hermes` (`doc/IntlAPIs.md`) le 2026-10-14.
- `Intl.DateTimeFormat` : prend `timeZone` et `hourCycle: "h23"` sur iOS et Android, mais le motif iOS est localisé : assembler `HH:MM` depuis `formatToParts`, jamais depuis `format()` ni `toLocaleString`.
