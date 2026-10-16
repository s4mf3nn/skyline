# ADR-0001 : Stack technique

Date : 2026-10-13
Statut : proposée

## Contexte
Skyline est une application mobile Expo qui dit en une seconde quel avion passe au-dessus de toi et lesquels vont passer ensuite. La v0 se limite à deux écrans (Ciel, Prochains passages), sans backend ni compte : l'application interroge une source ADS-B publique toutes les 10 secondes et calcule tout en premier plan. Le cahier des charges et le handoff de design font foi et sont versionnés dans `docs/brief/` ; les fichiers HTML du handoff sont des références, jamais embarqués dans l'application.

Le dépôt part de zéro : aucun code applicatif n'existe. L'étape « nettoyage » du cahier des charges (écrans hors v0 derrière un flag `FEATURES`) est donc sans objet.

Le projet est développé principalement par des agents en parallèle. Les critères prioritaires sont un typage fort qui attrape les erreurs tôt, des tests rapides et une structure qui minimise les fichiers partagés.

## Décision
Imposé par la factory (chaîne d'outils, déjà en place dans le dépôt) :
- Outillage : Node 22, pnpm, TypeScript strict. Ce n'est **pas** le runtime de l'application, qui est une décision de ce projet (voir le tableau).
- Tests : Vitest, couverture v8 (seuils à 80 %), mutation avec Stryker sur les fichiers modifiés.
- Qualité : Biome (lint et format), Lefthook, commitlint.
- Structure par feature avec montage automatique via un fichier généré (`pnpm gen`).
- Style : Tailwind pour toute application avec interface (NativeWind pour React Native, statut `choisie`) ; sans objet pour une API ou une CLI. Dernière version stable à l'initialisation, vérifiée dans la documentation.
- Observabilité : Sentry pour toute application qui s'exécute chez l'utilisateur ou sur un serveur (API, web, mobile ; CLI si ce tableau le décide), avec le SDK de son runtime ; sans objet pour une bibliothèque. Dernière version stable à l'initialisation, vérifiée dans la documentation. Il passe par le service tiers « suivi des erreurs » (`src/shared/monitoring/`, faux en test) et ne reçoit aucune donnée personnelle.

Technologies du projet. Statuts : `imposée` (exigée par l'utilisateur ; ne change que par une nouvelle ADR), `choisie` (proposée par l'agent et validée), `à décider` (le premier travail qui en a besoin la tranche par ADR).

Les versions des modules natifs sont celles que le SDK Expo 57 embarque (`bundledNativeModules.json` d'`expo@57.0.28`, lu sur le registre npm le 2026-10-13), pas les dernières publiées sur npm : SPEC-0000 les installe avec `npx expo install`, qui garde cet alignement.

| Technologie | Rôle | Statut | Raison | Source de la doc |
|---|---|---|---|---|
| Expo SDK 57 (`expo` 57.0.28), development build | Runtime applicatif et chaîne de build mobile (iOS et Android) | imposée | Cahier des charges, section 13 | Context7 `/expo/expo` (branches jusqu'à `sdk-56` seulement : pas de doc versionnée pour le SDK 57 à ce jour) |
| React Native 0.86.3, React 19.2.3 | Framework d'interface | imposée | Cahier des charges ; versions du SDK 57 | Context7 `/expo/expo` |
| Expo Router `~57.0.26` | Routage par fichiers | choisie | Une seule route en v0, mais les écrans et deep links du MVP s'y grefferont sans migration | Context7 `/expo/expo` |
| Tailwind CSS 3.4 | Style | imposée | Exigence de la factory ; la version 3 est celle que NativeWind 4 stable prend en charge | Context7 `/nativewind/nativewind/nativewind_4.2.0` |
| NativeWind 4.2.7 | Style (Tailwind pour React Native) | choisie | Dernière version stable ; NativeWind 5 (Tailwind 4) est encore en préversion | Context7 `/nativewind/nativewind/nativewind_4.2.0` |
| `react-native-reanimated` 4.5.1 (`react-native-worklets` 0.10.1), `react-native-gesture-handler` `~2.32.0` | Pager horizontal à deux pages, flèche boussole, comptes à rebours | choisie | Seul moyen de reproduire les valeurs du handoff (seuil de 60 pt, résistance ×0,3, 380 ms, verrouillage d'axe à 8 pt) | Context7 `/expo/expo` |
| `react-native-svg` 15.15.4 | Dérive générique et flèche de direction | imposée | Cahier des charges, section 3 | Context7 `/expo/expo` |
| `expo-location` `~57.0.21` | Position (permission « pendant l'utilisation ») et cap du téléphone (`watchHeadingAsync`) | imposée | Cahier des charges, section 4 | Context7 `/expo/expo` |
| `expo-font` `~57.0.4`, police Archivo (licence OFL) | Typographie unique | imposée | Cahier des charges, section 3 | Context7 `/expo/expo` |
| `FlatList` de React Native | Carrousel vertical calé (`snapToInterval`) | imposée | Cahier des charges, section 2 | Context7 `/expo/expo` |
| adsb.lol (licence ODbL) | Source des positions ADS-B | imposée | Cahier des charges, section 9 ; aucune source existante à reprendre | introuvable |
| `airlines-scraper` (dépôt local du propriétaire) | Codes IATA et OACI des compagnies, images de dérive | imposée | Demande du propriétaire ; voir « Images de dérive » dans les Implications | introuvable |
| Source des routes de vol (origine, destination, horaires, progression) | Données affichées sur Ciel et sur les cartes | choisie | Le handoff les affiche, adsb.lol ne fournit que les positions, et le cahier des charges repousse adsbdb au MVP | ADR-0002 (adsbdb.com) pour l'origine et la destination, ADR-0003 (estimation locale) pour les horaires et la progression |
| Sentry (`@sentry/react-native` `~7.11.0`) | Suivi des erreurs | imposée | Exigence de la factory, observabilité | Context7 `/websites/sentry_io_platforms_react-native` |
| Jest via `jest-expo` `~57.0.6`, `@testing-library/react-native` 14.1.0 | Tests de rendu des écrans | choisie | Le rendu React Native ne tourne pas sous Vitest ; le cahier des charges demande Jest et RNTL | Context7 `/expo/expo` |
| Validation des entrées (réponse ADS-B, deep links) : Zod `4.6.5` | Validation à la frontière | choisie | Schémas déclaratifs et types déduits ; `jitless` pour Hermes | ADR-0004, Context7 `/colinhacks/zod/v4.6.5` |
| EAS Build, EAS Update | Livraison | imposée | Cahier des charges, section 13 | Context7 `/expo/expo` |

Type d'application : application mobile (iOS et Android).

Disposition du dépôt : une application.

Persistance et migrations : aucune en v0 (pas de base de données, pas de compte).

Découpage interne d'une feature : `src/features/<feature>/{screens,components,hooks,service}`, point d'entrée `index.ts`. La logique pure (couleurs, directions, extrapolation des passages, comptes à rebours) vit dans `service` ou dans `src/shared/`, sans import de React Native, pour rester testable sous Vitest.

### Implications
- Runtime et conséquences : le code s'exécute sur l'appareil (Hermes), pas sous Node. Aucune API Node dans `src/`. Reanimated 4 exige la nouvelle architecture de React Native. Le development build est obligatoire (modules natifs : Sentry, Reanimated).
- Routage : dossier `app/` d'Expo Router, déclaré dans `package.json` (`factory.routeDirs`, `factory.routeIgnore` pour `_layout.tsx` et `+*`). Les routes sont fines : elles réexportent l'écran de leur feature. La v0 n'a qu'une route, qui monte le pager à deux pages ; le pager lit le registre généré des features, jamais une liste écrite à la main.
- Style : les tokens Tailwind portent les couleurs neutres, la typographie, les rayons et les mesures du handoff. Les couleurs de compagnie sont calculées à l'exécution (`fit()`, `mix()`) et passées en `style` : ce n'est pas une valeur en dur, c'est une donnée. `docs/factory/UI.md` est rempli par SPEC-0000.
- Typographie : React Native ne pilote pas l'axe variable `wdth` d'Archivo. La spec du thème fixe les instances statiques embarquées (variantes condensées les plus proches des largeurs du handoff) et signale les écarts.
- Images de dérive : les images d'`airlines-scraper` viennent d'Inflight Feed. Le propriétaire déclare le 2026-10-13 avoir obtenu l'autorisation de les utiliser (`rights.json` du dépôt `airlines-scraper` à `cleared`), ce qui amende la section 3 du cahier des charges. La spec qui intègre ces images consigne l'autorisation (périmètre : logos, livrées, usage dans une application publiée) et la notice de crédit avant de copier un fichier dans `assets/tails/`. Sans image autorisée pour une compagnie, dérive générique SVG.
- Stratégie de test : Vitest joue la logique pure, avec couverture et mutation. Les tests de rendu portent le suffixe `*.native.test.tsx` et tournent sous Jest (`factory.contractRunners` : `{ "native": "test:native" }`, rapport JSON dans `$CONTRACT_REPORT`) ; Vitest les ignore. SPEC-0000 règle leur typage, et les exclut explicitement des seuils de couverture et de l'étape de mutation. Jest, `jest-expo` et RNTL sont des dépendances justifiées par cette ADR.
- Tests sur cible réelle : simulateur iPhone 15 ou 16 (393 × 852 pt), comparaison manuelle aux captures de `docs/brief/design_handoff_skyline_ciel_passages/screenshots/` à chaque étape, avec compte rendu des écarts. Pas de test automatisé sur simulateur en v0 (un simulateur iOS en CI demande un runner macOS) : Maestro est repoussé au MVP, par une nouvelle ADR.
- Commande `dev` : `expo start --port $PORT` (bundler Metro sur `$PORT`, fourni par Conductor). Un seul serveur.
- Services tiers, chacun derrière une interface avec un faux injecté par les tests :
  - source ADS-B : adsb.lol, `src/shared/adsb/` (interface, type `Aircraft` et faux posés par SPEC-0000 ; client réel posé par la spec qui branche les données) ;
  - position et cap : `expo-location`, `src/shared/location/` ;
  - horloge : `src/shared/clock/` (comptes à rebours, heure de passage) ;
  - suivi des erreurs : Sentry, `src/shared/monitoring/` ;
  - réglages du système (ouvrir ceux de l'application) : `Linking` de React Native, `src/shared/system-settings/` ;
  - source des routes de vol : adsbdb.com, `src/shared/routes/`.
- Tâches planifiées : aucune. Le rafraîchissement toutes les 10 secondes est un minuteur de premier plan, mis en pause en arrière-plan.
- Temps réel : aucun. L'application interroge la source ADS-B à intervalle.
- Files de messages : aucune.
- Ressource de données par workspace : aucune.
- Transactions : sans objet.
- Contraintes portées par la base : sans objet.
- Secrets et variables d'environnement : `EXPO_PUBLIC_SENTRY_DSN` (absent en test et en développement local : le suivi est alors inactif), `SENTRY_AUTH_TOKEN` pour l'envoi des sourcemaps et `EXPO_TOKEN` pour EAS (environnement `production` seulement). Tout ce qui est préfixé `EXPO_PUBLIC_` est livré dans le bundle : aucun secret sous ce préfixe. adsb.lol ne demande pas de clé à ce jour.
- Sentry : `sendDefaultPii` reste à `false` (valeur par défaut du SDK), et un filtre `beforeSend` retire toute coordonnée avant envoi. La position de l'utilisateur n'est jamais transmise au suivi des erreurs ni écrite dans les logs.
- Livraison : `pnpm release` (posé par SPEC-0001) construit le binaire iOS et Android avec EAS Build, le soumet aux pistes de test des stores (TestFlight, test interne de Google Play), puis publie la mise à jour EAS Update. Retour arrière : republication de la mise à jour EAS précédente ; un binaire soumis ne se retire pas, il se corrige par une nouvelle livraison. Fichiers de livraison en zone de risque : `app.json` ou `app.config.*`, `eas.json`.
- Clients installés : l'application est le seul client et n'appelle aucune API du projet en v0. Sans objet jusqu'au backend du MVP, qui fixera la version minimale prise en charge.
- Licences et mentions : attribution ODbL (adsb.lol, OpenFlights pour les codes), licence OFL d'Archivo, mention de non-affiliation aux compagnies, notices des images de dérive. Elles figurent dans l'application.

## Conséquences
- Aucun fichier central n'est édité à la main pour ajouter une feature.
- Deux lanceurs de tests cohabitent : la logique doit rester hors des composants pour être couverte et mutée par Vitest. Un calcul écrit dans un écran échappe aux seuils.
- Les versions natives suivent le SDK Expo : une montée de version passe par `npx expo install` et par une PR dédiée, jamais par un `pnpm add` isolé.
- La doc versionnée du SDK 57 manque dans Context7 : pour une API Expo, l'agent consulte la branche `sdk-56` puis vérifie la forme dans `node_modules`, et le note dans le cache.
- La source des routes de vol n'est pas tranchée : tant qu'elle ne l'est pas, les écrans affichent origine, destination et horaires sur données fictives seulement, avec un repli propre quand ils sont inconnus.
- Les couleurs de compagnie échappent aux tokens Tailwind par nature ; le relecteur accepte un `style` de couleur seulement quand il vient du thème de compagnie.
