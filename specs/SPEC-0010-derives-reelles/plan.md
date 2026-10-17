# Plan SPEC-0010
Statut : PRÊT
Questions : aucune

Constats partagés :
- **Amendement de SPEC-0006** : la contradiction entre SPEC-0006 CA12 (`AFR1506` attend `passage-tail-a1`) et SPEC-0010 CA6/CA7 est levée par l'amendement de SPEC-0006 CA12 (`CTV1506`, compagnie sans livrée), PR `contract-change` à fusionner avant T3.
- **Préalables** : dépendances livrées (`plan-gate deps` OK) ; aucune mention légale dans l'app à ce jour : T2 n'est fusionnée qu'une fois les mentions du propriétaire présentes (critère de sortie, case cochée par le propriétaire).
- **Interface figée** : « Contrat d'interface » de la spec ; `index.ts` ne charge jamais `livery.tsx` ni `liveries.gen.ts` (require d'images, illisibles sous Vitest).
- **Fichiers générés** (`*.gen.ts`, ignorés par git, produits par `pnpm gen` avant typage, tests et `dev`) : `src/shared/airlines/livery-codes.gen.ts` (`LIVERY_CODES`, pur) et `src/shared/airlines/liveries.gen.ts` (`LIVERY_SOURCES`, un `require()` littéral par fichier, exigé par Metro).
- **Contrats** : `describe.skip` des deux fichiers SPEC-0010 gardés jusqu'à T3 (retrait local sans commit permis).
- **Bibliothèques** : React Native 0.86.3 `Image` (Context7 `/react/react-native-website` : chemin de `require` statique, source `number`) ; jest-expo 57.0.6 (lecture de `node_modules/jest-expo/jest-preset.js` : toute image vaut `module.exports = 1` sous Jest, donc CA5 « sources distinctes » échoue sans réglage ; le `transform` du projet passe avant celui du preset, `jest-config` `mergeOptionWithPreset`).

## Groupe 1 (parallèle)
### T1 : Générateur des livrées, partie pure et composant
- Périmètre : scripts/gen-liveries.mjs, tests/unit/gen-liveries.test.ts, package.json, jest.config.cjs, src/shared/airlines/index.ts, src/shared/airlines/livery-rules.ts, src/shared/airlines/livery-rules.test.ts, src/shared/airlines/livery.tsx, src/shared/airlines/livery.native.test.tsx, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : élevé (outillage `scripts/` en revue humaine, interface partagée consommée par T3)
- Critères de la spec couverts : CA1, CA2, CA4, CA5
- Définition de fini : `pnpm verify` vert ; `pnpm gen` sans `assets/tails/` produit des tables vides ; `gen-liveries.test.ts` couvre dossier absent, tri, `png`/`webp`, refus d'un nom hors `^[A-Z0-9]{3}\.(png|webp)$` ou d'un sous-dossier ; CA2 et CA4 verts en local ; entrée jest-expo au cache. Interface figée ci-dessus.
- Conception :
  ```diff
  +scripts/gen-liveries.mjs                 # assets/tails/ → deux *.gen.ts (motif de gen-features.mjs)
  ~package.json                             # gen : gen-features puis gen-liveries
  ~jest.config.cjs                          # \.(png|webp)$ → @react-native/jest-preset/jest/assetFileTransformer ({ testUri })
   src/shared/airlines
  +├── livery-rules.ts                      # hasLivery, LIVERY_CREDIT, ré-export LIVERY_CODES
  ~├── index.ts                             # ré-exporte livery-rules.ts
  +└── livery.tsx                           # getLiverySource, AirlineLivery
  ```
  ```ts
  // livery-codes.gen.ts / liveries.gen.ts (générés)
  export const LIVERY_CODES: readonly string[]
  export const LIVERY_SOURCES: Readonly<Record<string, ImageSourcePropType>>
  hasLivery(airline: Airline): boolean                       // LIVERY_CODES.includes(airline.code)
  getLiverySource(airline: Airline): ImageSourcePropType | null  // hasLivery ? LIVERY_SOURCES[code] : null
  AirlineLivery(props: { airline: Airline; width: number; height: number; testID: string }): ReactElement | null
  ```
  ```diff
   AirlineLivery
  +  getLiverySource(airline) ?? return null
  +  <Image source testID accessibilityLabel={`Livrée ${airline.name}`} resizeMode="contain" style={{ width, height }} />
  ```
  Ordre de construction :
  1. `gen-liveries.mjs` sur un dossier de test, puis `pnpm gen` sur le dépôt ; vérifié par `gen-liveries.test.ts`.
  2. `hasLivery`, `LIVERY_CREDIT`, ré-exports (CA2, CA4) ; contrat Vitest en local, `livery-rules.test.ts`.
  3. `livery.tsx` et transformateur Jest (CA5) ; `livery.native.test.tsx` avec `jest.mock` de `liveries.gen`.
  Scénarios de changement :
  - Autorisation retirée pour une compagnie : fichier supprimé et instantané amendé, aucun code touché.
  - Logos (hors périmètre) : `gen-liveries.mjs` et un second fichier généré ; accepté (règle unique : un dossier → une table).
  - Images par résolution (`@2x`, hors périmètre) : `gen-liveries.mjs` seul (Metro résout les suffixes).

### T2 : Copie des 137 livrées autorisées
- Périmètre : assets/tails/
- Dépend de : aucune
- Risque : élevé (zone sensible `assets/tails/`, images de tiers, 8,2 Mo au bundle, fusion soumise au critère de sortie)
- Critères de la spec couverts : CA1, CA3
- Définition de fini : `assets/tails/` contient exactement les 137 fichiers de `tests/acceptance/SPEC-0010.liveries.json`, copiés depuis `images.livery` de `/Users/samfenn/Desktop/www/airlines-scraper/package/data/airlines.json` (entrée dont `icao` contient le code), octets identiques, aucun fichier caché ; CA1 et CA3 verts en local ; la PR déclare le poids, rappelle l'autorisation consignée et porte la case « mentions présentes dans l'app » à cocher par le propriétaire ; aucun script de copie commité.
- Conception :
  ```diff
  +assets/tails/<code>.<png|webp>   # 137 fichiers, nom et SHA-256 de l'instantané ; paires JAF/TOM et VIR/VOZ identiques
  ```
  Ordre de construction :
  1. Copie et contrôle SHA-256 contre l'instantané ; CA3 en local.
  2. `pnpm gen` puis CA1 en local (nécessite T1 dans le workspace ; sinon contrôle laissé à T3).
  Scénarios de changement :
  - Nouvel instantané du catalogue : ce dossier et l'instantané (amendement de spec), rien d'autre.

## Groupe 2 (après fusion du groupe 1)
### T3 : Livrée sur les cartes et sur Ciel, activation des contrats
- Périmètre : src/features/passages/components/airline-column.tsx, src/features/passages/components/upcoming-card.tsx, src/features/passages/components/overhead-card.tsx, src/features/passages/components/passage-card.native.test.tsx, src/features/ciel/screens/sky-screen.tsx, src/features/ciel/screens/sky-screen.native.test.tsx, tests/acceptance/SPEC-0010.test.ts, tests/acceptance/SPEC-0010.native.test.tsx
- Dépend de : T1, T2, amendement de SPEC-0006 (voir Constats partagés)
- Risque : élevé (clôture : active les scénarios cachés ; deux écrans)
- Critères de la spec couverts : CA6, CA7, CA8, CA9, CA10, CA11, CA12
- Définition de fini : `pnpm verify` vert ; retrait des **deux** `describe.skip` de SPEC-0010 (seule modification), tous verts ; contrats SPEC-0005, SPEC-0006 (amendé) et SPEC-0009 verts ; capture simulateur de Ciel et d'une carte dans la PR. Interface figée ci-dessus.
- Conception :
  ```diff
   src/features/passages/components
  ~├── airline-column.tsx      # prop airline: Airline (au lieu de tail) ; livrée ou dérive
  ~├── upcoming-card.tsx       # airline={card.airline}
  ~└── overhead-card.tsx       # idem
  ~src/features/ciel/screens/sky-screen.tsx   # dans sky-tail : ciel-livery ou ciel-tail
  ```
  ```ts
  AirlineColumn(props: { hex; airlineName; flightLabel; aircraftType; airline: Airline; labelColor })  // tail retiré
  ```
  ```diff
   AirlineColumn
  -  <View testID={`passage-tail-${hex}`}><AirlineTail palette={tail} …/></View>
  +  getLiverySource(airline) !== null
  +    ? <AirlineLivery airline testID={`passage-livery-${hex}`} width height />   # même cadre bas gauche
  +    : <View testID={`passage-tail-${hex}`}><AirlineTail palette={airline.tail} …/></View>
   SkyScreen
  ~  <View testID="sky-tail">           # emplacement gardé (contrat SPEC-0005 CA9)
  +    ciel-livery (AirlineLivery) | <View testID="ciel-tail"><AirlineTail …/></View>
  ```
  Ordre de construction :
  1. Cartes à venir et « En ce moment » (CA6, CA7, CA9 cartes) ; `passage-card.native.test.tsx` et contrat natif en local.
  2. Ciel (CA8, CA9 Ciel) ; `sky-screen.native.test.tsx`, SPEC-0005 vert.
  3. Rafraîchissement, thème, hors réseau (CA10 à CA12), puis retrait des `.skip` et `pnpm verify`.
  Scénarios de changement :
  - Maquettes de la livrée (taille, recadrage) : `airline-column.tsx` et `sky-screen.tsx` (mesures de `ciel/service.ts`) ; accepté, chaque écran possède sa disposition.
  - Livrée sur Ciel seulement : `airline-column.tsx` seul.
