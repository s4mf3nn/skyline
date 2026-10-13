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
