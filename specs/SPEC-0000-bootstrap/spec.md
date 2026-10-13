# SPEC-0000 : Bootstrap du projet

Statut : VALIDÉE
Risque estimé : élevé (fonde toutes les conventions)
Dépend de : aucune
Tests de contrat : `tests/acceptance/SPEC-0000.test.ts` (Vitest), `tests/acceptance/SPEC-0000.native.test.tsx` (Jest)

## Objectif
Poser le socle technique décrit dans `docs/adr/0001-stack.md` pour que toutes les specs suivantes puissent être implémentées en parallèle sans toucher de fichier commun. Après cette spec, l'application Expo démarre sur simulateur, affiche un écran d'accueil neutre, et une feature ajoutée dans `src/features/` est montée sans autre modification.

## Acteurs et rôles
Aucun rôle.

## Critères d'acceptation
- **CA1** : sans aucune feature montée, l'application rend un écran d'accueil neutre qui porte le titre « Skyline ».
- **CA2** : `pnpm verify` passe sur un repo propre, tests de rendu Jest compris.
- **CA3** : une feature ajoutée dans `src/features/<nom>/index.ts` (ou `index.tsx`) est listée dans `src/features.gen.ts` après `pnpm gen`, sans modifier aucun autre fichier ; l'application monte l'écran d'une feature du registre qu'elle reçoit, à la place de l'écran d'accueil.
- **CA4** : `pnpm dev` lance le bundler Expo sur `$PORT`, sans port en dur.
- **CA5** : l'horloge, la localisation, la source ADS-B et le suivi des erreurs ont chacun une interface et un faux dans `src/shared/` ; la fabrique de l'application les reçoit et les met à disposition des écrans, ce qu'un test de contrat montre en passant les faux.

## Cas limites
- Registre de features vide : écran d'accueil (CA1).
- Localisation refusée : le faux rejette la demande de position avec l'erreur typée `LOCATION_DENIED`.
- Désabonnement du cap : après appel de la fonction renvoyée par `watchHeading`, plus aucune valeur n'est reçue.
- Source ADS-B indisponible : le faux rejette la requête avec l'erreur typée `ADSB_UNAVAILABLE`.
- Avion dont l'indicatif, l'altitude, la vitesse sol ou le cap manquent : le champ vaut `null`, l'avion reste dans la liste.

## Contrat d'interface
Point d'entrée testable sans simulateur : la fabrique `createApp` de `src/app.tsx`.

```ts
// src/app.tsx
createApp(options: { services: AppServices; features?: readonly Feature[] }): ComponentType
// `features` vaut par défaut le registre généré (`src/features.gen.ts`).

interface AppServices { clock: Clock; location: LocationService; adsb: AdsbSource; monitoring: ErrorReporter }
interface Feature { name: string; order: number; screen: ComponentType }

// src/shared/services
useServices(): AppServices   // lu par les écrans ; aucun écran n'importe une implémentation réelle

// src/shared/clock
interface Clock { now(): number }                      // millisecondes depuis l'époque Unix
createFakeClock(startMs: number): Clock & { advance(ms: number): void }

// src/shared/location
type LocationPermission = "granted" | "denied"
interface Position { latitude: number; longitude: number }
interface LocationService {
  requestPermission(): Promise<LocationPermission>
  getPosition(): Promise<Position>                     // rejette avec `LOCATION_DENIED` si la permission est refusée
  watchHeading(onHeading: (degrees: number) => void): () => void   // renvoie la fonction de désabonnement
}
createFakeLocation(options: { permission: LocationPermission; position: Position }): LocationService & { setHeading(degrees: number): void }

// src/shared/adsb
interface Aircraft {
  hex: string                      // identifiant OACI 24 bits de l'appareil, en hexadécimal minuscule
  callsign: string | null          // indicatif, sans espace de fin
  latitude: number
  longitude: number
  altitudeM: number | null         // mètres
  groundSpeedKmh: number | null    // vitesse sol, km/h
  trackDeg: number | null          // cap suivi, degrés de 0 à 360, 0 au nord
}
interface AdsbQuery { latitude: number; longitude: number; radiusKm: number }
interface AdsbSource { fetchAircraft(query: AdsbQuery): Promise<Aircraft[]> }   // rejette avec `ADSB_UNAVAILABLE`
createFakeAdsbSource(aircraft: Aircraft[]): AdsbSource & {
  queries: AdsbQuery[]                          // requêtes reçues, dans l'ordre
  setAircraft(aircraft: Aircraft[]): void
  setUnavailable(unavailable: boolean): void
}

// src/shared/monitoring
interface ErrorReporter { report(error: unknown, context?: Record<string, string>): void }
createFakeErrorReporter(): ErrorReporter & { events: { error: unknown; context: Record<string, string> }[] }
```

- Une feature exporte `feature: Feature` depuis son `index.ts`. `order` classe les écrans ; l'affichage de plusieurs features à la fois (pager) est fixé par la spec de navigation, pas par celle-ci.
- La route `app/index.tsx` d'Expo Router réexporte le composant construit par `createApp` avec les implémentations réelles ; `app/_layout.tsx` ne contient aucune liste d'écrans écrite à la main.
- Erreurs métier typées dans `src/shared/errors.ts` : une erreur porte un `code` en anglais (`LOCATION_DENIED`, `ADSB_UNAVAILABLE`) et un `message`.
- Les implémentations réelles posées ici : horloge système et `expo-location`. L'implémentation Sentry du suivi des erreurs est posée par SPEC-0001 ; d'ici là, l'implémentation réelle ne transmet rien.
- Source ADS-B : cette spec pose l'interface, le type `Aircraft` (unités métriques) et le faux. Le client adsb.lol, la conversion de ses unités et la validation de sa réponse sont posés par la spec qui branche les vraies données ; d'ici là, l'implémentation réelle renvoie une liste vide. Un champ s'ajoute à `Aircraft` par une spec ultérieure, sans retirer ceux-ci.
- La source des routes de vol n'a ni interface ni faux ici : elle reste `à décider` dans l'ADR-0001.

## Écrans
- **Accueil** : pas de maquette (écran provisoire, remplacé par la spec de navigation). Fond neutre `#0C0C0C`, titre « Skyline » en encre crème `#F4F1EA`, police Archivo. Aucun état de chargement, d'erreur ni d'action.

## Liste de contrôle du socle
- [ ] Disposition du dépôt : une application, un registre généré (`src/features.gen.ts`)
- [ ] Projet Expo SDK 57 : `app.json` ou `app.config.ts`, `babel.config.js`, `metro.config.js`, dossier `app/`, dépendances installées par `npx expo install` aux versions de l'ADR-0001
- [ ] `tsconfig.json` et `tsconfig.test.json` (`jsx`, `lib`, `types`, alias `@/`), typage des fichiers `*.native.test.tsx`
- [ ] Vitest pour la logique ; Jest (`jest-expo`, RNTL) pour le rendu : `factory.contractRunners` (`native` vers `test:native`), exclusion explicite du rendu des seuils de couverture et de l'étape de mutation de la CI, retrait de l'exclusion provisoire `*.native.test.*` de `vitest.config.ts` et de `tsconfig.test.json`, sauf `SPEC-0001.native.test.tsx`, qui reste exclu du typage jusqu'à SPEC-0001 (il utilise l'option `build` de `createApp`, ajoutée par cette spec)
- [ ] Isolation des tests sur la ressource de données : sans objet (aucune ressource)
- [ ] `scripts/workspace-data.sh`, `db:migrate` : sans objet
- [ ] Interfaces et faux de l'horloge, de la localisation, de la source ADS-B et du suivi des erreurs (CA5)
- [ ] NativeWind 4 et Tailwind 3 : `tailwind.config.js`, `global.css`, tokens de style ; `docs/factory/UI.md` rempli ; police Archivo chargée par `expo-font`
- [ ] Routage par fichiers : `factory.routeDirs` (`app`) et `factory.routeIgnore` (`_layout.tsx`, `+*`) dans `package.json`
- [ ] Dossier de routes et fichiers de livraison dans `.github/labeler.yml`, `RISK.md`, `CODEOWNERS` : déjà posés à l'initialisation, à contrôler avec `node scripts/pre-review.mjs zones`
- [ ] `.env.example` avec des clés factices (`EXPO_PUBLIC_SENTRY_DSN`)
- [ ] Script `dev` (CA4) ; permission de localisation « pendant l'utilisation » seulement dans la configuration Expo, avec son texte

## Parcours sur cible réelle
- L'application démarre sur simulateur iPhone 15 ou 16 et affiche l'écran d'accueil. Vérifié à la main dans la PR de la dernière tâche (capture jointe) : pas de test automatisé sur simulateur en v0.

## Hors périmètre
Toute fonctionnalité métier, dont le pager à deux pages, le thème des compagnies et les écrans Ciel et Prochains passages. La livraison, Sentry et les tests sur cible réelle : SPEC-0001.

## Contraintes
Cette spec est exécutée **seule**, avant toute autre, **une tâche à la fois** : son plan a une tâche par groupe, chacune implémentée par un agent neuf après fusion de la précédente (`node scripts/plan-gate.mjs lint` et `check` le contrôlent).

Elle remplit `docs/factory/UI.md` et pose les tokens de style qu'il cite. Aucune dépendance hors du tableau de l'ADR-0001. Les fichiers de `docs/brief/` ne sont ni importés ni embarqués.

## Questions ouvertes
Aucune.
