# Plan SPEC-0001
Statut : PRÊT
Questions : aucune. `ascAppId`, la clé App Store Connect et le compte de service Google Play sont reportés à la première publication sur les stores (décision de l'humain : test sous Expo Go d'abord, comptes Apple Developer et Google Play pas encore créés) ; ils ne bloquent aucune tâche, voir « Préalables à la publication ».

Préalables de l'humain (valeurs à inscrire dans cette PR de plan avant sa fusion ; aucun agent ne les invente) :
- **Identifiants de l'application** : `ios.bundleIdentifier` = `com.samfenn.skyline`, `android.package` = `com.samfenn.skyline` (SPEC-0000 les a laissés à cette spec).
- **Projet EAS** : `extra.eas.projectId` = `47fe4ec7-fa70-4a37-943a-8cdddb7a0c61`, `owner` = `samfenn` (sortie de `eas init` sur le compte du propriétaire).
- **Projet Sentry** : organisation `samfenn`, projet `skyline`, DSN `https://52bb9ffee00077edf99374e5d56e93df@o4510499886071808.ingest.de.sentry.io/4512254100832336` (non secrets).
- **Environnement GitHub `production`** (créé, secrets et variables enregistrés, variable EAS créée) : secrets `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN` ; variables non secrètes `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`. **Variable d'environnement EAS** `EXPO_PUBLIC_SENTRY_DSN` (profils `preview` et `production`, visibilité « plain text ») pour le bundle embarqué du binaire construit chez EAS.

Préalables à la publication (reportés, à fournir par l'humain avant le premier `pnpm release` en profil `production`, jamais inventés par un agent) :
- **Identifiants de soumission** : clé App Store Connect et compte de service Google Play rangés dans EAS par `eas credentials`, `ascAppId` = `<à fournir>`. Tant que `ascAppId` manque, le profil `production` ne peut pas soumettre ; le profil `preview` et les tests sous Expo Go n'en dépendent pas.

Constats partagés par les tâches :
- **Point d'entrée de `src/shared/monitoring/`** (figé par SPEC-0000) : `index.ts` n'exporte que l'interface, les types, le faux et les fonctions pures ; le contrat Vitest le charge par chemin, il n'importe aucun module natif. L'implémentation Sentry vit dans `sentry.ts`, importée par `src/main.tsx` seulement.
- **Interfaces figées** : `createApp(options)` avec `build?: BuildInfo`, `scrubContext`, `scrubMessage` (noms et signatures du « Contrat d'interface » de la spec). `BuildInfo` = `{ release: string; environment: string }` et `DEFAULT_BUILD`, exportés par `src/shared/monitoring/index.ts`.
- **Conflit possible sur `src/app.tsx` avec SPEC-0003** (le pager remplace `pickScreen` par `selectPages`) : les deux specs modifient la même fabrique. Le garde d'erreur s'applique à chaque écran *avant* la sélection (`guardFeatures`, `guardScreen`), pour que le pager n'ait rien à savoir du suivi des erreurs et que le conflit se limite à la ligne de sélection. La spec qui fusionne la seconde rebase et garde ce principe ; un conflit survenu est consigné dans `docs/factory/HOTSPOTS.md` par `/resolve`.
- **Ordre de `pnpm release`** (CA6 : aucune sourcemap servie) : `eas build`, puis `npx expo export` dans `dist/`, envoi des sourcemaps à Sentry, suppression des `.map` de `dist/`, et seulement ensuite `eas update --skip-bundler` (qui publie `dist/` tel quel). T2 pose `export` puis `update --skip-bundler` ; T3 insère l'envoi et la suppression entre les deux.
- **Variables de l'export et de la mise à jour** : ces étapes tournent sur le runner GitHub, pas chez EAS. `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` viennent des variables de l'environnement `production` (exposées par `release.yml`), `RELEASE_PROFILE` de l'input du workflow, `GITHUB_SHA` du runner. `eas.json` ne porte aucune de ces valeurs.
- **Dépendances** : `npx expo install` pour les modules du SDK (`@sentry/react-native` ~7.11.0, `expo-updates`), versions du tableau de l'ADR-0001 ; justification « ADR-0001 » dans le résumé de PR. Context7 n'a la doc Expo que jusqu'à `sdk-56` : forme à confirmer dans `node_modules`, puis à noter dans `docs/factory/libs-cache.md`.
- **Contrat** : les deux fichiers de contrat (`SPEC-0001.test.ts`, `SPEC-0001.native.test.tsx`) gardent leur `describe.skip` jusqu'à T4. Une tâche peut retirer le `.skip` en local pour vérifier une tranche, sans le commiter.
- **CA3 et CA7** sont sans objet : aucune tâche n'ajoute de script `test:e2e` ni n'active le job `e2e` de `ci.yml`.

## Groupe 1 (parallèle)
### T1 : Écran d'erreur, garde des écrans et filtre des données personnelles
- Périmètre : src/app.tsx, src/app.native.test.tsx, src/ErrorScreen.tsx, src/ScreenGuard.tsx, src/ScreenGuard.native.test.tsx, src/shared/monitoring/index.ts, src/shared/monitoring/scrub.ts, src/shared/monitoring/scrub.test.ts, tsconfig.test.json
- Dépend de : aucune
- Risque : élevé (`src/shared/monitoring/` est en zone sensible : le filtre est la seule barrière entre une coordonnée et un tiers)
- Critères de la spec couverts : CA4, CA5
- Définition de fini : `pnpm verify` vert ; `scrub.test.ts` couvre les cas limites de la spec (message sans coordonnée, clé inconnue, valeur non `Error` levée) et montre que `toReport` garde la pile, passée par `scrubMessage` (une coordonnée dans la pile ressort `[redacted]`) ; `ScreenGuard.native.test.tsx` montre que l'écran d'accueil de repli est gardé (feature `home`) ; les deux fichiers de contrat passent en local une fois le `.skip` retiré (non commité) ; l'exclusion ciblée de `SPEC-0001.native.test.tsx` est retirée de `tsconfig.test.json` (et son commentaire) et `pnpm typecheck` reste vert. Les interfaces figées ci-dessus s'appliquent.
- Conception :
  ```diff
   src
  ~├── app.tsx                    # MODIFIÉ : option build, guardFeatures + guardScreen avant pickScreen
  +├── ErrorScreen.tsx            # NOUVEAU : fond ground, « Une erreur est survenue. » en ink, Archivo
  +├── ScreenGuard.tsx            # NOUVEAU : guardScreen (enveloppe fonctionnelle qui lit useServices)
  +│                              #   et ErrorBoundary (classe, reporter, feature, build en props)
  +├── ScreenGuard.native.test.tsx
  ~├── app.native.test.tsx        # MODIFIÉ : écran fautif remplacé, rien de transmis sans erreur
   └── shared/monitoring
  ~    ├── index.ts               # MODIFIÉ : réexporte BuildInfo, DEFAULT_BUILD, scrubContext, scrubMessage, toReport
  +    ├── scrub.ts               # NOUVEAU : filtre pur, sans React ni Sentry
  +    └── scrub.test.ts
  ~tsconfig.test.json             # MODIFIÉ : retrait de l'exclusion ciblée de SPEC-0001.native.test.tsx
  ```
  ```ts
  // src/shared/monitoring/scrub.ts
  export interface BuildInfo { release: string; environment: string }
  export const DEFAULT_BUILD: BuildInfo;                       // { release: "dev", environment: "development" }
  scrubContext(context: Record<string, string>): Record<string, string>
  scrubMessage(message: string): string                        // /-?\d+\.\d{3,}/g -> "[redacted]"
  toReport(thrown: unknown, build: BuildInfo, feature: string): { error: Error; context: Record<string, string> }
    // error : même name ; message et stack passés par scrubMessage ; valeur non Error : Error(String(thrown))
  // src/ScreenGuard.tsx
  guardScreen(screen: ComponentType, feature: string, build: BuildInfo): ComponentType
  guardFeatures(features: readonly Feature[], build: BuildInfo): Feature[]   // guardScreen(f.screen, f.name, build)
  ```
  ```diff
   createApp({ services, features, build })
  -  pickScreen(features ?? registry, HomeScreen)
  +  b = build ?? DEFAULT_BUILD
  +  pickScreen(guardFeatures(features ?? registry, b), guardScreen(HomeScreen, "home", b))
  +    GuardedScreen()                              # fonction : reporter = useServices().monitoring
  +      <ErrorBoundary reporter feature build>     # classe : aucun hook, tout en props
  +        componentDidCatch(thrown)
  +          { error, context } = toReport(thrown, build, feature)
  +          reporter.report(error, context)
  +        render : state.failed ? <ErrorScreen /> : <Screen />
  ```
  Ordre de construction :
  1. `ScreenGuard` + `ErrorScreen` branchés dans `createApp`, rapport brut sans filtre ; vérifiée par le test CA4 « shows the error screen » du contrat de rendu (`.skip` retiré en local).
  2. `scrub.ts` (`scrubContext`, `scrubMessage`, `toReport` avec la pile filtrée, `DEFAULT_BUILD`) et réexport par `index.ts` ; vérifiée par `scrub.test.ts` et le contrat Vitest en local.
  3. Option `build` et contexte `{ release, environment, feature }` filtré ; vérifiée par les tests CA4 « reports … once » et CA5 « carries no coordinate » du contrat de rendu, puis `tsconfig.test.json` et `pnpm verify`.
  Scénarios de changement :
  - Le pager de SPEC-0003 monte deux écrans : aucun changement ici, chaque feature arrive déjà gardée (`guardFeatures`) ; seul `src/app.tsx` change de sélection.
  - Une nouvelle clé de contexte autorisée (`screen` renseigné par l'écran, version de l'appareil) : `scrub.ts` (liste des clés) et `scrub.test.ts`.
  - Un autre motif de donnée personnelle à masquer (indicatif, adresse) : `scrub.ts` et son test seulement ; le filtre `beforeSend` de T3 le reprend sans modification.

### T2 : Configuration EAS et script de livraison (build, soumission, mise à jour)
- Périmètre : eas.json, app.json, package.json, pnpm-lock.yaml, scripts/release.mjs, tests/unit/release.test.ts, tests/unit/expo-config.test.ts, .github/workflows/release.yml, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : élevé (`app.json`, `eas.json` et le workflow `release` sont en zone sensible : identifiants, canal de mise à jour, secrets de livraison)
- Critères de la spec couverts : CA1
- Définition de fini : `pnpm verify` vert ; `tests/unit/release.test.ts` vérifie la suite de commandes des profils `production` (build `--auto-submit`, update canal `production`) et `preview` (build sans soumission, update canal `preview`), l'ordre `expo export` avant `eas update --skip-bundler` (ordre ci-dessus), et qu'aucun secret n'apparaît en argument ; `tests/unit/expo-config.test.ts` remplace « declares no application identifier » par les identifiants des préalables ci-dessus et garde les contrôles de permission ; `eas config --profile production` et `--profile preview` (lecture seule) acceptent la configuration ; `release.yml` expose `EXPO_TOKEN` et `SENTRY_AUTH_TOKEN` (secrets) une ligne chacune, puis `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` (`vars.*`) et `RELEASE_PROFILE` (input) ; nouvelles dépendances citées dans le résumé de PR, justification « ADR-0001 » : `expo-updates` (version du SDK 57, `npx expo install`) et `eas-cli` épinglé à une version exacte en devDependency ; `git grep -n EXPO_PUBLIC_` ne montre aucun secret.
- Conception :
  ```diff
   .
  +├── eas.json                   # NOUVEAU : build preview / production (channel), submit production (ascAppId, piste internal)
  ~├── app.json                   # MODIFIÉ : bundleIdentifier, package, runtimeVersion { policy: "appVersion" }, updates.url, extra.eas.projectId
  ~├── package.json               # MODIFIÉ : expo-updates (expo install), eas-cli épinglé en devDependency, script release
  +├── scripts/release.mjs        # NOUVEAU : suite de commandes selon RELEASE_PROFILE, exécutée pas à pas, arrêt au premier échec
  +├── tests/unit/release.test.ts
  ~├── tests/unit/expo-config.test.ts  # MODIFIÉ : identifiants attendus, canal par profil
  ~└── .github/workflows/release.yml   # MODIFIÉ : input profile ; env EXPO_TOKEN, SENTRY_AUTH_TOKEN, DSN, SENTRY_ORG/PROJECT
  ```
  ```ts
  // scripts/release.mjs (exports testés, exécution si lancé directement)
  type Profile = "preview" | "production";
  readProfile(env: NodeJS.ProcessEnv): Profile            // RELEASE_PROFILE absent : "production" ; autre valeur : refus
  releaseSteps(profile: Profile, sha: string): { cmd: string; args: string[] }[]
  ```
  ```diff
   workflow release (main, gates vert, approbation production)
  +  pnpm release                                  # env du runner : secrets, vars, RELEASE_PROFILE, GITHUB_SHA
  +    eas build --platform all --profile <p> --non-interactive [--auto-submit si production]
  +    npx expo export --platform all --output-dir dist   # bundle sur le runner, DSN du runner inliné
  +    (envoi des sourcemaps puis suppression des .map : insérés ici par T3)
  +    eas update --channel <p> --message <sha> --skip-bundler --non-interactive   # publie dist/ tel quel
  ```
  Ordre de construction :
  1. `scripts/release.mjs` avec `releaseSteps` et le script `release` ; vérifiée par `release.test.ts` (commandes attendues pour les deux profils, `export` avant `update --skip-bundler`, refus d'un profil inconnu, aucun jeton dans `args`).
  2. `eas.json`, `expo-updates`, identifiants et `updates` dans `app.json` ; vérifiée par `tests/unit/expo-config.test.ts` et `eas config` pour chaque profil.
  3. `release.yml` (input `profile`, secrets et variables de l'environnement `production`) ; vérifiée par relecture et par `actionlint` s'il est installé. Le premier run réel (`preview`) a lieu après la fusion de T3, preuve portée par T4.
  Scénarios de changement :
  - Mise en vente sur les stores (hors périmètre) : `eas.json` (piste `production` de Google Play, soumission à la revue) et `releaseSteps` ; le workflow ne change pas.
  - Un troisième canal (`staging`) : `eas.json`, `Profile` et `readProfile` dans `scripts/release.mjs`, l'input du workflow.
  - Changement de politique de version native (`fingerprint` au lieu d'`appVersion`) : `app.json` seul.

## Groupe 2 (après fusion du groupe 1)
### T3 : Suivi des erreurs Sentry, version livrée et sourcemaps
- Périmètre : src/shared/monitoring/sentry.ts, src/shared/monitoring/sentry.test.ts, src/shared/monitoring/event.ts, src/shared/monitoring/event.test.ts, src/shared/monitoring/build.ts, src/shared/monitoring/build.test.ts, src/shared/monitoring/noop.ts, src/main.tsx, app.config.ts, tests/unit/app-config.test.ts, app.json, eas.json, metro.config.cjs, package.json, pnpm-lock.yaml, scripts/release.mjs, tests/unit/release.test.ts, .env.example, docs/factory/libs-cache.md
- Dépend de : T1, T2
- Risque : élevé (zones sensibles `src/shared/monitoring/`, `app.json`, `app.config.*`, `eas.json` : envoi à un tiers, sourcemaps)
- Critères de la spec couverts : CA4, CA5, CA6
- Définition de fini : `pnpm verify` vert ; `event.test.ts` montre qu'un événement Sentry portant une coordonnée dans le message, l'exception, les tags, `extra`, `user` ou les breadcrumbs ressort sans elle ; `sentry.test.ts` (avec `vi.mock("@sentry/react-native")`) montre que sans DSN `init` n'est pas appelé et `report` ne fait rien, et qu'avec DSN `init` reçoit `sendDefaultPii: false`, `release`, `environment` et `beforeSend` ; `build.test.ts` couvre `extra` absent ou invalide (défaut de T1) ; `tests/unit/app-config.test.ts` montre que `extra.build` vaut `{ release: GITHUB_SHA, environment: RELEASE_PROFILE }` sur le runner, `{ release: EAS_BUILD_GIT_COMMIT_HASH, environment: EAS_BUILD_PROFILE }` chez EAS et `DEFAULT_BUILD` sans ces variables, sans perdre les clés d'`app.json` ; `release.test.ts` montre l'ordre `export`, `sentry-cli releases new <sha>`, envoi des sourcemaps, suppression des `.map`, `eas update --skip-bundler`, `releases finalize`, et qu'aucune commande ne reçoit `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` ou `SENTRY_PROJECT` en argument (lus dans l'environnement du runner) ; `npx expo export` produit des bundles avec Debug ID. Le point d'entrée ci-dessus reste sans import natif.
- Conception :
  ```diff
   src/shared/monitoring
  +├── sentry.ts          # NOUVEAU : createSentryErrorReporter, inactive sans DSN (repli sur noop)
  +├── event.ts           # NOUVEAU : scrubEvent, pur, type structurel local (sans import Sentry)
  +├── build.ts           # NOUVEAU : readBuildInfo, validation de expoConfig.extra.build à la frontière
  ~└── noop.ts            # MODIFIÉ : commentaire (plus provisoire : repli sans DSN)
  ~src/main.tsx           # MODIFIÉ : build lu par readBuildInfo, reporter Sentry, build passé à createApp
  +app.config.ts          # NOUVEAU : étend app.json, extra.build = buildExtra(process.env)
  +tests/unit/app-config.test.ts  # NOUVEAU : sources de release et environment
  ~app.json               # MODIFIÉ : plugin @sentry/react-native/expo (organisation, projet, sans jeton)
  ~eas.json               # MODIFIÉ : SENTRY_DISABLE_AUTO_UPLOAD=true par profil (DSN : variable EAS, pas ici)
  ~metro.config.cjs       # MODIFIÉ : getSentryExpoConfig sous withNativeWind (Debug ID)
  ~scripts/release.mjs    # MODIFIÉ : sourcemaps entre export et update (ordre ci-dessus)
  ```
  ```ts
  createSentryErrorReporter(options: { dsn: string | undefined } & BuildInfo): ErrorReporter
  scrubEvent<E extends ScrubbableEvent>(event: E): E     // beforeSend : message, exception.values[].value, tags, extra, user, breadcrumbs
  readBuildInfo(extra: unknown): BuildInfo               // invalide ou absent : DEFAULT_BUILD
  // app.config.ts (exportée pour le test)
  buildExtra(env: NodeJS.ProcessEnv): BuildInfo
    // release : GITHUB_SHA ?? EAS_BUILD_GIT_COMMIT_HASH ?? "dev"
    // environment : RELEASE_PROFILE ?? EAS_BUILD_PROFILE ?? "development"
  ```
  ```diff
   src/main.tsx
  +  build = readBuildInfo(Constants.expoConfig?.extra)
  +  createApp({ services: { ..., monitoring: createSentryErrorReporter({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, ...build }) }, build })
  +    Sentry.init({ dsn, release, environment, sendDefaultPii: false, beforeSend: scrubEvent })
  +    report(error, context) -> Sentry.captureException(error, { tags: scrubContext(context) })
   pnpm release
     eas build ... ; npx expo export --platform all --output-dir dist
  +  sentry-cli releases new <sha>             # SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT : env du runner
  +  npx --package=@sentry/react-native sentry-expo-upload-sourcemaps dist
  +  suppression de dist/**/*.map
     eas update --channel <p> --message <sha> --skip-bundler
  +  sentry-cli releases finalize <sha>
  ```
  Ordre de construction :
  1. `createSentryErrorReporter` branché dans `main.tsx` avec `build` par défaut, sans DSN ; vérifiée par `sentry.test.ts` et `PORT=<port> pnpm dev` (aucune requête vers Sentry, écran d'accueil inchangé).
  2. `scrubEvent` en `beforeSend` et `readBuildInfo` alimenté par `app.config.ts` (`buildExtra`) ; vérifiée par `event.test.ts`, `build.test.ts`, `tests/unit/app-config.test.ts` et `RELEASE_PROFILE=preview GITHUB_SHA=abc npx expo config --type public` (`extra.build` attendu, aucun secret).
  3. Debug ID dans Metro, plugin Sentry, étapes sourcemaps de `release.mjs` avant `eas update --skip-bundler` ; vérifiée par `release.test.ts` et `npx expo export` (Debug ID dans les bundles, `.map` absents de `dist/` après la suppression).
  Scénarios de changement :
  - Remplacement de Sentry par un autre service : `sentry.ts`, `main.tsx`, plugin de `app.json` et étape sourcemaps ; le filtre (`scrub.ts`, `event.ts`) et les écrans ne changent pas.
  - Activation du suivi des performances (hors périmètre) : options de `Sentry.init` dans `sentry.ts` et filtre des transactions dans `event.ts`.
  - Nouveau champ d'événement porteur de données (contexte d'appareil) : `event.ts` et son test seulement.

## Groupe 3 (après fusion du groupe 2)
### T4 : Première livraison preview, retour arrière et activation du contrat
- Périmètre : docs/factory/WORKFLOW.md, tests/acceptance/SPEC-0001.test.ts, tests/acceptance/SPEC-0001.native.test.tsx
- Dépend de : T1, T2, T3
- Risque : faible (documentation et retrait des `.skip` ; la livraison elle-même est lancée par l'humain)
- Critères de la spec couverts : CA1, CA2, CA4, CA5, CA6
- Définition de fini : `pnpm verify` vert avec le `describe.skip` retiré des deux fichiers de contrat (`SPEC-0001.test.ts` et `SPEC-0001.native.test.tsx`), ce qui active les scénarios cachés en CI ; `docs/factory/WORKFLOW.md` décrit la livraison (`profile` preview puis production) et le retour arrière (`eas update:republish` de la mise à jour précédente du canal, binaire corrigé par une nouvelle livraison, migrations sans objet) ; la PR cite le run `release` en `preview` lancé par l'humain sur `main` après la fusion de T3 (build, mise à jour, release Sentry au SHA avec sourcemaps), la répétition du retour arrière sur le canal `preview`, et la capture de l'écran d'accueil sur iPhone.
- Notes : l'agent ne lance ni le workflow ni `eas update:republish` ; il prépare les commandes exactes dans la PR et attend les liens de l'humain.
