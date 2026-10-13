# SPEC-0002 : Thème des compagnies

Statut : BROUILLON
Risque estimé : faible (logique pure et un composant décoratif ; aucune zone sensible, aucune donnée personnelle)
Dépend de : SPEC-0000
Tests de contrat : `tests/acceptance/SPEC-0002.test.ts` (Vitest), `tests/acceptance/SPEC-0002.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0002.test.ts` (ne pas les décrire ici)

## Objectif
Donner à Ciel et à Prochains passages une seule source pour les couleurs d'une compagnie : à partir de l'indicatif d'un avion, on obtient sa compagnie (ou `UNKNOWN_AIRLINE`), et de celle-ci un thème dont le texte reste lisible sur le fond, calculé à l'identique de `data.js` (`fit()`, `mix()`). Une dérive générique en SVG, en miroir et orientée vers la gauche, aux couleurs de la compagnie, sert tant qu'aucune image n'est autorisée (INV8). Aucune couleur n'est inventée : une compagnie absente de la table prend `UNKNOWN_AIRLINE`.

## Acteurs et rôles
Aucun rôle.

## Critères d'acceptation
- **CA1** : `mix(from, to, t)` interpole canal par canal entre deux couleurs `#RRGGBB` (majuscules ou minuscules en entrée) et renvoie `#RRGGBB` en majuscules, chaque canal arrondi à l'entier le plus proche (`Math.round`) : `t = 0` rend `from`, `t = 1` rend `to`. Résultats identiques à ceux de `mix()` de `data.js`. `mix` et `fit` ne reçoivent que des `#RRGGBB` valides, jamais `"none"` ni un `t` hors [0, 1] : leur comportement y est indéfini.
- **CA2** : `fit(foreground, background, target)` rend `foreground` tel quel (casse comprise) quand son contraste WCAG (luminance relative sRGB, `(L1 + 0,05) / (L2 + 0,05)`) sur `background` vaut déjà `target` ou plus.
- **CA3** : sinon, `fit` mélange `foreground` vers le blanc `#FFFFFF` puis vers le noir `#000000`, par pas de 0,02 cumulés par addition flottante jusqu'à 0,6001 inclus, en essayant le blanc avant le noir à chaque pas, et rend le premier mélange qui atteint `target`. Le dernier pas essayé est donc 0,6 (soit 30 pas). Résultats identiques à ceux de `fit()` de `data.js`.
- **CA4** : si aucun mélange n'atteint `target`, `fit` rend le crème `#F4F1EA` ou l'encre `#1D1D1B`, celui dont le contraste sur `background` est strictement supérieur, sinon l'encre (INV5). Aucun `#RRGGBB` ne donne un contraste exactement égal aux deux (vérifié sur les 16 777 216 couleurs) : la règle de l'égalité suit `data.js` et n'a pas de test.
- **CA5** : la table `airlines` contient les 8 compagnies du handoff, dans l'ordre du handoff (Iberia, Air France, easyJet, Lufthansa, KLM, Ryanair, Vueling, TAP Air Portugal), avec leur code (code IATA en minuscules, clé du handoff), nom, pays, couleur primaire, couleur secondaire, code IATA, code OACI et couleurs de dérive, exactement comme dans le tableau « Contrat d'interface ». `UNKNOWN_AIRLINE` est l'entrée `xx` du handoff (nom « Inconnue », pays, codes IATA et OACI à `null`) et n'est pas dans `airlines`.
- **CA6** : `airlineTheme(airline)` rend `bg` (la couleur primaire), `big = fit(secondaire, bg, 3)`, `small = fit(secondaire, bg, 4,5)` et `track = mix(bg, small, 0,3)`. Pour toute entrée de la table et `UNKNOWN_AIRLINE`, le contraste de `big` sur `bg` est d'au moins 3:1 et celui de `small` d'au moins 4,5:1 (INV5).
- **CA7** : `resolveAirline(callsign)` rend la compagnie dont le code OACI est le préfixe de trois lettres de l'indicatif. L'indicatif est nettoyé (blancs de début et de fin retirés comme le fait `String.prototype.trim` : espaces, tabulations, sauts de ligne, espace insécable ; puis majuscules) puis doit avoir la forme : trois lettres, un chiffre, puis au plus trois lettres ou chiffres (`AFR1506`, `IBE3457`, `ezy6103`, `  RYR8312 `).
- **CA8** : `resolveAirline` rend `UNKNOWN_AIRLINE` (INV8), sans lever d'erreur, pour un indicatif `null`, vide ou d'espaces, de forme différente de CA7 (préfixe IATA `AF1506` ou `U24617`, immatriculation `F-HBXA`, espace ou tiret à l'intérieur, plus de quatre caractères après les trois lettres, ou sans chiffre `AFR`) ou dont le préfixe OACI n'est pas dans la table (`XYZ123`).
- **CA9** : `tailLayers(colors)` rend les couches de la dérive à peindre, dans l'ordre `base`, `band1`, `band2`, `disc`, chacune avec sa couleur et sa forme (`{ layer, fill, shape }`, formes du tableau « Dérive générique »), en omettant celles dont la couleur vaut `"none"`.
- **CA10** : `GenericTail` rend un SVG de `viewBox` `0 0 300 440` à la largeur demandée, de hauteur `largeur × 440 / 300`, en miroir horizontal (orientée vers la gauche). Il peint une forme par couche de `tailLayers`, dans l'ordre, avec leur `fill` ; la couche `base` suit le contour de la dérive, les autres sont rognées par ce contour (`ClipPath`). Le composant est décoratif : il est masqué aux technologies d'assistance et ne porte aucun texte.

## Cas limites
- Couleurs `#RRGGBB` en minuscules : `mix` rend des majuscules ; `fit` rend `foreground` inchangé (casse comprise) quand le contraste suffit.
- `fit` avec `foreground` égal à `background` : aucun mélange ne suffit en général ; le résultat suit CA3 puis CA4 comme pour toute autre paire.
- Contraste exactement égal à la cible : `foreground` est conservé (comparaison `>=`).
- Dernier pas : un résultat atteint seulement au pas de 0,6 est rendu ; au-delà, repli du CA4.
- Indicatif `null` (avion sans indicatif, `Aircraft.callsign`) : `UNKNOWN_AIRLINE`.
- Indicatif en minuscules, ou entouré de blancs (espaces, tabulation, saut de ligne, espace insécable) : reconnu (CA7).
- Indicatif au préfixe connu mais de forme invalide (`AFR`, `AFR15060`, `AFR-1506`) : `UNKNOWN_AIRLINE`, jamais la compagnie par approximation.
- Dérive sans bande ni disque (`band1`, `band2` et `disc` à `"none"`) : seule la couche `base` est peinte.
- `UNKNOWN_AIRLINE` garde ses propres couleurs (fond encre `#1D1D1B`) : elle n'est jamais remplacée par la couleur d'une autre compagnie.

## Contrat d'interface
Deux modules partagés, hors du registre des features (le registre exige un écran, voir « Contraintes »).

```ts
// src/shared/airline-theme/index.ts : logique pure, aucun import de React Native
type HexColor = string                                  // "#RRGGBB"
mix(from: HexColor, to: HexColor, t: number): HexColor  // t dans [0, 1]
fit(foreground: HexColor, background: HexColor, target: number): HexColor

interface TailColors { base: string; band1: string; band2: string; disc: string }  // "none" : rien n'est peint
interface Airline {
  code: string               // IATA en minuscules ("ib"), "xx" pour UNKNOWN_AIRLINE
  name: string
  country: string | null     // null pour UNKNOWN_AIRLINE
  primary: HexColor          // fond
  secondary: HexColor        // texte, avant ajustement
  iata: string | null        // "IB"
  oaci: string | null        // "IBE"
  tail: TailColors
}
const airlines: readonly Airline[]   // les 8 compagnies du handoff, dans l'ordre
const UNKNOWN_AIRLINE: Airline
resolveAirline(callsign: string | null): Airline   // ne lève jamais d'erreur

interface AirlineTheme { bg: HexColor; big: HexColor; small: HexColor; track: HexColor }
airlineTheme(airline: Airline): AirlineTheme

type TailShape = { kind: "path"; d: string } | { kind: "circle"; cx: number; cy: number; r: number }
interface TailLayer { layer: "base" | "band1" | "band2" | "disc"; fill: string; shape: TailShape }
tailLayers(colors: TailColors): TailLayer[]
const TAIL_VIEWBOX: string        // "0 0 300 440"
const TAIL_OUTLINE_PATH: string   // contour de la dérive, aussi chemin de la couche base (voir tableau)

// src/shared/airline-theme/generic-tail.tsx : composant React Native (react-native-svg)
GenericTail(props: TailColors & { width: number }): ReactElement
// Racine : <View> de style { width, height: width * 440 / 300, transform: [{ scaleX: -1 }] },
// accessibilityElementsHidden et importantForAccessibility="no-hide-descendants", contenant le SVG.
// Éléments de react-native-svg : `Svg` (prop viewBox = TAIL_VIEWBOX), `Defs` et `ClipPath` portant un `Path` de d = TAIL_OUTLINE_PATH
// sans prop `fill`, puis un `Path` ou `Circle` par couche avec la prop `fill` de la couche ; les couches autres que base
// sont dans un `G` rogné par le `ClipPath`. Seules les formes des couches portent une prop `fill`.
```

Dérive générique (géométrie de `Fin.dc.html`, repère 300 × 440, recopiée ici car le handoff n'est pas embarqué) :

| layer | forme | rognée par le contour |
|---|---|---|
| `base` | `path`, d = `M 36 14 Q 40 2 54 2 L 150 2 L 460 440 L 116 440 Z` (= `TAIL_OUTLINE_PATH`) | non (c'est le contour) |
| `band1` | `path`, d = `M 0 300 L 320 160 L 320 236 L 0 376 Z` | oui |
| `band2` | `path`, d = `M 0 394 L 320 254 L 320 286 L 0 426 Z` | oui |
| `disc` | `circle`, cx = 176, cy = 196, r = 66 | oui |

Table des compagnies (couleurs du handoff `data.js`, objet `A` ; dérive = champ `fin`, `a1` devient `band1`, `a2` devient `band2`) :

| code | name | country | iata | oaci | primary | secondary | base | band1 | band2 | disc |
|---|---|---|---|---|---|---|---|---|---|---|
| `ib` | Iberia | Espagne | IB | IBE | `#C8102E` | `#F6C344` | `#F6C344` | `#8E0A22` | `none` | `none` |
| `af` | Air France | France | AF | AFR | `#0B1F4B` | `#F4F1EA` | `#F4F1EA` | `#2B5BD6` | `#E1251B` | `none` |
| `u2` | easyJet | Royaume-Uni | U2 | EZY | `#FF6600` | `#FFFFFF` | `#FFFFFF` | `#FF6600` | `none` | `none` |
| `lh` | Lufthansa | Allemagne | LH | DLH | `#0A1D3D` | `#F9B000` | `#1A3466` | `none` | `none` | `#F9B000` |
| `kl` | KLM | Pays-Bas | KL | KLM | `#00A1DE` | `#003145` | `#FFFFFF` | `#7FD3F2` | `none` | `none` |
| `fr` | Ryanair | Irlande | FR | RYR | `#073590` | `#F1C933` | `#073590` | `#F1C933` | `none` | `none` |
| `vy` | Vueling | Espagne | VY | VLG | `#FFCC00` | `#3C3C3B` | `#FFCC00` | `#3C3C3B` | `none` | `none` |
| `tp` | TAP Air Portugal | Portugal | TP | TAP | `#1E6F4A` | `#F4F1EA` | `#E4252F` | `#F4F1EA` | `none` | `none` |
| `xx` (`UNKNOWN_AIRLINE`) | Inconnue | `null` | `null` | `null` | `#1D1D1B` | `#F2E8D5` | `#CFC8BA` | `#1D1D1B` | `none` | `none` |

Les codes OACI et IATA sont les désignateurs officiels des compagnies ; ils sont contrôlés par l'humain à la relecture de cette spec.

## Écrans
Aucun écran : cette spec ne livre que de la logique et un composant décoratif, montés par SPEC-0005 (Ciel) et SPEC-0006 (cartes de passage). Pas de maquette à fournir ; la référence visuelle de la dérive est `docs/brief/design_handoff_skyline_ciel_passages/Fin.dc.html` (tailles du handoff : 272 × 399 sur Ciel, 170 × 249 sur les cartes, hors périmètre ici).

## Parcours sur cible réelle
Aucun : la dérive est vérifiée sur simulateur par les specs d'écran qui la placent.

## Hors périmètre
- Les images de dérive réelles, leur consignation et `assets/tails/` : SPEC-0010 (champ `image` de `Airline` ajouté alors, sans retirer les champs existants).
- La typographie (instances statiques d'Archivo, graisses condensées), les rayons et mesures du handoff : SPEC-0005. L'ADR-0001 (« la spec du thème fixe… ») et `docs/factory/UI.md` les attribuaient à « la spec du thème » : à corriger par une PR `factory` qui renvoie à SPEC-0005 (note 7 de `specs/ROADMAP.md`).
- Le mode nuit (fond mélangé à 40 % de noir) : repoussé hors v0 (`docs/PRODUCT.md`). `airlineTheme` n'a pas de paramètre de nuit.
- Les couleurs dérivées du handoff que la v0 n'utilise pas (`tone`, `toneInk`, `pips`).
- Le placement de la dérive (position, ancrage, recadrage) : écrans de SPEC-0005 et SPEC-0006.
- La résolution par préfixe IATA (`AF1506`), les codes OACI de filiales et toute compagnie hors des huit du handoff : une compagnie de plus passe par une spec qui fournit ses couleurs.
- Les mentions légales (non-affiliation, crédits) : propriétaire, hors roadmap des agents.

## Contraintes
- `src/shared/airline-theme/index.ts` n'importe ni React Native ni React : il se charge sous Vitest (couverture et mutation). Le composant est dans `generic-tail.tsx`, seul fichier du module à importer `react-native` et `react-native-svg` (ADR-0001 : logique hors des composants).
- Module partagé et non feature : `scripts/gen-features.mjs` importe `feature` de chaque `src/features/*/index.ts` et le pager monte son `screen` ; une feature sans écran casserait le registre. Ciel et Passages importent le module par `src/shared/airline-theme/`.
- Dépendances : aucune nouvelle ; `react-native-svg` est imposée par l'ADR-0001. Aucune couleur n'est écrite dans un écran : elles viennent de ce module.
- Le calcul reste en nombres à virgule flottante comme `data.js` (pas de bibliothèque de couleur) ; la reproduction à l'identique est contrôlée par des valeurs de référence calculées avec `data.js`.
- Le handoff (`docs/brief/`) n'est ni importé ni embarqué.

## Questions ouvertes
Aucune.
