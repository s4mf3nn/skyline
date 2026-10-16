# SPEC-0004 : Calcul de la scène, position et cap de l'observateur

Statut : BROUILLON
Risque estimé : élevé (touche `src/shared/location/`, zone sensible : la position de l'observateur y est lue et passe dans la requête ADS-B)
Dépend de : SPEC-0000
Tests de contrat : `tests/acceptance/SPEC-0004.test.ts` (Vitest), `tests/acceptance/SPEC-0004.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0004.test.ts` et `tests/holdout/SPEC-0004.native.test.tsx` (ne pas les décrire ici)

## Objectif
Donner à Ciel et à Prochains passages une seule source de vérité sur le ciel : à partir de la position de l'observateur, d'un instantané de la source ADS-B et de l'heure, savoir quel avion survole l'observateur, quels sont les 10 prochains passages, d'où ils arrivent et vers où tourner la flèche. Les écrans qui suivent n'ont plus qu'à afficher ce que le crochet `useScene` leur rend.

## Acteurs et rôles
Aucun rôle (module sans action exposée). L'observateur n'a pas de compte ; la seule permission est la localisation « pendant l'utilisation ».

## Critères d'acceptation
Le module vit dans `src/shared/scene/` : il est lu par deux features (Ciel, Passages), il ne peut donc appartenir à aucune d'elles (même raison que `src/shared/airlines/`). L'acquisition de la position et du cap reste dans `src/shared/location/`. Les valeurs numériques s'entendent aux tolérances suivantes : distances ±0,1 km, heures ±1 s, gisements ±1°. La méthode de projection (plan local autour de l'observateur ou grand cercle) est libre.

Calcul pur (Vitest, `tests/acceptance/SPEC-0004.test.ts`) :

- **CA1** : `groundDistanceKm(a, b)` rend la distance horizontale en km entre deux positions (rayon terrestre 6371 km), symétrique, 0 pour deux positions identiques. `bearingDeg(from, to)` rend le gisement de `to` vu de `from`, en degrés dans [0, 360), 0 au nord, sens horaire (est = 90).
- **CA2** : `cardinalPoint(deg)` rend le point cardinal du secteur de 45° centré sur lui : `N` = [337,5 ; 22,5[, `NE` = [22,5 ; 67,5[, `E`, `SE`, `S`, `SO`, `O`, `NO` de la même façon (borne basse incluse, borne haute exclue). Un angle hors de [0, 360) est d'abord ramené dans [0, 360) (`360` donne `N`, `-10` donne `N`).
- **CA3** : `arrowAngleDeg(targetDeg, headingDeg)` rend `targetDeg − headingDeg` ramené dans [0, 360) (jamais 360, jamais `-0`) ; `null` quand le cap du téléphone est `null` (inconnu).
- **CA4** : le module exporte les constantes du brief `OVERHEAD_THRESHOLD_KM` (4), `FORECAST_RADIUS_KM` (80), `MAX_UPCOMING` (10), `WINDOW_HALF_LENGTH_KM` (5) et `REFRESH_INTERVAL_MS` (10 000), qu'il est seul à définir. `computeScene({ snapshot, observer, nowMs, previousOverheadHex })` extrapole chaque avion en ligne droite depuis sa position à `snapshot.takenAtMs`, à vitesse sol et cap constants, et rend pour chaque passage : `closestDistanceKm` (distance de la trajectoire à l'observateur), `closestTimeMs` (heure du point le plus proche), `passageTimeMs` (**entrée dans la fenêtre**, soit `closestTimeMs` moins le temps de parcourir 5 km ; c'est la cible du compte à rebours et de « Passe à », décision du propriétaire du 2026-10-13 pour le point ouvert de `docs/DOMAIN.md`), `windowEndMs` (`closestTimeMs` plus le temps de parcourir 5 km), `arrivalBearingDeg` (gisement, vu de l'observateur, de l'avion à `passageTimeMs`) et `arrivalCardinal` (son point cardinal), `trackDeg` et `trackCardinal` (cap de l'avion), `groundDistanceKm` (distance au sol à `nowMs`), `latitude` et `longitude` (position de l'avion à `nowMs`, extrapolée en ligne droite comme pour `groundDistanceKm`, à rebours si `nowMs` précède `takenAtMs` ; `groundDistanceKm` est la distance de cette position à l'observateur), ainsi que `hex`, `callsign`, `altitudeM`, `groundSpeedKmh` repris de l'avion. Les heures sont arrondies à la milliseconde.
- **CA5** : (INV2) un avion est *exploitable* quand sa vitesse sol est connue et > 0, son cap est connu et son altitude est > 0 m ou `null` (≤ 0 m : au sol). Un avion inexploitable n'a pas de passage et n'est jamais le survol en cours, même maintenu (CA8). Un avion exploitable n'a pas de passage, et ne **devient** pas le survol en cours, quand : sa fenêtre est terminée à `nowMs` (`windowEndMs` ≤ `nowMs`, la fin est exclue) ; son point le plus proche est à plus de 4 km (4 km inclus) ; sa distance au sol à `nowMs`, mesurée à sa position extrapolée à `nowMs`, dépasse 80 km (80 km inclus). Un avion déjà survol en cours échappe aux deux derniers seuils (CA8).
- **CA6** : (INV3) `upcoming` contient les avions dont la fenêtre n'a pas commencé (`passageTimeMs` > `nowMs`) et qui ne sont pas le survol en cours, triés par `passageTimeMs` croissant puis par `hex` croissant, au plus 10, un seul passage par `hex` : seule la première occurrence de l'instantané est considérée, qu'elle soit exploitable ou non (les suivantes sont ignorées avant tout autre contrôle). Un avion dont la fenêtre est en cours et qui n'est pas le survol en cours n'apparaît nulle part. `passageTimeMs` > `nowMs` pour chaque entrée : aucun compte à rebours négatif.
- **CA7** : (INV1, entrée) sans survol précédent, le survol en cours est, parmi les avions dont la fenêtre contient `nowMs` (début inclus, fin exclue) et dont le point le plus proche est à 4 km ou moins, celui dont la distance au sol à `nowMs` est la plus petite (égalité : `hex` croissant) ; `null` s'il n'y en a aucun. La distance au sol est celle de la position extrapolée à `nowMs` (CA5). Un avion dont le point le plus proche est déjà derrière lui (`closestTimeMs` < `nowMs`) mais dont la fenêtre n'est pas terminée est éligible comme les autres.
- **CA8** : (INV1, maintien) si `previousOverheadHex` désigne un avion encore présent dans l'instantané, exploitable (CA5) et dont la fenêtre recalculée contient `nowMs` (début inclus, fin exclue), il reste le survol en cours, même si un autre avion est plus proche et même si sa distance de passage recalculée dépasse 4 km (le seuil n'est évalué qu'à l'entrée). Sinon (absent, fenêtre terminée ou pas commencée, avion devenu inexploitable), la règle d'entrée de CA7 s'applique.
- **CA9** : (INV4) le calcul ne dépend de l'heure courante que par `nowMs` : avec le même instantané, `passageTimeMs` d'un avion est le même à toute heure ; `passageTimeMs − nowMs` est le compte à rebours. Quand `nowMs` atteint `passageTimeMs`, l'avion quitte `upcoming` et devient le survol en cours (s'il est éligible) ; quand `nowMs` atteint `windowEndMs`, il disparaît de la scène.

Acquisition de la position, du cap et du premier plan (Vitest) :

- **CA10** : `acquireObserver(location)` (`src/shared/location/`) demande la permission puis lit la position : rend `{ status: "granted", position }` si la permission est accordée, `{ status: "denied" }` si elle est refusée, et aussi si la lecture de la position rejette avec `LOCATION_DENIED` (permission retirée entre les deux). Toute autre erreur est propagée telle quelle. Elle n'appelle jamais `getPosition` quand la permission est refusée.
- **CA11** : `AppLifecycle` (`src/shared/lifecycle/`) expose `onForeground(listener): () => void` : le listener est appelé à chaque retour de l'app au premier plan, plus jamais après la fonction de désabonnement renvoyée ; `onBackground(listener): () => void` fait de même à chaque entrée en arrière-plan. `createFakeLifecycle()` rend un `AppLifecycle` avec `enterForeground()` et `enterBackground()` pour simuler ces passages. `AppServices` gagne un champ **facultatif** `lifecycle` : une application ou un test qui ne le fournit pas continue de fonctionner.

Crochet `useScene` (Jest, `tests/acceptance/SPEC-0004.native.test.tsx`, joué sous `createApp` avec les faux de `src/shared/`) :

- **CA12** : au montage, le crochet demande la permission, lit la position, interroge la source ADS-B une seule fois avec `{ latitude, longitude, radiusKm: 80 }` où latitude et longitude sont la position **arrondie à 3 décimales** (INV7), puis rend `state.status === "ready"` avec la scène calculée à `clock.now()` et `snapshotAtMs` égal à l'heure de la réponse. Avant la réponse : `status === "loading"`.
- **CA13** : une fois prêt, le crochet recalcule la scène à chaque seconde avec `clock.now()` (même instantané, sans nouvelle requête) et lui passe le survol précédent (INV1) : un survol en cours le reste d'un tick à l'autre selon CA8. `refresh()` interroge de nouveau la source et remplace l'instantané. Le minuteur de 10 s et la pause en arrière-plan sont à SPEC-0007 : les tests de ce contrat ne supposent ni leur présence ni leur absence.
- **CA14** : permission refusée : `status === "denied"`, la source ADS-B n'est jamais interrogée, aucune scène n'est exposée.
- **CA15** : à chaque retour au premier plan (`lifecycle.enterForeground()`), le crochet relit la permission et la position, puis interroge la source avec la nouvelle position. Permission devenue refusée : `status === "denied"` et les données sont effacées (aucune scène exposée) ; de nouveau accordée au retour suivant : `loading` puis `ready`.
- **CA16** : `headingDeg` vaut `null` tant que le téléphone n'a envoyé aucun cap, puis la dernière valeur reçue ramenée dans [0, 360) ; le crochet s'abonne au cap au montage et se désabonne au démontage (plus aucune valeur reçue ensuite).
- **CA17** : toute erreur de la source ADS-B (`ADSB_UNAVAILABLE` ou autre) ou de la lecture de la position autre que `LOCATION_DENIED` : sans instantané antérieur, `status === "unavailable"` ; avec un instantané antérieur, la dernière scène reste exposée (`ready`, `snapshotAtMs` inchangé) et est recalculée à chaque seconde. Le crochet ne plante jamais et se rétablit à la requête suivante qui réussit. Les états et textes d'interface de ces situations sont à SPEC-0008.
- **CA18** : (INV7) la position n'est ni envoyée au suivi des erreurs (`monitoring.events` reste vide, même quand la source est indisponible ou la permission refusée) ni écrite dans les logs (`console.log`, `info`, `warn`, `error` n'en reçoivent aucune).

## Cas limites
- Instantané vide : `overhead` est `null`, `upcoming` est vide.
- Avion exactement à 4 km de passage, exactement à 80 km : gardés (CA5, bornes incluses). Avion à `windowEndMs === nowMs` : disparu (fin exclue).
- `trackDeg` à 360 ou à 0 : même direction. Cap du téléphone à 360 : comme 0.
- Avion déjà dans sa fenêtre à l'instant de l'instantané (`passageTimeMs` ≤ `takenAtMs`) : éligible au survol, absent de `upcoming`.
- Avion qui s'éloigne (point le plus proche derrière lui) mais encore dans sa fenêtre : éligible au survol s'il est à 4 km ou moins ; sinon sans passage.
- Deux avions de même `hex` dans l'instantané : un seul passage (première occurrence).
- Deux passages à la même heure : ordre des `hex`.
- Plus de 10 passages : les 10 premiers par heure.
- Cap inconnu : `arrowAngleDeg` rend `null`, la scène reste calculée.
- Heure `nowMs` antérieure à `takenAtMs` : l'extrapolation s'applique à rebours, sans erreur.
- Permission retirée pendant l'usage : constatée au retour au premier plan seulement (CA15).
- Démontage pendant une requête en cours : aucune mise à jour d'état ni requête après le démontage.
- Réponse de la source en retard (une requête plus ancienne répond après une plus récente) : seule la plus récente est gardée.

## Contrat d'interface
Point d'entrée : `src/shared/scene/index.ts`.

```ts
type CardinalPoint = "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO"

interface AircraftSnapshot { aircraft: readonly Aircraft[]; takenAtMs: number }

interface Passage {
  hex: string
  callsign: string | null
  altitudeM: number | null
  groundSpeedKmh: number
  trackDeg: number
  trackCardinal: CardinalPoint
  passageTimeMs: number        // entrée dans la fenêtre : cible du compte à rebours
  closestTimeMs: number
  windowEndMs: number
  closestDistanceKm: number
  groundDistanceKm: number     // à nowMs
  latitude: number             // position extrapolée à nowMs
  longitude: number
  arrivalBearingDeg: number    // [0, 360)
  arrivalCardinal: CardinalPoint
}
interface Scene { overhead: Passage | null; upcoming: Passage[] }

// Constantes du brief (non réglables en v0)
OVERHEAD_THRESHOLD_KM = 4; FORECAST_RADIUS_KM = 80; MAX_UPCOMING = 10; WINDOW_HALF_LENGTH_KM = 5; REFRESH_INTERVAL_MS = 10_000

groundDistanceKm(a: Position, b: Position): number
bearingDeg(from: Position, to: Position): number
cardinalPoint(deg: number): CardinalPoint
arrowAngleDeg(targetDeg: number, headingDeg: number | null): number | null
computeScene(input: {
  snapshot: AircraftSnapshot
  observer: Position
  nowMs: number
  previousOverheadHex: string | null
}): Scene

type SceneState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; scene: Scene; snapshotAtMs: number; nowMs: number }
useScene(): { state: SceneState; headingDeg: number | null; refresh(): void }   // lit useServices()
```

`src/shared/location/index.ts` (ajout) :

```ts
type ObserverFix = { status: "granted"; position: Position } | { status: "denied" }
acquireObserver(location: LocationService): Promise<ObserverFix>
```

`src/shared/lifecycle/index.ts` (nouveau) : `interface AppLifecycle { onForeground(listener: () => void): () => void; onBackground(listener: () => void): () => void }`, `createFakeLifecycle(): AppLifecycle & { enterForeground(): void; enterBackground(): void }`. L'implémentation réelle (`AppState` de React Native) vit dans un fichier à part importé par `src/main.tsx` seulement, comme `expo.ts` pour la localisation : elle appelle les listeners de premier plan à chaque passage de l'état de l'app à `active` depuis `inactive` ou `background`, et ceux d'arrière-plan à chaque passage à `inactive` ou `background` depuis `active` (module natif, hors contrat, vérifié sur simulateur). `src/shared/services/index.tsx` : `AppServices.lifecycle?: AppLifecycle`.

Ce que lit chaque écran : l'avion « Regardez » de Ciel et de la carte « En ce moment » vise `arrowAngleDeg(overhead.trackDeg, headingDeg)` ; une carte de passage vise `arrowAngleDeg(passage.arrivalBearingDeg, headingDeg)` (`docs/DOMAIN.md`, « Angle de la flèche »). Le délai affiché par Ciel quand rien ne survole est `upcoming[0].passageTimeMs − nowMs`.

## Hors périmètre
- Minuteur de rafraîchissement de 10 s et pause en arrière-plan (SPEC-0007) ; client adsb.lol, validation de la réponse et conversion d'unités (SPEC-0007).
- États d'interface, textes et délai de péremption des données (SPEC-0008).
- Formatage `MM:SS` des comptes à rebours et rendu sans re-rendre la liste (SPEC-0006).
- Route de vol, heures et progression (SPEC-0009), compagnie et couleurs (SPEC-0002).
- Écrans Ciel et Prochains passages : cette spec ne dessine rien.
- Suivi de la position en continu : la position est lue au montage et au retour au premier plan seulement.
- Prise en compte de l'altitude dans la distance (distance horizontale seulement), de l'âge de la position ADS-B (SPEC-0007) et des virages (limite connue du brief).
- Mesure de la précision de la prévision sur trace enregistrée (SPEC-0011).

## Contraintes
- Fonctions de calcul pures et déterministes : ni horloge directe (`Date.now()`, `new Date()`), ni réseau, ni import de React Native ; seul `useScene` importe React.
- La position ne sort de l'appareil que dans la requête à la source ADS-B, arrondie à 3 décimales (le calcul local garde la position exacte : l'écart d'arrondi, environ 55 m, est sous la tolérance du contrat, le relecteur le contrôle) ; elle n'est ni stockée sur disque, ni loggée, ni envoyée au suivi des erreurs (INV7, `docs/factory/DOMAIN-SECURITY.md`). La permission reste « pendant l'utilisation » ; aucune localisation en arrière-plan.
- Aucune dépendance nouvelle : `expo-location` est dans l'ADR-0001, `AppState` vient de React Native.
- Une seule fonction de calcul de la scène, lue par les deux écrans (INV1) : aucun écran ne recalcule un survol ou un passage.
- Conséquence acceptée (propriétaire, `docs/DOMAIN.md`) : un avion sans cap ou sans vitesse n'est jamais le survol en cours, et la distance actuelle d'un survol maintenu peut atteindre environ 6,4 km.

## Amendement (SPEC-0005)
- Une seule scène par application : `useScene` lit un magasin partagé fourni par `createApp`, démarré au premier abonné et arrêté au dernier. La permission et la source ne sont demandées qu'une fois ; la signature de `useScene` et les contrats sont inchangés.

## Amendement (SPEC-0007)
- CA13 : la clause « ne rafraîchit pas de lui-même » et son test sont retirés ; les tests ne supposent plus qu'aucune requête ne part au-delà de 10 s (assertions de nombre de requêtes et d'`snapshotAtMs` après plus de 10 s retirées). `AppLifecycle` gagne `onBackground` (CA11).

## Amendement (SPEC-0009)
- CA4 : `Passage` porte `latitude` et `longitude`, la position de l'avion à `nowMs` extrapolée en ligne droite (à rebours si `nowMs` précède l'instantané), préalable de SPEC-0009 (progression du vol). Aucun autre critère ne change ; les tests de contrat ajoutent les assertions de CA4.

## Décisions prises à la rédaction
Choix non dictés par le brief ni par le cadrage, à confirmer à la relecture :
- Cible du compte à rebours : l'entrée dans la fenêtre (réponse du propriétaire à la question de cadrage) ; le tri de INV3 suit cette heure.
- Avion « au sol » : `altitudeM` ≤ 0 m, `null` gardé (le client réel de SPEC-0007 écarte déjà les avions au sol à la source).
- Cap du téléphone inconnu : angle de flèche `null`, rien n'est inventé.
- Retour au premier plan : nouveau service `AppLifecycle`, champ facultatif de `AppServices`.
- Bornes : 4 km et 80 km inclus (l'égalité exacte n'est pas distinguable à la tolérance du contrat : le relecteur la contrôle) ; début de fenêtre inclus, fin exclue ; secteurs cardinaux à borne basse incluse ; égalités départagées par `hex` croissant.
- Rayon et arrondi de la requête portés par le crochet (INV7 dès cette spec), SPEC-0007 pouvant arrondir de nouveau sans effet.
- Source indisponible : `unavailable` sans instantané antérieur, dernière scène conservée sinon.

## Questions ouvertes
Aucune.
