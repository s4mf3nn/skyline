# SPEC-0002 : Thème et table des compagnies

Statut : BROUILLON
Risque estimé : faible (logique pure, aucune entrée utilisateur, aucune zone sensible)
Dépend de : SPEC-0000
Tests de contrat : `tests/acceptance/SPEC-0002.test.ts` (Vitest)
Scénarios cachés : `tests/holdout/SPEC-0002.test.ts` (ne pas les décrire ici)

## Objectif
Donner à Ciel et à Prochains passages une seule source des couleurs de compagnie : à partir de l'indicatif d'un avion, retrouver sa compagnie, calculer son thème lisible (règle de contraste du handoff, reprise à l'identique) et disposer d'une dérive générique SVG à ses couleurs. Les écrans qui suivent n'ont plus qu'à consommer ce module.

## Acteurs et rôles
Aucun rôle (module sans action exposée).

## Critères d'acceptation
Le module vit dans `src/shared/airlines/` : il est lu par deux features (Ciel, Passages), il ne peut donc pas appartenir à l'une d'elles ni être une feature (une feature exporte un écran, `docs/adr/0001-stack.md`).

- **CA1** : `mix(a, b, t)`, pour `t` dans [0, 1], reproduit `mix()` de `docs/brief/design_handoff_skyline_ciel_passages/data.js` : interpolation canal par canal de `a` vers `b`, arrondie à l'entier, rendue en `#RRGGBB` majuscules. `t = 0` rend `a` (normalisé en majuscules), `t = 1` rend `b`.
- **CA2** : `contrastRatio(a, b)` rend le rapport de contraste WCAG 2.x entre deux couleurs (luminance relative avec le seuil `0.03928` du handoff, `(L clair + 0,05) / (L sombre + 0,05)`), symétrique, de 1 à 21.
- **CA3** : `fit(fg, bg, target)` reproduit `fit()` du handoff : rend `fg` inchangé si son contraste avec `bg` atteint `target` ; sinon essaie, pour `t` partant de 0,02 et augmenté de 0,02 par addition flottante tant que `t <= 0.6001` (accumulation de `data.js`, pas `k × 0,02`), d'abord `mix(fg, blanc, t)` puis `mix(fg, noir, t)` et rend le premier qui atteint `target` ; sinon rend `#F4F1EA` ou `#1D1D1B`, celui qui contraste le mieux avec `bg` (`#1D1D1B` à égalité).
- **CA4** : `airlineTheme(airline)` rend `{ bg, big, small, track }` avec `bg` = primaire de la compagnie, `big = fit(secondaire, bg, 3)`, `small = fit(secondaire, bg, 4.5)`, `track = mix(bg, small, 0.3)` (INV5). Une couleur invalide dans la compagnie reçue lève `INVALID_COLOR`. Pour toute compagnie de la table, `big` a un contraste d'au moins 3:1 et `small` d'au moins 4,5:1 avec `bg`.
- **CA5** : la table `AIRLINES` contient exactement les 145 compagnies du catalogue `airlines-scraper`, dans son ordre, avec leur nom et leurs codes IATA et OACI vérifiés (principal en premier) ; l'instantané du catalogue au 2026-10-13 est versionné avec le contrat (`tests/acceptance/SPEC-0002.catalogue.json`) et fait foi. Les couleurs primaire et secondaire, le pays et la palette de dérive sont ceux de `data.js` pour les huit compagnies du handoff : Iberia, Air France, easyJet, Lufthansa, KLM, Ryanair, Vueling, TAP Air Portugal (le nom du handoff l'emporte sur celui du catalogue). Les autres compagnies prennent les couleurs et la palette d'`UNKNOWN_AIRLINE` et un pays `null` jusqu'à ce que le propriétaire les renseigne ; elles gardent leur nom et leurs codes. Aucune couleur n'est inventée (INV8).
- **CA6** : `UNKNOWN_AIRLINE` est l'entrée `xx` du handoff (nom « Inconnue », pays « France » comme dans `data.js`, primaire `#1D1D1B`, secondaire `#F2E8D5`, dérive `#CFC8BA` avec une bande `#1D1D1B`), sans code IATA ni OACI.
- **CA7** : `resolveAirline(callsign)` rend l'entrée de la table (même référence) de la compagnie de l'indicatif : l'indicatif est nettoyé (blancs de début et de fin retirés comme par `String.prototype.trim`, majuscules), puis une compagnie est cherchée par le préfixe OACI (trois lettres suivies d'un chiffre ; tout ce qui suit ce chiffre est ignoré), à défaut par la forme IATA : deux caractères alphanumériques suivis de 1 à 4 chiffres et de rien d'autre. Lettres et chiffres s'entendent en ASCII (`A`-`Z`, `0`-`9`), après mise en majuscules. `AFR1506` et `AF1506` donnent Air France, `U24617` donne easyJet, `RK44` donne Ryanair, `afr1506 ` et `RUK7KM` donnent Air France et Ryanair.
- **CA8** : tout indicatif sans compagnie connue donne `UNKNOWN_AIRLINE` (même référence) : `null`, chaîne vide, indicatif sans chiffre après le préfixe (`AFR`), préfixe absent de la table (`ZZZ123`), immatriculation, avec ou sans tiret (`F-HBXA`, `FHBXA`, `N123AB`, `N3456A` : `N3` est un code IATA du catalogue, mais la forme IATA exige des chiffres jusqu'au bout), espace entre le préfixe et le premier chiffre (`AFR 1506`). `resolveAirline` ne lève jamais (INV8).

## Livrable hors contrat
Le composant `AirlineTail` (`src/shared/airlines/tail.tsx`) dessine la dérive générique du handoff (`Fin.dc.html`, gabarit 300 × 440) en miroir horizontal, orientée vers la gauche, avec la palette reçue : base, jusqu'à deux bandes et un disque facultatifs. Il n'a pas de test de contrat (décision du propriétaire du 2026-10-13) : la tâche qui le pose joint une capture sur simulateur, et la spec de l'écran Ciel le compare aux captures du handoff.

## Cas limites
- Couleur qui n'est pas `#RRGGBB` (`rouge`, `#FFF`, chaîne vide) passée à `mix`, `contrastRatio` ou `fit` : erreur typée `INVALID_COLOR` (`src/shared/errors.ts`), jamais un résultat `NaN`. La casse minuscule est acceptée.
- Contraste insoluble (primaire et secondaire identiques) : repli crème ou encre de CA3.
- Secondaire déjà lisible : rendue inchangée, minuscules d'entrée comprises.
- Cible de contraste pile atteinte : la couleur est conservée (comparaison `>=`).
- Repli crème ou encre : c'est le meilleur des deux, pas une garantie d'atteindre la cible.
- `t` hors de [0, 1] dans `mix` : hors contrat (aucun appel du module ne le fait).
- Indicatif à deux lettres seulement, ou dont les trois premières lettres sont une compagnie mais sans chiffre : `UNKNOWN_AIRLINE`.
- Code IATA d'une compagnie égal aux deux premières lettres de l'OACI d'une autre (`AC` et `ACI`) : pas d'ambiguïté, la troisième position est une lettre pour l'OACI et un chiffre pour l'IATA.
- Deux compagnies ne partagent aucun code IATA ni OACI (la table est contrôlée par le test).

## Contrat d'interface
Point d'entrée : `src/shared/airlines/index.ts` (logique pure, sans import de React Native, jouée sous Vitest).

```ts
interface TailPalette {
  base: string                 // couleur de la dérive, #RRGGBB
  stripe1: string | null       // première bande, null si absente
  stripe2: string | null       // seconde bande, null si absente
  disc: string | null          // disque, null si absent
}
interface Airline {
  code: string                 // OACI principal en majuscules (`AFR`), `xx` pour UNKNOWN_AIRLINE
  name: string
  country: string | null       // en français, null tant que non renseigné
  primary: string              // fond, #RRGGBB
  secondary: string            // texte, #RRGGBB, avant correction par fit()
  iata: readonly string[]      // ex. ["U2", "EC", "DS"]
  icao: readonly string[]      // ex. ["EZY", "EJU", "EZS"]
  tail: TailPalette
}
interface AirlineTheme { bg: string; big: string; small: string; track: string }

AIRLINES: readonly Airline[]
UNKNOWN_AIRLINE: Airline
mix(a: string, b: string, t: number): string
contrastRatio(a: string, b: string): number
fit(fg: string, bg: string, target: number): string
airlineTheme(airline: Airline): AirlineTheme
resolveAirline(callsign: string | null): Airline
```

`src/shared/airlines/tail.tsx` : `AirlineTail({ palette, width, height }: { palette: TailPalette; width: number; height: number }): ReactElement`, dessiné avec `react-native-svg` (ADR-0001). Les couleurs du handoff sont des données de la table, pas des valeurs de style (ADR-0001, « Style »).

## Hors périmètre
- Mode nuit (`theme(k, night)` du handoff, `tone`, `toneInk`, `pips`) : repoussé hors v0 (`docs/PRODUCT.md`).
- Images de dérive (`assets/tails/`), autorisation et crédits : SPEC-0010.
- Couleurs et pays des 137 compagnies sans palette dans le handoff : renseignés plus tard par le propriétaire, par amendement de cette spec.
- Écrans Ciel et Prochains passages, typographie Archivo, compagnie issue de la route de vol (adsbdb, SPEC-0009).
- Mentions légales (non-affiliation, crédits).

## Contraintes
- Fonctions pures et déterministes, sans horloge ni réseau ; aucune dépendance nouvelle (`react-native-svg` est dans l'ADR-0001).
- Reproduction à l'identique de `fit()`/`mix()` : seuils, pas de 0,02 jusqu'à 0,60 et ordre clair puis sombre, y compris l'arrondi du handoff.
- La table est écrite en TypeScript dans le module ; le catalogue `airlines-scraper` n'est pas une dépendance d'exécution.

## Questions ouvertes
Aucune. Pays `null` des 137 compagnies hors handoff et emplacement dans `src/shared/airlines/` (roadmap amendée dans cette PR) : décisions du propriétaire du 2026-10-13.
