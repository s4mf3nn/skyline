# SPEC-0006 : Carrousel Prochains passages

Statut : BROUILLON
Risque estimé : élevé (crée `src/shared/adsb/demo.ts`, dans la zone sensible `**/shared/adsb/` de `docs/factory/RISK.md` : revue `full`, pas d'auto-merge ; la source de démonstration n'envoie rien, et l'écran ne lit la position que par `useScene` de SPEC-0004)
Dépend de : SPEC-0002, SPEC-0003, SPEC-0004
Tests de contrat : `tests/acceptance/SPEC-0006.test.ts` (Vitest), `tests/acceptance/SPEC-0006.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0006.test.ts` et `tests/holdout/SPEC-0006.native.test.tsx` (ne pas les décrire ici)

## Objectif
L'observateur ouvre Prochains passages et voit, carte par carte, l'avion qui le survole (« En ce moment ») puis les dix suivants : compte à rebours à la seconde, heure de passage, direction d'arrivée avec une flèche qui suit le téléphone, aux couleurs de la compagnie. Quand un compte à rebours atteint 00:00, la carte bascule en « En ce moment ». L'écran lit la scène de SPEC-0004 : il ne calcule aucun survol ni passage.

## Acteurs et rôles
Un seul rôle, l'observateur, sans compte (`docs/PRODUCT.md`). Il lit ; il n'y a aucune action exposée autre que le défilement vertical du carrousel.

## Critères d'acceptation
La logique pure vit dans `src/features/passages/service.ts` (sans import de React Native, jouée sous Vitest) ; l'écran, les composants et le `feature` sont rendus par `src/features/passages/index.ts`. La source de démonstration vit dans `src/shared/adsb/demo.ts`. Heures et durées s'entendent en millisecondes.

Logique pure (Vitest, `tests/acceptance/SPEC-0006.test.ts`) :

- **CA1** : `PASSAGES_METRICS` fixe les valeurs du handoff : carte de 650 pt de haut, espacement de 12 pt, pas de calage de 662 pt, marge latérale de 12 pt, rayon de 36 pt, `paddingTop` de 100 pt et `paddingBottom` de 200 pt.
- **CA2** : `formatCountdown(remainingMs)` rend `MM:SS` : le reste est arrondi **à la seconde supérieure** (`134_000` et `133_001` donnent `02:14`, `133_000` donne `02:13`, `1` donne `00:01`). Un reste nul ou négatif rend `00:00`. Les minutes ont au moins deux chiffres et ne sont pas plafonnées (`6_000_000` donne `100:00`).
- **CA3** : `formatLocalTime(timestampMs, timeZone)` rend l'heure locale `HH:MM` sur 24 h, zéros de tête, secondes tronquées, dans le fuseau IANA reçu (`1_800_000_000_000` donne `09:00` en `Europe/Paris`, `21:00` en `Pacific/Auckland`, `13:30` en `Asia/Kolkata`, `09:00` pour `1_800_000_059_999` en `Europe/Paris`).
- **CA4** : pour un passage dont la fenêtre dure de `passageTimeMs` à `windowEndMs`, `visibilityProgress(passage, nowMs)` rend `(nowMs − passageTimeMs) / (windowEndMs − passageTimeMs)` borné à [0, 1] (fenêtre de durée nulle : 1 dès `nowMs ≥ passageTimeMs`, sinon 0), et `visibilityRemainingMs(passage, nowMs)` rend `windowEndMs − nowMs` borné à 0 au minimum.
- **CA5** : `formatMetric(value)` rend `—` pour `null`, sinon la valeur arrondie à l'entier, avec une espace insécable (U+00A0) comme séparateur de milliers (`7850` donne `7 850`, `779.6` donne `780`, `0` donne `0`).
- **CA6** : `flightLabel(callsign, airline)` rend le vol en forme IATA : `—` pour `null` ou chaîne vide ; l'indicatif nettoyé (blancs de début et de fin retirés comme par `String.prototype.trim`, majuscules : `AFR 1506` reste inconnu, SPEC-0002 CA8) dont le préfixe OACI de trois lettres est remplacé par le premier code IATA de la compagnie quand l'indicatif suit la forme OACI (trois lettres puis un chiffre) et que `airline` a un code IATA (`AFR1506` pour Air France donne `AF1506`, `RUK7KM` pour Ryanair donne `FR7KM`) ; tout autre indicatif rendu nettoyé tel quel (`AF1506`, `ZZZ123` avec `UNKNOWN_AIRLINE`, `F-HBXA`).
- **CA7** : `buildCards({ scene, nowMs, headingDeg, timeZone })` rend un tableau de cartes dans l'ordre : la carte `overhead` d'abord si `scene.overhead` n'est pas `null`, puis une carte `upcoming` par passage de `scene.upcoming`, dans leur ordre. Chaque carte porte `kind`, `hex`, `airline` (`resolveAirline(callsign)`, SPEC-0002), `theme` (`airlineTheme(airline)`), `airlineName` (nom de la compagnie), `flightLabel` (CA6), `aircraftType` (toujours `—` : le type n'est pas fourni avant SPEC-0009), `altitude` et `speed` (CA5, vitesse arrondie en km/h). Une scène sans survol ni passage rend `[]`.
- **CA8** : une carte `upcoming` porte en plus `countdown` (`formatCountdown(passageTimeMs − nowMs)`), `passTime` (`formatLocalTime(passageTimeMs, timeZone)`), `cardinal` (`arrivalCardinal` du passage) et `arrowAngleDeg` (`arrowAngleDeg(arrivalBearingDeg, headingDeg)` de SPEC-0004, `null` quand le cap du téléphone est `null`) ; `visibility` y vaut `null`. La carte `overhead` porte `cardinal` (`trackCardinal`, le cap vers lequel l'avion repart), `arrowAngleDeg(trackDeg, headingDeg)` et `visibility = { progress, remaining }` (CA4, `remaining` formaté par `formatCountdown`) ; `countdown` et `passTime` y valent `null`.

Source de démonstration (Vitest, même fichier) :

- **CA9** : `createDemoAdsbSource(clock)` (`src/shared/adsb/demo.ts`) rend une `AdsbSource` qui ne lit l'heure que par l'horloge reçue (pas d'horloge directe). Pour une requête `{ latitude, longitude, radiusKm }` : la liste est la même pour deux appels à la même heure et change quand l'horloge avance ; chaque avion est à `radiusKm` ou moins de la position demandée ; les `hex` sont distincts ; chaque avion a une vitesse sol > 0, un cap et une altitude > 0. Passée à `computeScene` (SPEC-0004) avec l'observateur égal à la position demandée, `nowMs` égal à l'heure de la source et `takenAtMs` égal à `nowMs`, sur 20 minutes d'horloge échantillonnées toutes les 10 s à partir d'une heure quelconque : `upcoming` compte au moins 3 passages à chaque échantillon, et `overhead` est non nul à au moins un échantillon. Les indicatifs des avions résolvent (SPEC-0002) au moins trois compagnies connues et au moins une fois `UNKNOWN_AIRLINE`. `src/shared/adsb/index.ts` n'exporte pas `createDemoAdsbSource`.

Écran (Jest, `tests/acceptance/SPEC-0006.native.test.tsx`, joué par `createApp` avec les faux de `src/shared/`, sur le fichier de `feature` de `src/features/passages/index.ts`) :

- **CA10** : `src/features/passages/index.ts` exporte `feature` avec `name` `passages`, `order` 1 et un `screen` ; la feature n'a pas de crochet de présence (la page Prochains passages est toujours présente, INV9).
- **CA11** : l'écran rend un carrousel vertical (`testID` `passages-list`) de `snapToInterval` 662, `decelerationRate` `fast`, `disableIntervalMomentum` vrai, `paddingTop` 100 et `paddingBottom` 200 (valeurs de `PASSAGES_METRICS`) ; chaque carte est un élément de `testID` `passage-card-<hex>` qui porte sa hauteur (650 pt) et son fond (CA12).
- **CA12** : une carte de passage à venir affiche, aux couleurs de sa compagnie (fond `theme.bg` sur l'élément `passage-card-<hex>`, chiffres du compte à rebours en `theme.big`, libellés en `theme.small`), le compte à rebours `MM:SS` (CA2), « Passe à » et l'heure locale (CA3, fuseau de l'appareil), « Regardez » et le point cardinal d'arrivée, puis, en bas à droite, la colonne Compagnie, Vol, Appareil (CA6, `—` pour l'appareil). Le bloc codes et villes d'origine et de destination est absent (aucun élément `testID` `passage-route-<hex>`) : la route n'est fournie qu'avec SPEC-0009. La dérive générique de la compagnie (`AirlineTail`, SPEC-0002) est rendue en bas à gauche (`testID` `passage-tail-<hex>`).
- **CA13** : le compte à rebours de chaque carte visible se met à jour à chaque seconde d'horloge (INV4) : l'horloge avancée de 1 s, `02:14` devient `02:13`, sans nouvelle requête à la source ADS-B ; il se corrige à un rafraîchissement.
- **CA14** : quand `nowMs` atteint le `passageTimeMs` d'un avion éligible au survol (INV1), sa carte à venir disparaît et la carte « En ce moment » de cet avion apparaît en tête du carrousel ; aucune carte ne montre un compte à rebours négatif ni `00:00`.
- **CA15** : la carte « En ce moment » affiche, aux couleurs de la compagnie, « Au-dessus de vous », « EN CE » et « MOMENT » sur deux lignes, une jauge de visibilité (élément de rôle `progressbar` nommé « Visibilité », valeur de 0 à 100 égale à `round(100 × progress)`), « Visible encore » et le temps restant (`MM:SS`), puis Altitude, Vitesse et Direction (point cardinal du cap et flèche) et la colonne Compagnie, Vol, Appareil de CA12. Elle n'a ni compte à rebours, ni « Passe à ».
- **CA16** : la flèche d'une carte (`testID` `passage-arrow-<hex>`, élément décoratif : sans `accessibilityLabel`, avec `accessibilityElementsHidden` vrai et `importantForAccessibility` `no-hide-descendants`) est tournée de `arrowAngleDeg` degrés (transformation `rotate`) et suit le cap du téléphone : un nouveau cap du téléphone la fait tourner sans nouvelle requête. Tant que le cap du téléphone est inconnu, aucune flèche n'est rendue ; le point cardinal reste affiché.
- **CA17** : à un rafraîchissement de la source (`refresh()` de `useScene`, SPEC-0004) les cartes suivent la nouvelle scène : un passage retiré disparaît, un nouveau apparaît à sa place dans l'ordre des heures, une carte qui change de rang garde son `testID` (le `hex` est la clé de la liste) ; la liste peut virtualiser ses cartes ; il n'y a jamais plus de 11 cartes (1 survol et 10 passages).
- **CA18** : sans scène prête (chargement, localisation refusée, source indisponible sans instantané antérieur) ou avec une scène vide, le carrousel ne rend aucune carte et l'écran ne plante pas ; les textes et boutons de ces états sont à SPEC-0008. Avec un instantané antérieur et une source qui échoue, les cartes de la dernière scène restent et leur compte à rebours continue (CA17 de SPEC-0004).
- **CA19** : (INV7) l'écran n'envoie rien au suivi des erreurs (`monitoring.events` reste vide) et n'écrit rien dans les logs (`console.log`, `info`, `warn`, `error`) pendant un parcours complet (chargement, ticks, bascule, rafraîchissement).

## Cas limites
- Les heures affichées suivent celles de SPEC-0004, à ±1 s : les tests de contrat placent les entrées et fins de fenêtre à mi-seconde pour qu'aucune implémentation conforme ne bascule d'un affichage à l'autre.
- Compte à rebours de 100 minutes ou plus (avion lent) : `100:00`, pas de plafond (CA2).
- Avion sans indicatif ou d'une compagnie inconnue : `UNKNOWN_AIRLINE` (INV8), vol `—` ou indicatif brut (CA6), nom « Inconnue ».
- Altitude `null` : `—` (CA5).
- Cap du téléphone inconnu : carte complète, flèche seule masquée (CA16).
- Deux passages à la même heure : ordre de SPEC-0004 (`hex` croissant), jamais réordonné par l'écran.
- Plus de 10 passages dans l'instantané : l'écran ne rend que les 10 que la scène lui donne.
- Survol qui se termine : la carte « En ce moment » est retirée sans animation ; les cartes suivantes remontent (le décalage de l'offset de défilement relève de l'écran, hors contrat).
- Avion retenu par Ciel (INV9) : pas de carte sur Passages, c'est un état de Ciel.
- Changement de page par le pager : l'écran reste monté, ses comptes à rebours continuent (SPEC-0003).
- Heure de passage dans un fuseau à décalage de 30 minutes : `formatLocalTime` rend les minutes locales (CA3).
- Instantané en retard ou source indisponible : relève de SPEC-0004 (CA17) et SPEC-0008.

## Contrat d'interface
`src/features/passages/service.ts` (logique pure ; seuls imports : `src/shared/airlines/index.ts`, `src/shared/scene/index.ts` et `src/shared/format/index.ts`). `formatMetric` et `flightLabel` sont définies dans `src/shared/format/index.ts` (SPEC-0005, CA18) et ré-exportées par `service.ts`, avec la même signature :

```ts
type CardKind = "overhead" | "upcoming"

interface PassagesMetrics {
  cardHeightPt: number        // 650
  gapPt: number               // 12
  snapIntervalPt: number      // 662
  marginHorizontalPt: number  // 12
  cardRadiusPt: number        // 36
  paddingTopPt: number        // 100
  paddingBottomPt: number     // 200
}

interface PassageCard {
  kind: CardKind
  hex: string
  airline: Airline               // SPEC-0002
  theme: AirlineTheme            // SPEC-0002
  airlineName: string
  flightLabel: string
  aircraftType: string           // "—" avant SPEC-0009
  altitude: string               // formatMetric, mètres
  speed: string                  // formatMetric, km/h
  cardinal: CardinalPoint        // SPEC-0004
  arrowAngleDeg: number | null
  countdown: string | null       // upcoming seulement, "MM:SS"
  passTime: string | null        // upcoming seulement, "HH:MM"
  visibility: { progress: number; remaining: string } | null   // overhead seulement
}

PASSAGES_METRICS: PassagesMetrics
formatCountdown(remainingMs: number): string
formatLocalTime(timestampMs: number, timeZone: string): string
visibilityProgress(passage: Pick<Passage, "passageTimeMs" | "windowEndMs">, nowMs: number): number
visibilityRemainingMs(passage: Pick<Passage, "passageTimeMs" | "windowEndMs">, nowMs: number): number
formatMetric(value: number | null): string
flightLabel(callsign: string | null, airline: Airline): string
buildCards(input: { scene: Scene; nowMs: number; headingDeg: number | null; timeZone: string }): PassageCard[]
```

`src/features/passages/index.ts` : ré-exporte `flightLabel` et `formatMetric` (interface publique de la logique pour les autres features, dont Ciel) et `export const feature: Feature` (`{ name: "passages", order: 1, screen: PassagesScreen }`). L'écran lit `useScene()` (SPEC-0004) et passe à `buildCards` le fuseau de l'appareil (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

`src/shared/adsb/demo.ts` : `createDemoAdsbSource(clock: Clock): AdsbSource`. Non réexportée par `src/shared/adsb/index.ts`.

## Écrans
- **Prochains passages** : pas de maquette dédiée (décision du propriétaire du 2026-10-13) : le handoff fait foi (`docs/brief/design_handoff_skyline_ciel_passages/README.md`, section « Écran 2 », captures `03-passages-en-ce-moment.png`, `04-passages-prochain.png`, `05-passages-suivant.png`). Les écarts décidés par le propriétaire (route absente, appareil `—`, flèche masquée sans cap) priment sur le handoff.
  - États : liste de cartes (CA12, CA15) ; « sans carte » pour chargement, refus, indisponible et scène vide (CA18) ; les textes de ces états sont à SPEC-0008.
  - Actions : défilement vertical calé carte par carte ; aucun tap.
  - Fond de l'écran : token `ground` (`#0C0C0C`), non testé (classe de style, vérifié par la capture sur cible réelle).
  - Typographie Archivo, `fontVariant: ["tabular-nums"]` pour les comptes à rebours ; les largeurs condensées sont celles de la spec du thème (SPEC-0002) ; les tailles du handoff (150 pt, 48 pt, 64 pt, 104 pt) ne sont pas testées : vérifiées par la capture du parcours sur cible réelle.

## Parcours sur cible réelle
- Sur simulateur iPhone (393 × 852 pt), le carrousel cale une carte à la fois, laisse voir environ 90 pt de la carte précédente et de la suivante, les comptes à rebours défilent à la seconde sans saccade et la bascule en « En ce moment » se produit à 00:00 ; la flèche suit la rotation du téléphone. Vérifié à la main dans la PR de la dernière tâche (capture jointe) : ni le calage ni la fluidité ne sont joués sous Jest.

## Hors périmètre
- Écran Ciel et présence de Ciel (SPEC-0005).
- Source ADS-B réelle, validation de la réponse, minuteur de 10 s, pause en arrière-plan (SPEC-0007).
- États de chargement, refus de localisation, hors ligne, aucun passage prévu, données périmées, textes et bouton vers les réglages (SPEC-0008).
- Codes et villes d'origine et de destination, heures de vol, progression, type d'appareil (SPEC-0009).
- Images de dérive réelles (SPEC-0010).
- Mode nuit, tap sur une carte, partage (MVP).

## Contraintes
- Aucun calcul dans un `.tsx` (`docs/factory/UI.md`) : formats, ordre, flèche et jauge viennent de `service.ts`. L'écran ne recalcule aucun survol ni passage (INV1) : il lit `useScene`.
- Les comptes à rebours se mettent à jour par seconde sans re-rendre toute la liste (un composant de compte à rebours par carte visible, ou une valeur partagée Reanimated) : exigence du brief, vérifiée par la relecture et sur cible réelle, pas par un test automatisé.
- La source de démonstration n'est branchée que sous `__DEV__` (`src/main.tsx`) : jamais dans un build livré ; en production la source reste celle de SPEC-0000 jusqu'à SPEC-0007. Elle n'est pas importée par `src/shared/adsb/index.ts`.
- Aucune dépendance nouvelle : `FlatList`, Reanimated et `react-native-svg` sont dans l'ADR-0001.
- Aucune position, ni coordonnée, ni cap n'est loggé ni envoyé au suivi des erreurs (INV7, CA19).

## Décisions prises à la rédaction
À confirmer à la relecture :
- Source de démonstration définie ici (réponse du propriétaire) ; SPEC-0005 la réutilise et en dépend (roadmap amendée dans cette PR).
- Champs sans donnée avant SPEC-0009 : bloc route masqué, appareil `—` (réponse du propriétaire).
- Cap du téléphone inconnu : flèche masquée, point cardinal conservé (réponse du propriétaire).
- États sans carte : rien n'est affiché, textes à SPEC-0008 (réponse du propriétaire).
- Compte à rebours arrondi à la seconde supérieure : `00:00` n'est jamais affiché sur une carte à venir, la bascule se produit quand il l'atteindrait (le brief : « à 00:00, la carte bascule »).
- Heure de passage en 24 h, fuseau de l'appareil, secondes tronquées ; vol en forme IATA par le premier code IATA de la compagnie ; milliers séparés par une espace insécable.
- Jauge de visibilité : de l'entrée dans la fenêtre à sa fin, 100 % en fin de fenêtre ; nom accessible « Visibilité ».
- Page Prochains passages d'`order` 1, toujours présente.
- `flightLabel` et `formatMetric` vivent dans `src/shared/format/index.ts` (SPEC-0005, CA18) : Ciel ne peut pas importer l'`index.ts` de Passages sous Vitest. `service.ts` les ré-exporte, donc le contrat de test de cette spec ne change pas (voir « Contrat d'interface »).

## Questions ouvertes
Aucune.
