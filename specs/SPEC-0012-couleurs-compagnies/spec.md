# SPEC-0012 : Couleurs des compagnies extraites des dérives

Statut : BROUILLON
Risque estimé : moyen (table des compagnies lue par Ciel et Prochains passages ; une dépendance de développement ; aucune image ajoutée)
Dépend de : SPEC-0002, SPEC-0010
Tests de contrat : `tests/acceptance/SPEC-0012.test.ts`
Scénarios cachés : `tests/holdout/SPEC-0012.test.ts` (ne pas les décrire ici)

## Objectif
Chaque compagnie qui a une dérive dans `assets/tails/` prend sur Ciel et sur les cartes les couleurs de cette dérive, au lieu du gris et de l'encre de la compagnie inconnue. Les couleurs sont calculées par `pnpm gen` à partir des images, de façon déterministe ; aucune couleur n'est saisie à la main.

## Acteurs et rôles
Aucun rôle (aucune action exposée). Le calcul tourne au développement ; l'application n'embarque que le résultat.

## Critères d'acceptation
- **CA1** : `extractColors(image)`, exportée par `scripts/gen-colors.mjs`, prend `{ width, height, data }` (RGBA, 4 octets par pixel) et rend `{ primary, secondary }` en `#RRGGBB` majuscules, ou `null` si aucun pixel n'est opaque. Un pixel est opaque si son alpha est ≥ 128 ; les autres sont ignorés.
- **CA2** : un calcul de couleur range ses pixels en 512 cases (canal >> 5 pour r, g, b) ; la couleur d'une case est la moyenne, canal par canal et arrondie (`Math.round`), des seuls pixels retenus par le filtre de ce calcul (CA3 ou CA4), appliqué avant le rangement. À effectif égal, la case d'indice `r*64 + g*8 + b` le plus bas l'emporte.
- **CA3** : `primary` est la couleur de la case la plus peuplée parmi les pixels colorés (max − min des canaux ≥ 40). S'il n'y en a aucun, parmi tous les pixels opaques.
- **CA4** : `secondary` est la couleur de la case la plus peuplée parmi les pixels opaques dont la distance euclidienne RGB à `primary` est ≥ 120 (blanc, gris et noir y comptent) ; un pixel à distance < 120 n'entre ni dans le décompte ni dans la moyenne. S'il n'y en a aucun : `#F2E8D5` (secondaire de `UNKNOWN_AIRLINE`).
- **CA5** : `pnpm gen` appelle `scripts/gen-colors.mjs`, qui lit les `assets/tails/<CODE>.png` et écrit `src/shared/airlines/colors.gen.ts` (`LIVERY_COLORS`, code OACI → `{ primary, secondary }`, trié par code). Le script accepte un dossier d'images et `--out-dir` comme `gen-liveries.mjs`, n'écrit pas un fichier inchangé et ignore les `.webp`. Un PNG illisible fait échouer le script (code 1, message avec le nom du fichier).
- **CA6** : une compagnie du catalogue dont le code a une couleur dans `LIVERY_COLORS` et qui n'a pas de couleurs du handoff a ces `primary` et `secondary` dans `AIRLINES` et via `resolveAirline`. Ses autres champs (nom, codes, `tail`) ne changent pas.
- **CA7** : les 8 compagnies du handoff (AFR, EZY, IBE, KLM, DLH, RYR, TAP, VLG) gardent exactement leurs couleurs et leur palette `tail`, même si leur dérive est présente.
- **CA8** : une compagnie sans dérive PNG (ou dont l'image est ignorée) garde `UNKNOWN_AIRLINE.primary` et `.secondary` (INV8). `UNKNOWN_AIRLINE` ne change pas.
- **CA9** : `airlineTheme` d'une compagnie extraite respecte INV5 : `big` ≥ 3:1 et `small` ≥ 4,5:1 sur `bg`, quelles que soient les couleurs extraites (`fit()` inchangée).
- **CA10** : `pnpm gen` est idempotent : une seconde exécution ne modifie aucun fichier, et `colors.gen.ts` committé est identique à une génération fraîche sur `assets/tails/`.

## Cas limites
- Image sans pixel coloré (dérive grise ou noir et blanc) : `primary` vient de tous les pixels opaques.
- Image à une seule couleur : `secondary` vaut `#F2E8D5`.
- Pixel d'alpha 127 ignoré, d'alpha 128 compté ; chroma 39 neutre, chroma 40 coloré.
- Égalité d'effectifs entre deux cases : la règle de CA2 tranche.
- Code d'image absent du catalogue : l'entrée de `LIVERY_COLORS` reste, `AIRLINES` ne gagne aucune compagnie (145 compagnies).
- Image transparente (`null`) : aucune entrée dans `LIVERY_COLORS`, la compagnie garde les couleurs inconnues.

## Contrat d'interface
- `scripts/gen-colors.mjs` : `extractColors(image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }): { primary: string; secondary: string } | null`. Usage en ligne de commande : `node scripts/gen-colors.mjs [dossier_images] [--out-dir <dossier>]`.
- `src/shared/airlines/colors.gen.ts` : `LIVERY_COLORS: Readonly<Record<string, { primary: string; secondary: string }>>` (fichier généré, jamais édité à la main).
- Interface publique inchangée : `AIRLINES`, `resolveAirline`, `airlineTheme` de `src/shared/airlines/index.ts`.

## Hors périmètre
- Palette `tail` (base, rayures, disque) de la dérive SVG de repli : elle reste générique.
- Couleurs des 8 compagnies du handoff et des compagnies sans dérive : le propriétaire les renseignera.
- Ajout, retrait ou recadrage d'images ; décodage du `.webp` ; extraction à l'exécution dans l'application.
- Nouveau comportement d'écran : Ciel et les cartes lisent déjà `primary` et `secondary`.

## Contraintes
- Dépendance de développement `pngjs` (décodage PNG du script de génération, déjà présent en transitif dans le lockfile) : à justifier dans la PR ; jamais embarquée dans l'application.
- Les couleurs extraites ne sont pas inventées (INV8) : elles viennent des images dont SPEC-0010 consigne l'autorisation. INV8 et le commentaire de `catalogOnly` (« le propriétaire les renseignera ») sont à lire dans ce sens ; le propriétaire valide à l'œil sur Ciel avant fusion de l'implémentation.
- Résultat strictement déterministe : mêmes images, même fichier généré, sans horloge ni hasard.
- `LIVERY_COLORS` reste un petit module de données (≈ 140 lignes) ; aucun appel réseau.

## Questions ouvertes
Aucune.
