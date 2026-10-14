# SPEC-0005 : Écran Ciel et présence de Ciel dans le pager

Statut : BROUILLON
Risque estimé : moyen (nouvelle feature `src/features/ciel/`, aucune zone sensible ; l'écran lit la position uniquement par `useScene` de SPEC-0004 et n'envoie rien)
Dépend de : SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0006
Tests de contrat : `tests/acceptance/SPEC-0005.test.ts` (Vitest), `tests/acceptance/SPEC-0005.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0005.test.ts` et `tests/holdout/SPEC-0005.native.test.tsx` (ne pas les décrire ici)

## Objectif
Quand un avion survole l'observateur, une page Ciel apparaît à gauche de Prochains passages : plein écran aux couleurs de la compagnie, elle donne en un coup d'œil sa vitesse, son altitude, son cap en point cardinal, sa compagnie et son vol. Ciel n'existe que s'il a un avion à montrer (le survol en cours, ou l'avion retenu après la fin du survol tant que l'observateur reste sur Ciel, INV9) ; l'app s'ouvre toujours sur Prochains passages. L'écran lit la scène de SPEC-0004 : il ne calcule aucun survol.

## Acteurs et rôles
Un seul rôle, l'observateur, sans compte (`docs/PRODUCT.md`). Il lit ; la seule action est le glissement entre Ciel et Prochains passages, porté par le pager (SPEC-0003). Aucun refus applicable.

## Critères d'acceptation
La logique pure vit dans `src/features/ciel/service.ts` (sans import de React Native, jouée sous Vitest) ; l'écran, le crochet de présence et le `feature` sont rendus par `src/features/ciel/index.ts`. Heures et durées s'entendent en millisecondes.

Logique pure (Vitest, `tests/acceptance/SPEC-0005.test.ts`) :

- **CA1** : `CIEL_METRICS` fixe les valeurs du handoff : colonne d'infos à `right` 24 pt, `top` 448 pt, espacement 10 pt ; libellé de 13 pt à 70 % d'opacité ; valeur de 40 pt ; dérive générique de 272 × 399 pt à `left` −60 pt.
- **CA2** : `buildSkyView(passage)` rend la vue de l'avion montré : `hex`, `airline` (`resolveAirline(callsign)`, SPEC-0002), `theme` (`airlineTheme(airline)`) et `rows`, les six lignes dans l'ordre `speed` « Vitesse », `altitude` « Altitude », `heading` « Cap », `airline` « Compagnie », `flight` « Vol », `aircraft` « Appareil ». Valeurs : `formatMetric(groundSpeedKmh)` (km/h arrondis), `formatMetric(altitudeM)` (mètres), `trackCardinal` du passage (le cap de l'avion, pas le gisement d'arrivée), le nom de la compagnie, `flightLabel(callsign, airline)` (SPEC-0006 CA6) et `—` pour l'appareil (non fourni avant SPEC-0009). Aucune unité dans les valeurs. Indicatif absent : compagnie « Inconnue » (`UNKNOWN_AIRLINE`, INV8) et vol `—`.
- **CA3** : `nextSkyState({ previous, scene, denied, displayedPage })` rend le nouvel état de Ciel, `{ presence: "absent" | "survol" | "retenu", passage: Passage | null }` (`passage` est `null` si et seulement si `presence` vaut `absent`). La première règle qui s'applique l'emporte : (1) `denied` vrai : `absent` ; (2) `scene.overhead` non nul : `survol` sur ce passage, quel que soit l'état précédent et la page affichée ; (3) `previous.passage` nul : `absent` (aucun avion n'est retenu s'il n'a pas été montré) ; (4) `displayedPage` vaut `"passages"` : `absent` ; (5) l'`hex` de `previous.passage` figure dans `scene.upcoming` : `absent` ; (6) sinon `retenu` sur `previous.passage`, valeurs inchangées (le même objet).
- **CA4** : `nextSkyState` suit le cycle « Page Ciel » de `docs/DOMAIN.md` : lancement sans survol rend `absent` ; un survol qui commence, ou qui change d'avion, rend `survol` sur le nouvel avion ; un survol qui se termine pendant que Ciel est la page affichée rend `retenu` ; pendant que Prochains passages l'est, `absent` ; un avion retenu devient `absent` dès que Prochains passages est la page affichée (glissement vers Prochains passages) ou dès qu'il redevient un passage à venir ; un survol qui commence à l'instant où le précédent se termine rend `survol` (le nouvel avion, jamais `retenu`).
- **CA5** : `nextSkyState` avec `scene` à `null` (chargement, source indisponible sans instantané antérieur) ne crée ni ne retire rien : `absent` reste `absent` ; un état `retenu` ou `survol` devient ou reste `retenu` si Ciel est la page affichée, et devient `absent` si Prochains passages l'est (règle 4 de CA3) ; avec `denied` vrai tout est effacé (règle 1 de CA3). La fonction ne modifie pas ses entrées et ne lit aucune horloge.

Écran et présence (Jest, `tests/acceptance/SPEC-0005.native.test.tsx`, joués par `createApp` avec les faux de `src/shared/`, sur les fichiers de `feature` de `src/features/ciel/index.ts` et de `src/features/passages/index.ts`) :

- **CA6** : `src/features/ciel/index.ts` exporte `feature` avec `name` `ciel`, `order` 0, un `screen` et un crochet facultatif `presence(displayedPage)` (`displayedPage` : `"ciel"` ou `"passages"`) qui rend vrai quand Ciel doit être une page du pager. Le pager l'appelle même quand l'écran n'est pas monté.
- **CA7** : sans survol (scène vide, chargement, localisation refusée, source indisponible), l'application n'a qu'une page : Prochains passages seule, sans indicateur de page (aucun élément nommé « Indicateur de page ») ni écran Ciel monté (aucun `testID` `sky-screen`) ; elle s'ouvre sur Prochains passages.
- **CA8** : quand un survol commence, Ciel apparaît à gauche de Prochains passages (l'indicateur de page apparaît, valeur « Page 2 sur 2 ») et la page affichée reste Prochains passages ; Ciel affiche l'avion de la carte « En ce moment » (INV1, même `hex`, même compagnie). L'observateur la rejoint par l'action `decrement` de l'indicateur (valeur « Page 1 sur 2 »).
- **CA9** : l'écran (`testID` `sky-screen`) a pour fond `theme.bg` de la compagnie survolante et rend, pour chaque ligne de CA2, un libellé (`testID` `sky-label-<key>`, couleur `theme.big`, opacité 0,7) et une valeur (`testID` `sky-value-<key>`, couleur `theme.big`) ; les libellés sont « Vitesse », « Altitude », « Cap », « Compagnie », « Vol », « Appareil » et la valeur de l'appareil est `—`. La dérive générique de la compagnie (`AirlineTail`, SPEC-0002) est rendue (`testID` `sky-tail`).
- **CA10** : Ciel n'a ni flèche de direction ni bloc route : aucun élément dont le `testID` commence par `sky-arrow`, `sky-route`, `sky-progress`, `sky-codes` ou `sky-delay`, quel que soit le cap du téléphone ; aucun texte de forme `M:SS` ou `MM:SS` dans l'écran (pas de délai avant le prochain passage) (décisions du propriétaire du 2026-10-13).
- **CA11** : l'indicateur de page prend, tant que Ciel est la page affichée, la couleur `theme.small` de la compagnie montrée (`usePagerAccent`, SPEC-0003) ; elle change avec la compagnie quand un autre avion devient le survol en cours (deux compagnies de couleurs `small` différentes) ; crème sur Prochains passages.
- **CA12** : quand le survol se termine pendant que Ciel est la page affichée, Ciel reste, montre le même avion avec ses dernières valeurs et sa compagnie (avion retenu) ; il n'y a plus de carte « En ce moment » ; les valeurs ne changent plus aux ticks suivants, y compris après un passage en arrière-plan et retour au premier plan. L'écran de l'avion retenu a exactement les mêmes éléments (`testID`) que celui d'un survol : aucun libellé ni élément n'est ajouté ou retiré.
- **CA13** : un avion retenu s'efface quand l'observateur glisse vers Prochains passages : Ciel est retirée à la fin de la transition (380 ms), l'indicateur disparaît. Pendant la transition, l'écran continue d'afficher l'avion et ses valeurs : le crochet garde l'avion affiché, distinct de l'état de présence, jusqu'au retrait effectif de la page. Si un nouveau survol commence avant la fin de la transition, Ciel reste et montre le nouvel avion, la page affichée reste Prochains passages.
- **CA14** : quand le survol se termine pendant que Prochains passages est la page affichée, Ciel est retiré aussitôt, sans changement de la page affichée.
- **CA15** : quand Ciel est la page affichée et qu'elle est retirée parce que l'avion retenu redevient un passage à venir (virage puis nouvelle prévision, constatés à un rafraîchissement), la bande passe à Prochains passages par la transition du pager. Une permission refusée efface l'avion et retire Ciel (règle 1 de CA3, jouée sous Vitest : le faux de localisation ne permet pas de la retirer en cours d'usage) ; refusée dès le lancement, Ciel est absente et l'app est sur Prochains passages (CA7).
- **CA16** : (INV7) l'écran et le crochet n'envoient rien au suivi des erreurs (`monitoring.events` reste vide) et n'écrivent rien dans les logs (`console.log`, `info`, `warn`, `error`) pendant un parcours complet (apparition, retenue, retrait).
- **CA17** : l'état de présence est propre à chaque application (`createApp`) : deux applications créées l'une après l'autre dans un même test ne partagent ni avion retenu ni présence.
- **CA18** : `src/shared/format/index.ts` exporte `flightLabel` et `formatMetric`, au comportement de SPEC-0006 CA5 et CA6 ; `src/features/passages/service.ts` les ré-exporte (le contrat de SPEC-0006 ne change pas) et Ciel les importe de `src/shared/format/index.ts`.

## Cas limites
- Survol qui dure moins d'une seconde d'écran (début et fin entre deux ticks) : Ciel peut ne jamais apparaître ; aucun état intermédiaire n'est inventé.
- Deux survols consécutifs (A se termine à l'instant où B commence) : Ciel passe de A à B sans repasser par `retenu` (CA4).
- Avion retenu qui redevient le survol en cours : `survol` (règle 2 de CA3) ; s'il redevient un passage à venir, Ciel est retiré (règle 5).
- Données périmées : comptent comme à jour, Ciel suit la scène calculée sur les dernières données (INV9).
- Avion sans compagnie connue : `UNKNOWN_AIRLINE`, dérive générique (INV8) ; altitude inconnue : `—` (SPEC-0006 CA5).
- Cap du téléphone inconnu ou changeant : sans effet sur Ciel (pas de flèche).
- Passage en arrière-plan : aucun tick ; au retour, les valeurs retenues sont inchangées (CA12).
- Changement de compagnie entre deux survols : l'accent de l'indicateur suit sans transition de couleur imposée par cette spec.

## Contrat d'interface
`src/features/ciel/service.ts` (logique pure ; seuls imports : `src/shared/airlines/index.ts`, `src/shared/scene/index.ts` et `src/shared/format/index.ts`, voir CA18) :

```ts
type SkyPage = "ciel" | "passages"
type SkyPresence = "absent" | "survol" | "retenu"
type SkyRowKey = "speed" | "altitude" | "heading" | "airline" | "flight" | "aircraft"

interface SkyState { presence: SkyPresence; passage: Passage | null }   // Passage de SPEC-0004
interface SkyRow { key: SkyRowKey; label: string; value: string }
interface SkyView { hex: string; airline: Airline; theme: AirlineTheme; rows: readonly SkyRow[] }

CIEL_METRICS: {
  infoColumnRightPt: number       // 24
  infoColumnTopPt: number         // 448
  infoColumnGapPt: number         // 10
  labelSizePt: number             // 13
  labelOpacity: number            // 0.7
  valueSizePt: number             // 40
  tailWidthPt: number             // 272
  tailHeightPt: number            // 399
  tailLeftPt: number              // -60
}
SKY_ABSENT: SkyState
buildSkyView(passage: Passage): SkyView
nextSkyState(input: {
  previous: SkyState
  scene: Scene | null
  denied: boolean
  displayedPage: SkyPage
}): SkyState
```

`src/shared/format/index.ts` : `flightLabel(callsign: string | null, airline: Airline): string` et `formatMetric(value: number | null): string` (SPEC-0006 CA5 et CA6, déplacées ici).

`src/features/ciel/index.ts` : `export const feature: Feature & { presence?: (displayedPage: SkyPage) => boolean }` (`{ name: "ciel", order: 0, screen: SkyScreen, presence }`). `presence` est un crochet React : il lit `useScene()` (SPEC-0004), applique `nextSkyState`, garde l'état par application hors de l'écran (jamais dans l'écran, qui peut être démonté) et le met à disposition de l'écran, qui appelle `usePagerAccent(theme.small)`.

## Écrans
- **Ciel** : pas de maquette dédiée (décision du propriétaire du 2026-10-13) : le handoff fait foi (`docs/brief/design_handoff_skyline_ciel_passages/README.md`, section « Écran 1 », captures `01-ciel-iberia.png` et `02-ciel-air-france.png`). Les écarts décidés par le propriétaire priment : pas de flèche, bloc route masqué (codes, villes, heures, progression), appareil `—`.
  - États : avion montré (survol ou retenu, indiscernables) ; il n'y a ni chargement, ni vide, ni erreur : sans avion, Ciel n'est pas une page (INV9) et ces états relèvent de Prochains passages (SPEC-0008).
  - Actions : aucune sur l'écran (pas de tap de démonstration) ; le glissement est celui du pager.
  - Disposition : fond plein écran `theme.bg`, texte `theme.big`, colonne d'infos alignée à droite à `top` 448 (position du handoff, le haut de l'écran reste vide jusqu'à SPEC-0009), dérive générique en bas à gauche sous la colonne, indicateur d'accueil du handoff porté par le pager. Les mesures (CA1) sont testées, la position et les tailles de police sont vérifiées par la capture sur cible réelle.
  - Typographie : Archivo, `fontVariant: ["tabular-nums"]` ; les instances et largeurs condensées sont celles de la spec du thème (SPEC-0002), non testées ici.

## Parcours sur cible réelle
- Sur simulateur iPhone (393 × 852 pt) avec la source de démonstration : Ciel apparaît à gauche sans changer la page affichée, le glissement vers la droite l'ouvre aux couleurs de la compagnie, la colonne d'infos est à `top` 448, la dérive est collée en bas à gauche ; le survol fini, Ciel retient l'avion tant qu'on y reste et disparaît au glissement vers Prochains passages. Vérifié à la main dans la PR de la dernière tâche (capture jointe).

## Hors périmètre
- Flèche de direction, codes et villes, heures de départ et d'arrivée, progression du vol, type d'appareil (SPEC-0009).
- Images de dérive réelles (SPEC-0010) ; typographie Archivo : instances et chargement posés par la spec du thème.
- États de chargement, localisation refusée, hors ligne, données périmées et leurs textes (SPEC-0008).
- Source ADS-B réelle et minuteur de 10 s (SPEC-0007) ; la source de démonstration est celle de SPEC-0006.
- Tap, partage, mode nuit, transition de couleur d'une compagnie à l'autre.
- Le geste, les 380 ms et le retrait d'une page par le pager : SPEC-0003 (amendement attendu, voir « Décisions »).

## Contraintes
- Aucun calcul dans un `.tsx` (`docs/factory/UI.md`) : formats, vue et présence viennent de `service.ts`. L'écran ne recalcule aucun survol (INV1) : il lit `useScene`, comme Passages.
- Aucune dépendance nouvelle : Reanimated, `react-native-svg` et le pager sont dans l'ADR-0001.
- Aucune position, coordonnée ni cap n'est loggé ni envoyé au suivi des erreurs (INV7, CA16).
- La source de démonstration n'est branchée que sous `__DEV__` (SPEC-0006) : Ciel n'a donc aucun avion à montrer dans un build livré avant SPEC-0007.

## Décisions prises à la rédaction
À confirmer à la relecture :
- **Prérequis non fusionnés** : les amendements de SPEC-0003 (page absente, crochet de présence appelé par le pager avec la page affichée) et de SPEC-0004 (une seule scène partagée, INV1) exigés par la roadmap avant `/new-spec SPEC-0005` ne sont pas dans les specs sur main. Cette spec suppose leurs contrats (`feature.presence`, `useScene` partagé) tels que décrits dans la roadmap ; ils doivent être fusionnés, et cette spec relue contre eux, avant `/plan SPEC-0005`.
- Nom et signature du crochet : `presence(displayedPage: "ciel" | "passages") => boolean`, convention de la roadmap et du test de SPEC-0006 (`feature.presence` absent pour Passages).
- État de présence : `nextSkyState` est la « fonction pure de présence » d'INV9 ; elle reçoit `denied` et `scene` (données périmées comptant comme à jour) plutôt que l'état des données brut.
- Position de la colonne d'infos : celle du handoff (`top` 448), sans remontée avant SPEC-0009 (réponse du propriétaire).
- Avion retenu : aucune distinction visuelle (réponse du propriétaire).
- `flightLabel` et `formatMetric` montent dans `src/shared/format/` (CA18) : l'`index.ts` de Passages importe l'écran, donc Ciel ne peut pas l'importer sous Vitest, et une feature n'importe pas les fichiers internes d'une autre. SPEC-0006 les ré-exporte depuis `service.ts` : son contrat de test ne change pas, mais son texte (« Décisions », « Contrat d'interface ») est amendé avant `/plan SPEC-0006`.
- Archivo : cette spec ne charge aucune police. Le chargement des instances statiques (`expo-font`) est un prérequis porté par un amendement de SPEC-0002, à fusionner avant `/plan SPEC-0005` ; sans lui, Ciel rend en police système, sans effet sur les critères.

## Questions ouvertes
Aucune. Prérequis à fusionner avant `/plan SPEC-0005` (décisions du 2026-10-14) : amendement de SPEC-0003 (page absente, `feature.presence`), amendement de SPEC-0004 (scène partagée), amendement de SPEC-0002 (chargement d'Archivo), amendement textuel de SPEC-0006 (CA18).
