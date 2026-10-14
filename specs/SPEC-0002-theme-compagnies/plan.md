# Plan SPEC-0002
Statut : PRÊT

Constats partagés par les tâches :
- **Emplacement** : tout vit dans `src/shared/airlines/` (spec, CA ; pas de feature, pas de `pnpm gen`). Zone `**/shared/` : risque moyen d'après `docs/factory/RISK.md`, d'où un bloc `Conception` par tâche.
- **Types figés** (posés par T1 dans `src/shared/airlines/types.ts`, recopiés du « Contrat d'interface » de la spec, noms de `docs/DOMAIN.md`) : `TailPalette`, `Airline`, `AirlineTheme`. Aucune autre tâche ne les modifie.
- **Point d'entrée** : `src/shared/airlines/index.ts` est logique pure (aucun import de React Native ni de `react-native-svg`), chargé par chemin par le contrat Vitest. T1 le crée, T2 y ajoute `AIRLINES` et `UNKNOWN_AIRLINE`, T4 y ajoute `resolveAirline`. `tail.tsx` n'est **pas** réexporté par `index.ts` : les écrans l'importent par `@/shared/airlines/tail`.
- **Erreur typée** : T1 ajoute `"INVALID_COLOR"` à l'union `ErrorCode` de `src/shared/errors.ts`. D'autres specs ajoutent aussi des codes à cette union : un conflit d'une ligne s'y résout en gardant tous les codes, et `/resolve` le consigne dans `docs/factory/HOTSPOTS.md`.
- **Contrat** : `tests/acceptance/SPEC-0002.test.ts` garde son `describe.skip` jusqu'à T4. Une tâche peut retirer le `.skip` en local pour vérifier ses critères, sans le commiter. `tests/acceptance/SPEC-0002.catalogue.json` se lit, ne se modifie pas.
- **Mutation** : Stryker mute les fichiers modifiés ; les seuils et comparaisons du handoff (`0.03928`, `0.6001`, `>=`, égalité crème/encre) doivent chacun être pris par un test unitaire à la frontière.

## Groupe 1 (parallèle)
### T1 : Couleurs du handoff (mix, contrastRatio, fit) et thème de compagnie
- Périmètre : src/shared/airlines/types.ts, src/shared/airlines/color.ts, src/shared/airlines/color.test.ts, src/shared/airlines/theme.ts, src/shared/airlines/theme.test.ts, src/shared/airlines/index.ts, src/shared/errors.ts, src/shared/errors.test.ts
- Dépend de : aucune
- Risque : moyen (code partagé par Ciel et Passages : une erreur d'arrondi ou de seuil casse la lisibilité garantie par INV5 sur les deux écrans)
- Critères de la spec couverts : CA1, CA2, CA3, CA4
- Définition de fini : `pnpm verify` vert ; `color.test.ts` couvre les cas limites de la spec (couleur invalide `rouge`, `#FFF`, chaîne vide, minuscules acceptées, cible pile atteinte, contraste insoluble, repli crème ou encre à égalité) et l'accumulation flottante de `t` (exemples `#C0B12C`/`#59EF48` et `#748CC1`/`#9B9658` du contrat) ; `theme.test.ts` couvre Iberia, Air France, easyJet construits en littéraux et une couleur invalide dans la compagnie ; les tests CA1 à CA3 et « Edge » du contrat passent en local une fois le `.skip` retiré (non commité). CA4 n'est vérifié en T1 que par `theme.test.ts` (valeurs attendues en littéraux) : les tests CA4 du contrat passent par `resolveAirline` ou `AIRLINES` et ne sont vérifiés qu'en T4. Les types figés ci-dessus s'appliquent.
- Conception :
  ```diff
   src/shared
  ~├── errors.ts            # MODIFIÉ : ErrorCode += "INVALID_COLOR"
  ~├── errors.test.ts       # MODIFIÉ : un cas INVALID_COLOR
   └── airlines
  +    ├── types.ts         # NOUVEAU : TailPalette, Airline, AirlineTheme (figés)
  +    ├── color.ts         # NOUVEAU : mix, contrastRatio, fit ; parseHex et luminance internes
  +    ├── color.test.ts
  +    ├── theme.ts         # NOUVEAU : airlineTheme (règle bg/big/small/track)
  +    ├── theme.test.ts
  +    └── index.ts         # NOUVEAU : réexporte types, mix, contrastRatio, fit, airlineTheme
  ```
  ```ts
  // color.ts : copie fidèle de data.js, plus la validation à l'entrée
  mix(a: string, b: string, t: number): string          // #RRGGBB majuscules, Math.round par canal
  contrastRatio(a: string, b: string): number           // WCAG, seuil 0.03928
  fit(fg: string, bg: string, target: number): string   // rend fg tel quel (casse comprise) si >= target
  // interne : parseHex(color): [number, number, number]  lève AppError("INVALID_COLOR", ...) hors /^#[0-9A-Fa-f]{6}$/
  // theme.ts
  airlineTheme(airline: Airline): AirlineTheme
  ```
  ```diff
   airlineTheme(airline)
  +  bg = airline.primary
  +  big = fit(airline.secondary, bg, 3)        # parseHex valide primary et secondary
  +  small = fit(airline.secondary, bg, 4.5)
  +  track = mix(bg, small, 0.3)
  +  fit(fg, bg, target)
  +    contrastRatio(fg, bg) >= target ? fg
  +    for (t = 0.02; t <= 0.6001; t += 0.02)  mix(fg, "#FFFFFF", t) puis mix(fg, "#000000", t)
  +    repli : contrastRatio("#F4F1EA", bg) > contrastRatio("#1D1D1B", bg) ? crème : encre
  ```
  Ordre de construction :
  1. `index.ts` et `types.ts`, `mix` avec `parseHex` et `INVALID_COLOR` ; vérifiée par les tests CA1 et le premier test « Edge » du contrat en local.
  2. `contrastRatio` puis `fit` (boucle, repli, comparaison `>=`) ; vérifiée par les tests CA2 et CA3 du contrat en local et `color.test.ts`.
  3. `airlineTheme` sur des compagnies écrites en littéraux dans `theme.test.ts` (valeurs attendues du contrat CA4), dont la couleur invalide ; puis `pnpm verify` (couverture et mutation).
  Scénarios de changement :
  - Mode nuit (`theme(k, night)`, `tone`, `toneInk`, hors v0 d'après `docs/PRODUCT.md`) : `theme.ts` et `theme.test.ts` seulement (paramètre ou seconde fonction), `color.ts` inchangé.
  - Seuils de contraste changés (texte moyen, WCAG 3) : `theme.ts` (cibles 3 et 4,5) ; `fit` reste générique.
  - Couleurs de repli crème et encre reprises des tokens Tailwind : `color.ts` seulement (deux constantes), accepté tant qu'aucun autre module n'en a besoin.

## Groupe 2 (après fusion du groupe 1)
### T2 : Table des 145 compagnies et compagnie inconnue
- Périmètre : src/shared/airlines/table.ts, src/shared/airlines/table.test.ts, src/shared/airlines/index.ts
- Dépend de : T1
- Risque : moyen (donnée partagée par les deux écrans ; un code mal recopié affiche une mauvaise compagnie et viole INV8)
- Critères de la spec couverts : CA5, CA6
- Définition de fini : `pnpm verify` vert ; `table.test.ts` vérifie, sans passer par `index.ts` ni `resolveAirline` : 145 entrées, `code === icao[0]`, codes IATA et OACI uniques et bien formés, les huit compagnies du handoff (nom, pays, couleurs, dérive de `data.js`), 137 autres avec les couleurs et la dérive d'`UNKNOWN_AIRLINE` et un pays `null`, `UNKNOWN_AIRLINE` égale à l'entrée `xx`, et le contraste INV5 de `airlineTheme` (importé de `./theme`) sur toute la table ; `index.ts` réexporte `AIRLINES` et `UNKNOWN_AIRLINE` en plus des exports de T1 ; les tests CA5 et CA6 du contrat qui n'appellent pas `resolveAirline` passent en local (`.skip` retiré, non commité). La table est recopiée de `tests/acceptance/SPEC-0002.catalogue.json` dans son ordre, sans dépendance d'exécution au catalogue ; aucune couleur inventée. Les types figés ci-dessus s'appliquent.
- Conception :
  ```diff
   src/shared/airlines
  +├── table.ts         # NOUVEAU : UNKNOWN_AIRLINE, AIRLINES (ordre du catalogue), helper catalogOnly
  +├── table.test.ts
  ~└── index.ts         # MODIFIÉ : + AIRLINES, UNKNOWN_AIRLINE
  ```
  ```ts
  export const UNKNOWN_AIRLINE: Airline   // code "xx", "Inconnue", "France", #1D1D1B / #F2E8D5,
                                          // tail { base "#CFC8BA", stripe1 "#1D1D1B", stripe2 null, disc null }, iata [], icao []
  export const AIRLINES: readonly Airline[]
  // interne : compagnie du catalogue sans palette du handoff
  catalogOnly(name: string, iata: readonly string[], icao: readonly string[]): Airline
    // code = icao[0], country null, primary/secondary/tail = ceux d'UNKNOWN_AIRLINE
  ```
  ```diff
   AIRLINES = [
  +  catalogOnly("Aegean Airlines", ["A3"], ["AEE"]),
  +  ...                                              # une ligne par compagnie du catalogue
  +  { code: "AFR", name: "Air France", country: "France", primary: "#0B1F4B", ... },  # handoff : littéral complet
  +  ...
  +]
  ```
  Les huit compagnies du handoff sont écrites en littéral complet **à leur place dans l'ordre du catalogue** (une seule source par compagnie), avec le nom du handoff (`easyJet`, `TAP Air Portugal`) et leurs codes du catalogue. Les 137 autres partagent l'objet `tail` d'`UNKNOWN_AIRLINE`, gelé par `Object.freeze` pour qu'aucun appelant ne le modifie par une compagnie.
  Ordre de construction :
  1. `UNKNOWN_AIRLINE` et `catalogOnly`, table réduite aux trois compagnies du `ORDER` du handoff (Iberia, Air France, easyJet) ; vérifiée par `table.test.ts` (CA6, littéraux du handoff) et le test CA6 du contrat en local.
  2. Les cinq autres compagnies du handoff (Lufthansa, KLM, Ryanair, Vueling, TAP) ; vérifiée par `table.test.ts` (palettes de `data.js`, codes multiples de Ryanair).
  3. Les 137 compagnies restantes recopiées dans l'ordre du catalogue ; vérifiée par les tests CA5 « lists the catalog airlines » et « contains exactly » du contrat en local, puis l'invariant INV5 sur toute la table.
  Scénarios de changement :
  - Le propriétaire renseigne les couleurs et le pays d'une compagnie (amendement annoncé par la spec) : une ligne de `table.ts`, `catalogOnly(...)` remplacé par un littéral complet, et un cas dans `table.test.ts`.
  - Nouvel instantané du catalogue (compagnies ajoutées ou retirées) : `table.ts` et le fichier de contrat (PR de spec, `contract-change`) ; rien d'autre.
  - Images de dérive autorisées (SPEC-0010) : nouveau champ facultatif dans `types.ts` et la table, hors de ce plan ; `airlineTheme` et `resolveAirline` inchangés.

### T3 : Dérive générique SVG (AirlineTail)
- Périmètre : src/shared/airlines/tail.tsx, src/shared/airlines/tail.native.test.tsx, docs/factory/libs-cache.md
- Dépend de : T1
- Risque : moyen (composant partagé par Ciel et Passages, hors contrat et hors couverture Vitest : seule la capture le vérifie)
- Critères de la spec couverts : aucun (livrable hors contrat de la spec)
- Définition de fini : `pnpm verify` vert ; `tail.native.test.tsx` (Jest) rend la dérive d'Air France (deux bandes) et de Lufthansa (disque seul) en littéraux de `TailPalette` et montre qu'une bande ou un disque `null` n'est pas dessiné ; capture sur simulateur iPhone 15 ou 16 jointe à la PR, avec deux dérives côte à côte (palettes Iberia et Air France) pour montrer que le découpage de l'une ne déteint pas sur l'autre, comparée à `Fin.dc.html` ; entrée `react-native-svg 15.15.4` ajoutée au cache (`G` avec `transform` en chaîne, `ClipPath` dans `Defs`, `clipPath="url(#id)"`). Aucune couleur en dur hors des données reçues (ADR-0001, « Style »). Le type `TailPalette` figé ci-dessus s'applique.
- Conception :
  ```diff
   src/shared/airlines
  +├── tail.tsx                 # NOUVEAU : AirlineTail, rendu seul, aucun calcul de couleur
  +└── tail.native.test.tsx     # NOUVEAU : rendu sous Jest (bandes et disque facultatifs)
  ~docs/factory/libs-cache.md   # MODIFIÉ : entrée react-native-svg 15.15.4
  ```
  ```ts
  export function AirlineTail(props: { palette: TailPalette; width: number; height: number }): ReactElement
  ```
  ```diff
   <AirlineTail palette width height>
  +  <Svg viewBox="0 0 300 440" width height>
  +    <Defs><ClipPath id="fin-clip"><Path d=FIN_PATH /></ClipPath></Defs>
  +    <G transform="matrix(-1 0 0 1 300 0)">          # miroir horizontal : dérive orientée vers la gauche
  +      <Path d=FIN_PATH fill=palette.base />
  +      <G clipPath="url(#fin-clip)">
  +        stripe1 && <Path d=STRIPE1_PATH fill=stripe1 />
  +        stripe2 && <Path d=STRIPE2_PATH fill=stripe2 />
  +        disc && <Circle cx=176 cy=196 r=66 fill=disc />
  ```
  Les tracés (`FIN_PATH`, `STRIPE1_PATH`, `STRIPE2_PATH`) sont des constantes de géométrie recopiées de `Fin.dc.html`, pas des couleurs. Une couche `null` n'est pas rendue (le handoff dessinait `fill="none"`, visuellement identique).
  Ordre de construction :
  1. `AirlineTail` avec la forme de base seule, monté temporairement dans un écran local non commité ; vérifiée par capture (silhouette et miroir).
  2. Découpage, bandes et disque facultatifs ; vérifiée par `tail.native.test.tsx` et la capture de deux dérives côte à côte.
  3. Entrée du cache et `pnpm verify`.
  Scénarios de changement :
  - Image de dérive autorisée (SPEC-0010) : l'appelant choisit entre l'image et `AirlineTail` ; `tail.tsx` inchangé.
  - Troisième motif de dérive (forme différente pour une compagnie) : `tail.tsx` et un champ de `TailPalette` (`types.ts`, table) ; accepté, rien ne l'annonce dans la spec.
  - Les identifiants de `ClipPath` se télescopent entre deux dérives d'un même écran : `tail.tsx` seulement (identifiant par instance).

## Groupe 3 (après fusion du groupe 2)
### T4 : Résolution de l'indicatif et activation du contrat
- Périmètre : src/shared/airlines/resolve.ts, src/shared/airlines/resolve.test.ts, src/shared/airlines/index.ts, tests/acceptance/SPEC-0002.test.ts
- Dépend de : T1, T2
- Risque : moyen (entrée externe non fiable : l'indicatif vient de la source ADS-B ; `resolveAirline` ne doit jamais lever ni mal attribuer une compagnie)
- Critères de la spec couverts : CA4, CA5, CA6, CA7, CA8
- Définition de fini : `pnpm verify` vert ; `resolve.test.ts` couvre chaque exemple de CA7 et CA8 et les cas limites de la spec (indicatif à deux lettres, préfixe OACI connu sans chiffre, `AC` contre `ACI`, préfixe OACI inconnu dont les deux premières lettres sont un IATA, caractères non ASCII mis en majuscules, entrée très longue) ; `index.ts` réexporte `resolveAirline` en plus des exports de T1 et T2 ; **le `.skip` du `describe` de `tests/acceptance/SPEC-0002.test.ts` est retiré** (seule modification permise du fichier de contrat) et tout le contrat passe.
- Conception :
  ```diff
   src/shared/airlines
  +├── resolve.ts        # NOUVEAU : resolveAirline et index des codes, construits une fois au chargement
  +├── resolve.test.ts
  ~└── index.ts          # MODIFIÉ : + resolveAirline
   tests/acceptance
  ~└── SPEC-0002.test.ts # MODIFIÉ : describe.skip -> describe
  ```
  ```ts
  resolveAirline(callsign: string | null): Airline      // jamais d'exception, même référence que la table
  // interne
  const BY_ICAO: ReadonlyMap<string, Airline>           // chaque code de airline.icao
  const BY_IATA: ReadonlyMap<string, Airline>           // chaque code de airline.iata
  const ICAO_CALLSIGN = /^([A-Z]{3})[0-9]/              // la suite après le chiffre est ignorée
  const IATA_CALLSIGN = /^([A-Z0-9]{2})[0-9]{1,4}$/     // des chiffres jusqu'au bout
  ```
  ```diff
   resolveAirline(callsign)
  +  callsign === null ? UNKNOWN_AIRLINE
  +  clean = callsign.trim().toUpperCase()
  +  ICAO_CALLSIGN.exec(clean) -> BY_ICAO.get(prefix) ?? (continue)
  +  IATA_CALLSIGN.exec(clean) -> BY_IATA.get(prefix) ?? UNKNOWN_AIRLINE
  +  sinon UNKNOWN_AIRLINE
  ```
  Ordre de construction :
  1. `resolveAirline` réexporté par `index.ts`, qui ne sait que l'OACI exact (`AFR1506`) ; vérifiée par le test CA7 « OACI callsign prefix » du contrat en local.
  2. Nettoyage, repli IATA, suite ignorée après le premier chiffre ; vérifiée par les tests CA7 du contrat et `resolve.test.ts`.
  3. Indicatifs sans compagnie (CA8, entrées hostiles) ; vérifiée par les tests CA8 du contrat, puis retrait du `.skip` et contrat entier (CA4, CA5 via `resolveAirline`), `pnpm verify`.
  Scénarios de changement :
  - Compagnie issue de la route de vol (adsbdb, SPEC-0009) prioritaire sur l'indicatif : l'appelant choisit, `resolve.ts` gagne au plus une fonction de recherche par code ; la table reste intacte.
  - Nouveau format d'indicatif (préfixe OACI suivi d'une lettre pour certains opérateurs) : `resolve.ts` (motif) et `resolve.test.ts` seulement.
  - Code partagé par deux compagnies dans un futur catalogue : `resolve.ts` (construction des index) et `table.test.ts` ; la spec l'exclut aujourd'hui.
