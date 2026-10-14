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
