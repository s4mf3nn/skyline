# SPEC-0008 : États d'interface

Statut : VALIDÉE
Risque estimé : moyen (écrans seulement ; ajoute le service `SystemSettings` pour ouvrir les réglages du téléphone, hors zone sensible : aucune position ni donnée personnelle n'est lue ou écrite ; modifie l'écran Ciel de SPEC-0005 pour y poser la ligne de données périmées)
Dépend de : SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007
Tests de contrat : `tests/acceptance/SPEC-0008.test.ts` (Vitest), `tests/acceptance/SPEC-0008.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0008.test.ts` et `tests/holdout/SPEC-0008.native.test.tsx` (ne pas les décrire ici)

## Objectif
Quand l'application n'a pas (encore) de scène à montrer, l'observateur sait pourquoi et ce qu'il peut faire : chargement, localisation refusée avec un bouton vers les réglages du téléphone, hors ligne, aucun passage prévu. Quand les dernières données ont plus de trois minutes, les deux écrans le disent avec l'heure de ces données. Ces états d'attente ne sont montrés que sur Prochains passages : sans avion à montrer, Ciel n'existe pas (INV9).

## Acteurs et rôles
Un seul rôle, l'observateur, sans compte (`docs/PRODUCT.md`). Seule action exposée : le bouton « Ouvrir les réglages » de l'état « localisation refusée ». Aucun refus à tester.

## Critères d'acceptation
La logique pure vit dans `src/shared/states/index.ts` (sans import de React Native, jouée sous Vitest) ; les composants d'affichage dans `src/shared/states/notice.tsx`, lus par Prochains passages et par Ciel (une logique partagée par deux features monte dans `src/shared/`). Heures et durées s'entendent en millisecondes. Le fuseau est celui de l'appareil.

Logique pure (Vitest, `tests/acceptance/SPEC-0008.test.ts`) :

- **CA1** : `STALE_AFTER_MS` vaut `180_000` (3 minutes). `isStale(snapshotAtMs, nowMs)` est vrai si et seulement si `nowMs − snapshotAtMs ≥ STALE_AFTER_MS` (`179_999` : faux ; `180_000` : vrai ; un instantané daté du futur : faux).
- **CA2** : `stateNotice(state)` rend, pour un `SceneState` de SPEC-0004, la notice de l'état d'attente, ou `null` quand il n'y a rien à dire :
  - `loading` : `{ kind: "loading", title: "Recherche des avions…", detail: null, action: null }` ;
  - `denied` : `{ kind: "denied", title: "Localisation désactivée", detail: "Skyline a besoin de votre position pour savoir quels avions passent au-dessus de vous.", action: "Ouvrir les réglages" }` ;
  - `unavailable` : `{ kind: "unavailable", title: "Hors ligne", detail: "Impossible de joindre les avions pour le moment. Nouvelle tentative automatique.", action: null }` ;
  - `ready` sans survol en cours (`overhead` nul) et sans passage à venir : `{ kind: "empty", title: "Aucun passage prévu", detail: "Aucun avion ne devrait passer près de vous pour le moment. La liste se met à jour toute seule.", action: null }` ;
  - `ready` avec un survol en cours ou au moins un passage à venir : `null`.
- **CA3** : `staleNotice(state, timeZone)` rend `{ text: "Données de HH:MM : mise à jour impossible" }` si `state.status === "ready"` et `isStale(state.snapshotAtMs, state.nowMs)`, où `HH:MM` est l'heure locale de `snapshotAtMs` (24 h, zéros de tête, secondes tronquées, comme `formatLocalTime` de SPEC-0006 : `1_800_000_000_000` donne `09:00` en `Europe/Paris`) ; `null` sinon, y compris pour `loading`, `denied` et `unavailable`. `staleNotice` et `stateNotice` sont indépendants : une scène prête, vide **et** périmée donne les deux. `formatDataTime(timestampMs, timeZone)` rend ce `HH:MM`.
- **CA4** : `createFakeSystemSettings()` (`src/shared/system-settings/index.ts`) rend un `SystemSettings` dont `openSettings()` résout et incrémente `openCount` ; avec `{ failing: true }`, `openSettings()` rejette et incrémente aussi `openCount`. L'implémentation réelle (`Linking.openSettings()` de React Native) vit dans `src/shared/system-settings/native.ts`, importée par `src/main.tsx` seulement (module natif, hors contrat, vérifié sur simulateur).

Écrans (Jest, `tests/acceptance/SPEC-0008.native.test.tsx`, sous `createApp` avec les faux de `src/shared/` et `jest.useFakeTimers()`) :

- **CA5** : (chargement) tant que la première réponse n'est pas arrivée, Prochains passages montre la notice `loading` (`testID` `passages-notice-loading`, avec son titre) et aucune carte ; à la première réponse la notice disparaît et les cartes apparaissent, sans autre état intermédiaire.
- **CA6** : (aucun passage prévu) une scène prête sans survol ni passage montre la notice `empty` (`passages-notice-empty`, titre et détail de CA2), aucune carte ; dès qu'un rafraîchissement apporte un passage, la notice est retirée et la carte apparaît. Avec au moins une carte, la notice `empty` n'est jamais montrée.
- **CA7** : (localisation refusée) permission refusée : notice `denied` (`passages-notice-denied`, titre et détail de CA2) et un bouton (`testID` `passages-notice-action`, rôle `button`, nom « Ouvrir les réglages ») ; un appui appelle `openSettings()` du service `systemSettings` une seule fois. La source ADS-B n'est pas interrogée. Un `openSettings()` qui rejette ne plante pas l'application, n'envoie rien au suivi des erreurs et n'écrit rien dans les logs. Sans service `systemSettings` (champ facultatif de `AppServices`), la notice est montrée sans bouton.
- **CA8** : (hors ligne) source indisponible sans instantané antérieur : notice `unavailable` (`passages-notice-unavailable`, titre et détail de CA2), sans bouton ni carte ; à la première réponse qui réussit, elle est retirée et la scène s'affiche (rafraîchissement de SPEC-0007).
- **CA9** : (permission retirée en cours d'usage) avec des cartes affichées, la permission devient refusée et l'app revient au premier plan : les cartes disparaissent, la notice `denied` s'affiche (SPEC-0004 CA15 efface les données) ; la permission accordée de nouveau et un autre retour au premier plan montrent `loading` puis les cartes.
- **CA10** : (données périmées, Prochains passages) avec une scène prête dont les rafraîchissements échouent, aucune ligne n'est montrée pendant les trois premières minutes (à `STALE_AFTER_MS − 1 s`) ; à `STALE_AFTER_MS` après l'instantané, la ligne `staleNotice` (`testID` `data-stale-notice-passages`, texte de CA3) apparaît au-dessus de la liste. Les cartes et leurs comptes à rebours restent affichés et continuent. Un rafraîchissement réussi retire la ligne.
- **CA11** : (données périmées, Ciel) la même ligne, `testID` `data-stale-notice-ciel`, apparaît au même instant sur Ciel quand Ciel est présente (survol en cours) ; l'avion et les valeurs de Ciel restent affichés. Un rafraîchissement réussi la retire. Quand Ciel est absente (INV9), `data-stale-notice-ciel` n'existe pas et seule la ligne de Prochains passages est montrée.
- **CA12** : (Ciel sans état d'attente, INV9) en `loading`, `denied`, `unavailable` et scène vide, aucune notice `passages-notice-*` ni `data-stale-notice-ciel` n'est montrée par Ciel, le pager n'a qu'une page (pas d'indicateur) et la notice n'est rendue qu'une fois.
- **CA13** : (INV7) un parcours complet (chargement, refus, hors ligne, périmé, retour des données, appui sur le bouton) n'envoie rien au suivi des erreurs (`monitoring.events` reste vide) et n'écrit rien dans les logs (`console.log`, `info`, `warn`, `error`).

## Cas limites
- Une scène prête avec un survol en cours mais sans passage à venir : pas de notice `empty` (le survol est une carte).
- Une scène périmée **et** vide : la notice `empty` et la ligne de données périmées sont montrées ensemble.
- Au retour au premier plan après plus de trois minutes, la ligne est montrée jusqu'à la réponse du rafraîchissement immédiat de SPEC-0007 (CA11) ; la scène recalculée à l'heure courante est déjà affichée.
- Les échecs de rafraîchissement d'avant le délai (10 s à 3 min) ne montrent rien : l'état « Hors ligne » n'existe que sans instantané antérieur.
- Instantané à `nowMs − snapshotAtMs` négatif (horloge reculée) : pas de ligne (CA1, logique pure seulement).
- Heure des données : fuseau de l'appareil, même format que les heures de passage ; changement de fuseau non géré.
- Bouton « Ouvrir les réglages » sans effet visible quand les réglages sont déjà ouverts : sans conséquence.
- Permission refusée de façon permanente : le bouton mène aux réglages du téléphone, seul endroit où la changer.

## Contrat d'interface
`src/shared/states/index.ts` (logique pure ; seul import : les types de `src/shared/scene/index.ts`) :

```ts
const STALE_AFTER_MS = 180_000

type NoticeKind = "loading" | "denied" | "unavailable" | "empty"
interface StateNotice { kind: NoticeKind; title: string; detail: string | null; action: string | null }
interface StaleNotice { text: string }

isStale(snapshotAtMs: number, nowMs: number): boolean
formatDataTime(timestampMs: number, timeZone: string): string
stateNotice(state: SceneState): StateNotice | null
staleNotice(state: SceneState, timeZone: string): StaleNotice | null
```

`src/shared/states/notice.tsx` : `StateNoticeView({ notice, onAction })` (rend `passages-notice-<kind>`, le titre, le détail et, si `notice.action` et `onAction` sont présents, le bouton `passages-notice-action`) et `StaleNoticeView({ screen, notice })` (`screen` : `"passages" | "ciel"`, rend `data-stale-notice-<screen>` et son texte).

`src/shared/system-settings/index.ts` : `interface SystemSettings { openSettings(): Promise<void> }`, `createFakeSystemSettings(options?: { failing?: boolean }): SystemSettings & { readonly openCount: number }`. `src/shared/services/index.tsx` : `AppServices.systemSettings?: SystemSettings` (champ facultatif, comme `lifecycle`).

Prochains passages (SPEC-0006) lit `stateNotice` et `staleNotice` : à la place de la liste quand `stateNotice` n'est pas nul et qu'il n'y a aucune carte, ligne de données périmées au-dessus de la liste. Ciel (SPEC-0005) lit `staleNotice` seulement.

## Écrans
- **Prochains passages** : sans maquette (décision du propriétaire du 2026-10-14, textes et neutres du handoff). États : chargement (CA5), aucun passage prévu (CA6), localisation refusée avec bouton (CA7), hors ligne (CA8), données périmées (CA10), liste de cartes (SPEC-0006). Actions : appui sur « Ouvrir les réglages » (CA7) ; aucune autre. Les textes exacts sont ceux de CA2 et CA3, à valider par l'humain dans cette PR. Disposition et styles non testés (vérifiés par la capture sur cible réelle) : fond `ground` (`#0C0C0C`) de Prochains passages, texte crème `#F4F1EA`, Archivo, aplats, aucune illustration, aucun indicateur de chargement système ; titre en gros corps, détail en corps courant ; ligne de données périmées en haut de l'écran, sous la barre d'état, en `small` sur fond neutre.
- **Ciel** : sans maquette. Seul état ajouté : la ligne de données périmées (CA11), aux couleurs de la compagnie (`theme.small`), placée par l'écran de SPEC-0005 sous la barre d'état ; elle ne déplace pas le reste de l'écran. Ciel n'a ni chargement, ni refus, ni hors ligne, ni vide (INV9, CA12).

## Parcours sur cible réelle
- Sur simulateur iPhone : refuser la localisation montre l'état refusé et son bouton ouvre les réglages de l'app ; accorder la permission et revenir dans l'app montre le chargement puis les cartes ; mode avion pendant plus de trois minutes montre la ligne « Données de HH:MM ». Vérifié à la main dans la PR de la dernière tâche (captures jointes) : `Linking.openSettings()` n'est pas joué sous Jest.

## Hors périmètre
- Distinguer « pas de réseau » d'une panne d'adsb.lol (un seul état « Hors ligne », décision du 2026-10-14).
- Message ou indicateur avant le délai de trois minutes (décision du 2026-10-14 : rien avant le délai).
- Délai de péremption réglable, relance manuelle, bouton « Réessayer » (le rafraîchissement automatique de SPEC-0007 suffit).
- Mode nuit, traduction, textes en anglais.
- Mentions légales dont l'attribution ODbL (propriétaire).
- Toute modification du rafraîchissement, de la scène ou de la présence de Ciel (SPEC-0004, SPEC-0005, SPEC-0007).
- Le maintien de Ciel sur un avion retenu quand les données vieillissent (INV9) : c'est la présence de Ciel, testée par SPEC-0005 ; cette spec ne teste que la ligne de données périmées quand Ciel est présent.

## Contraintes
- Aucun calcul dans un `.tsx` (`docs/factory/UI.md`) : choix de la notice, délai et heure viennent de `src/shared/states/index.ts`.
- Textes en français, codes et identifiants en anglais ; aucun texte n'est construit à partir d'un message d'erreur.
- Aucune position, coordonnée ni cause d'erreur n'est affichée, loggée ou envoyée au suivi des erreurs (INV7, CA13).
- Aucune dépendance nouvelle : `Linking` fait partie de React Native.
- L'heure des données est celle de l'instantané (`snapshotAtMs` de SPEC-0004), jamais l'horloge de l'appareil au moment de l'affichage.

## Décisions prises à la rédaction
Réponses du propriétaire (2026-10-14) : délai de péremption de 3 minutes ; rien n'est affiché avant ce délai ; un seul état « Hors ligne » ; pas de maquette. À confirmer à la relecture :
- Les textes de CA2 et CA3 sont proposés par la factory (le brief le demande) : l'humain les valide ou les corrige dans cette PR avant tout `/plan`.
- Le seuil de péremption est inclusif (`≥ 180 000 ms`) et se lit sur `nowMs − snapshotAtMs`, donc le message apparaît au tick d'une seconde qui atteint le délai.
- La ligne de données périmées s'applique aussi à une scène vide, et aux données gardées en arrière-plan puis ravivées (le retour au premier plan rafraîchit tout de suite).
- `formatDataTime` répète `formatLocalTime` de SPEC-0006 : celui-ci vit dans une feature, qu'un module partagé ne peut pas importer ; à la troisième répétition, il montera dans `src/shared/`.
- `SystemSettings` est un service injecté et facultatif (comme `AppLifecycle`) : sans lui, pas de bouton plutôt qu'un bouton mort.
- Ciel, quand il montre un avion retenu (INV9), garde son avion et la ligne de données périmées ; il ne se retire pas parce que les données vieillissent. La présence de Ciel relève de SPEC-0005 et n'est pas rejouée ici.
- Le cycle « Données affichées » de `docs/DOMAIN.md` dit « dernières données avec leur heure, puis message au-delà du délai » : cette spec le lit comme « rien avant 3 minutes, puis une ligne avec l'heure » (réponse du propriétaire du 2026-10-14). Si cette lecture est jugée contraire au cadrage, la reformuler par une PR de cadrage (`/roadmap`) avant `/plan`.

## Questions ouvertes
Aucune (les textes sont à valider à la relecture).
