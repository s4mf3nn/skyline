# Plan SPEC-0012
Statut : PRÊT
Décision de l'humain (conflit avec le contrat de SPEC-0002) : T2 modifie les deux `it` du CA5 de `tests/acceptance/SPEC-0002.test.ts` (lignes ~171-181 et ~312-322), qui exigent les couleurs inconnues pour les 137 compagnies hors handoff ; sa PR porte l'étiquette `contract-change`, posée par l'humain.

Constats partagés : `src/shared/airlines/colors.gen.ts` (`LIVERY_COLORS`, figé par le contrat d'interface de la spec) est posé par T1 et lu par T2 ; la clé est le code OACI du nom de fichier (`<CODE>.png`), égal au `code` (`icao[0]`) de la compagnie. Le contrat `tests/acceptance/SPEC-0012.test.ts` a deux `describe.skip` : seule T2 les retire.

## Groupe 1 (parallèle)
### T1 : Script gen-colors et table LIVERY_COLORS générée
- Périmètre : scripts/gen-colors.mjs, tests/unit/gen-colors.test.ts, src/shared/airlines/colors.gen.ts, package.json, pnpm-lock.yaml, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : élevé (`scripts/` est une zone à risque élevé de `RISK.md`, nouvelle dépendance de développement `pngjs`)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5, CA10
- Définition de fini : `tests/unit/gen-colors.test.ts` vert (seuils alpha 127/128, chroma 39/40, distance 119/120, égalité de cases, filtre avant moyenne, tri, `.webp` ignoré, fichier inchangé non réécrit, PNG illisible en code 1 avec le nom du fichier) ; `pnpm gen` lancé deux fois ne change rien à `git status` ; `pnpm verify` vert ; les deux `describe.skip` du contrat restent en place. `pngjs` `^7.0.0` (déjà au lockfile en 7.0.0) en `devDependencies`, justifié dans la PR ; entrée `pngjs 7.0.0` ajoutée au cache.
- Conception :
  ```diff
   scripts
  +├── gen-colors.mjs              # NOUVEAU : extractColors + ligne de commande
   src/shared/airlines
  +├── colors.gen.ts               # GÉNÉRÉ : LIVERY_COLORS, trié par code
   tests/unit
  +├── gen-colors.test.ts          # NOUVEAU : règles d'extraction et CLI
  ~package.json                    # gen : ... && node scripts/gen-colors.mjs ; devDependency pngjs
  ~pnpm-lock.yaml
  ~docs/factory/libs-cache.md      # entrée pngjs 7.0.0
  ```
  ```ts
  // Exportée : lue par le contrat et le test unitaire (import sans lancer la CLI).
  extractColors(image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray })
    : { primary: string; secondary: string } | null
  // Internes : dominant(pixels, keep) -> [r, g, b] | null (512 cases, moyenne Math.round,
  // égalité -> indice r*64 + g*8 + b le plus bas) ; toHex(rgb) -> "#RRGGBB" majuscules.
  // Seuils en constantes nommées en tête : ALPHA_MIN 128, CHROMA_MIN 40, DISTANCE_MIN 120, FALLBACK_SECONDARY "#F2E8D5".
  ```
  ```diff
   pnpm gen
     node scripts/gen-features.mjs && node scripts/gen-liveries.mjs
  +  node scripts/gen-colors.mjs [assets/tails] [--out-dir src/shared/airlines]
  +    listPngs(dir)                       # <CODE>.png triés, .webp ignorés
  +    PNG.sync.read(fs.readFileSync(file)) # pngjs : RGBA 8 bits ; échec -> message avec le fichier, code 1
  +    extractColors(image)                 # null -> code absent de la table
  +    write(out/colors.gen.ts, render())   # réécrit seulement si le contenu change
  ```
  La CLI ne tourne que si le fichier est le point d'entrée (motif `isMain` de `scripts/plan-gate.mjs`), sinon l'import du contrat lancerait la génération. `import { PNG } from "pngjs"` fonctionne en ESM (vérifié dans `node_modules/pngjs@7.0.0`, `lib/png.js` et `lib/png-sync.js`).
  Ordre de construction :
  1. CLI de bout en bout avec une extraction minimale (moyenne des pixels opaques) : dossier temporaire -> `colors.gen.ts` trié, `.webp` ignoré, fichier inchangé non réécrit, `BAD.png` en code 1 ; vérifiée par `tests/unit/gen-colors.test.ts` (partie CLI).
  2. Règles d'extraction complètes (CA1 à CA4 : opacité, 512 cases, primaire colorée puis repli, secondaire à distance ≥ 120 puis `#F2E8D5`) ; vérifiée par les cas limites du test unitaire.
  3. Branchement dans `pnpm gen`, `pngjs` en dépendance de développement, génération sur `assets/tails/` ; vérifiée par `pnpm gen` deux fois puis `git status` propre, et lecture de `colors.gen.ts`.
  Scénarios de changement :
  - Un seuil change (alpha, chroma, distance) : constantes de `scripts/gen-colors.mjs`, puis `pnpm gen` régénère `colors.gen.ts`.
  - Décodage du `.webp` (hors périmètre aujourd'hui) : `scripts/gen-colors.mjs` (liste et décodeur), `package.json` pour la dépendance.

## Groupe 2 (après fusion du groupe 1)
### T2 : Couleurs extraites dans la table des compagnies et clôture du contrat
- Périmètre : src/shared/airlines/table.ts, src/shared/airlines/table.test.ts, tests/acceptance/SPEC-0012.test.ts, tests/acceptance/SPEC-0002.test.ts
- Dépend de : T1
- Risque : moyen (`src/shared/airlines/` est lu par Ciel et Prochains passages)
- Critères de la spec couverts : CA6, CA7, CA8, CA9
- Définition de fini : retrait des deux `describe.skip` de `tests/acceptance/SPEC-0012.test.ts` (tâche de clôture : active les scénarios cachés) ; `table.test.ts` mis à jour (compagnie à dérive PNG : couleurs de `LIVERY_COLORS` ; sans PNG : couleurs inconnues ; `tail` et `country` inchangés) ; les deux `it` du CA5 de `tests/acceptance/SPEC-0002.test.ts` réécrits selon la décision ci-dessus (compagnie à dérive PNG : couleurs de `LIVERY_COLORS` ; sans PNG : couleurs inconnues ; Aegean prend les couleurs de `AEE`), rien d'autre dans ce fichier ; PR étiquetée `contract-change` par l'humain avant la CI ; `pnpm verify` vert ; le propriétaire valide les couleurs à l'œil sur Ciel avant fusion (contrainte de la spec).
- Conception :
  ```diff
   src/shared/airlines
  ~├── table.ts         # MODIFIÉ : catalogOnly lit LIVERY_COLORS[icao[0]]
  ~└── table.test.ts    # MODIFIÉ : test « 137 couleurs inconnues » remplacé par les deux cas (avec / sans PNG)
   tests/acceptance
  ~├── SPEC-0002.test.ts # MODIFIÉ : deux it du CA5 (contract-change)
  ~└── SPEC-0012.test.ts # retrait des deux .skip
  ```
  ```ts
  // Signature inchangée ; seules primary et secondary changent.
  function catalogOnly(name: string, iata: readonly string[], icao: readonly string[]): Airline
  // primary/secondary = LIVERY_COLORS[icao[0]] ?? UNKNOWN_AIRLINE ; tail = UNKNOWN_TAIL ; country = null
  ```
  ```diff
   resolveAirline(callsign)              # resolve.ts, inchangé
     AIRLINES                            # table.ts
  ~    catalogOnly(name, iata, icao)
  +      LIVERY_COLORS[icao[0]]          # colors.gen.ts (T1)
   airlineTheme(airline)                 # theme.ts, inchangé : fit() garantit INV5
  ```
  Les 8 entrées du handoff restent écrites en entier : elles ne passent pas par `catalogOnly` et gardent leurs couleurs (CA7) sans règle de priorité. `UNKNOWN_AIRLINE` et `fit()` ne bougent pas (CA8, CA9).
  Incertitude : `tests/holdout/SPEC-0002.test.ts` n'a pas été lu (interdit au planificateur et à l'implémenteur) ; s'il porte la même règle, il échouera en CI après T2 et seul l'humain peut le modifier. À vérifier par l'humain avant la fusion de T2.
  Ordre de construction :
  1. `catalogOnly` lit `LIVERY_COLORS`, `table.test.ts` mis à jour, retrait du `.skip` du bloc « table » ; vérifiée par `vitest run tests/acceptance/SPEC-0012.test.ts src/shared/airlines`.
  2. Retrait du `.skip` du bloc « extraction » et `pnpm verify` complet (Ciel, Prochains passages, contrat de SPEC-0002 réécrit) ; vérifiée par `pnpm verify`.
  3. Contrôle visuel sur Ciel (`pnpm dev` avec `EXPO_PUBLIC_MANUAL_POSITION`) par le propriétaire ; vérifié à l'écran.
  Scénarios de changement :
  - Le propriétaire saisit les couleurs d'une compagnie extraite : `table.ts` seul (entrée complète à la place de `catalogOnly`).
  - Une dérive rangée sous un code OACI secondaire (ex. `EJU`) : `table.ts` seul (recherche sur tous les `icao`) ; rien ne l'annonce, pas d'abstraction ajoutée.
