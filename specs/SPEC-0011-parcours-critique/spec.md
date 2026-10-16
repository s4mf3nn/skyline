# SPEC-0011 : Parcours critique, rejeu de trace et preuve sur iPhone

Statut : BROUILLON
Risque estimé : faible (aucun fichier de `src/` : la spec ajoute un rejeu de trace, sa fixture et une fiche de preuve ; un écart révélé par le rejeu est un bug de SPEC-0004, corrigé par `/fix`)
Dépend de : SPEC-0008, SPEC-0009, SPEC-0010
Note sur les dépendances : le parcours complet existe (états, routes, dérives) ; cette spec reste `BROUILLON` tant que ces specs ne sont pas livrées, `scripts/plan-gate.mjs deps SPEC-0011` le contrôle
Tests de contrat : `tests/acceptance/SPEC-0011.test.ts` (Vitest) ; fixture : `tests/acceptance/SPEC-0011.trace.json`
Scénarios cachés : `tests/holdout/SPEC-0011.test.ts` (ne pas les décrire ici)

## Objectif
Prouver que le parcours critique de `docs/PRODUCT.md` (« lever les yeux au bon moment ») tient sa promesse : l'heure d'entrée dans la fenêtre annoncée par l'app est juste à 10 s près pour un avion en croisière sans virage (hypothèse H3, mesure a), rejouée sur une vraie trace ADS-B avec l'horloge factice. Elle consigne aussi, avec une fiche de preuve, ce qui ne se vérifie que sur un iPhone réel avec un vrai survol : mesure b de H3, flèche qui suit le téléphone, défilement fluide, écarts au handoff, session visible dans Sentry et mentions du propriétaire présentes.

## Acteurs et rôles
Aucun rôle (aucune action exposée). Le propriétaire fournit la trace enregistrée et remplit la fiche de preuve ; l'agent producteur n'écrit aucune fonctionnalité.

## Critères d'acceptation
Le rejeu n'utilise que l'interface publique de SPEC-0004 (`computeScene`, `src/shared/scene/index.ts`), l'horloge factice de `src/shared/clock/` et la fixture ; il ne touche pas au réseau. Les distances de la fixture se lisent dans un plan local autour de l'observateur (km).

Trace (`tests/acceptance/SPEC-0011.trace.json`) :

- **CA1** : la fixture est une trace **enregistrée** (`kind: "recorded"`, pas `"synthetic"`) d'un survol réel : un `observer` (position), un `trackedHex`, `stepMs` (10 000) et des `samples` triés `{ atMs, aircraft: Aircraft[] }` espacés de `stepMs` à 1 s près, couvrant au moins 20 minutes. L'avion suivi figure dans chaque échantillon ; il est en croisière sans virage : son cap varie de 3° au plus, sa vitesse sol de 10 % au plus et son altitude reste ≥ 6 000 m sur toute la trace.
- **CA2** : la **vérité terrain** se calcule sur la trace seule, sans appeler `computeScene` : le point de la trace le plus proche de l'observateur (interpolation linéaire entre deux échantillons) donne `closestTimeMs` et sa distance, et l'**entrée réelle** `entryActualMs` est l'instant où la position réelle passe à 5 km, mesurés le long de la trace, avant ce point. Le point le plus proche est à 4 km ou moins, et l'entrée réelle laisse au moins 300 s d'échantillons avant elle ; la trace se poursuit après le point le plus proche.

Rejeu de la prévision (horloge factice) :

- **CA3** : pour chaque avance de 60 s, 120 s et 300 s, l'instantané est le dernier échantillon dont `atMs` ≤ `entryActualMs` − avance, `takenAtMs` égal à son `atMs`, l'horloge factice est à cet instant et `computeScene` reçoit l'observateur de la fixture et `previousOverheadHex: null`. L'avion suivi figure dans `upcoming` et `|passageTimeMs − entryActualMs|` ≤ 10 000 ms (H3, mesure a).
- **CA4** : rejeu continu, l'horloge factice avançant d'une seconde : l'instantané est le dernier échantillon dont `atMs` ≤ l'heure de l'horloge (rafraîchissement toutes les 10 s), le survol précédent est repassé au calcul suivant, et le rejeu court de `entryActualMs` − 300 s à `entryActualMs` + 60 s. Le premier instant où l'avion suivi est le survol en cours (`overhead.hex`) est dans [`entryActualMs` − 10 s ; `entryActualMs` + 10 s] ; avant cet instant, tant que l'avion suivi est dans `upcoming`, `passageTimeMs − clock.now()` est strictement positif (aucun compte à rebours négatif) ; après cet instant, il reste le survol en cours jusqu'à la fin du rejeu.
- **CA5** : le rejeu est déterministe et n'utilise aucune horloge directe : deux rejeux donnent les mêmes scènes, et `Date.now` n'est jamais appelé pendant le rejeu.

Preuve sur cible réelle (`specs/SPEC-0011-parcours-critique/preuve.md`) :

- **CA6** : la fiche de preuve existe, au format ci-dessous, avec tous ses champs renseignés (aucun `À REMPLIR`) : `Mesure b (s)` est un nombre ≤ 15 (H3, mesure b), `Flèche qui suit le téléphone`, `Défilement fluide des comptes à rebours`, `Session visible dans Sentry pour la release` et `Mentions du propriétaire présentes` valent `oui`, `Release` (version et numéro de build), `Appareil`, `Date`, `Lien Sentry` et `Écarts au handoff` (texte libre, `aucun` si rien à signaler) sont non vides. Le propriétaire la remplit avant la livraison aux testeurs.

## Cas limites
- Trace sans avion suivi dans un échantillon, échantillons manquants ou trop espacés : la fixture est refusée (CA1), le rejeu n'invente rien.
- Avion qui vire pendant la trace : hors périmètre de H3 (cas « croisière sans virage » seulement) ; la trace choisie n'en contient pas (CA1).
- Autres avions dans la trace : ils peuvent apparaître dans `upcoming` ; seul l'avion suivi est évalué, sauf pour l'ordre et le compte à rebours (CA4).
- Entrée réelle exactement sur un échantillon : l'interpolation rend cet instant sans écart.
- Mesure b non faisable (aucun survol réel observable à portée du testeur) : la fiche n'est pas complétée, la spec n'est pas livrée.

## Contrat d'interface
Aucune interface nouvelle : la spec ne modifie pas `src/`. Elle fixe seulement le format de la fixture et de la fiche.

```ts
interface RecordedTrace {
  kind: "recorded"                       // "synthetic" refusé (CA1)
  description: string                    // origine de la trace : date, source, lieu approximatif
  observer: Position                     // position de l'observateur pendant l'enregistrement
  trackedHex: string                     // avion du survol évalué
  stepMs: number                         // 10_000
  samples: Array<{ atMs: number; aircraft: Aircraft[] }>   // Aircraft de src/shared/adsb
}
```

Fiche `preuve.md`, une ligne par champ, au format `- **<Champ>** : <valeur>` :
`Date`, `Appareil`, `Release`, `Mesure b (s)`, `Flèche qui suit le téléphone` (`oui`/`non`), `Défilement fluide des comptes à rebours` (`oui`/`non`), `Session visible dans Sentry pour la release` (`oui`/`non`), `Lien Sentry`, `Mentions du propriétaire présentes` (`oui`/`non`), `Écarts au handoff`.

## Parcours sur cible réelle
Joués par le propriétaire sur un iPhone réel, avec un vrai survol, et consignés dans `preuve.md` (CA6) ; aucun n'est joué par la CI :
| Parcours | Ce qui est relevé |
|---|---|
| Ouvrir l'app, accorder la localisation, lever les yeux selon la première carte | Mesure b ≤ 15 s : écart entre l'heure « Passe à » affichée (entrée dans la fenêtre, SPEC-0004 CA4) et l'instant où l'observateur voit l'avion au plus près, diminué du temps de parcours de 5 km à la vitesse affichée ; la flèche suit le téléphone ; les comptes à rebours défilent sans saccade |
| Voir la carte basculer en « En ce moment » et Ciel apparaître à gauche | Écarts au handoff (compte rendu libre) |
| Session dans Sentry | La session de la release livrée apparaît dans Sentry (lien) ; aucune position n'y figure |
| Mentions | Attribution ODbL, licence d'Archivo, non-affiliation et crédits des dérives présents dans l'app (`docs/PRODUCT.md`, « Hors périmètre ») |

## Hors périmètre
- Toute fonctionnalité, tout correctif de `src/` : un écart révélé est corrigé par `/fix` sur la spec concernée.
- Les mentions légales elles-mêmes (réalisées par le propriétaire hors roadmap) : cette spec n'en vérifie que la présence, déclarée dans la fiche.
- Précision des avions qui virent, prévision de plusieurs avions à la fois, mesure statistique sur de nombreux vols (une trace suffit au contrat).
- Événement produit : la v0 n'en émet aucun (`docs/PRODUCT.md`).
- Tests sur cible réelle automatisés (`tests/e2e/`) et enregistrement de la trace par l'app (l'enregistrement se fait hors app, sur la source adsb.lol).

## Contraintes
- Aucune dépendance nouvelle ; aucune requête réseau dans les tests.
- La position de l'observateur de la fixture est celle d'un lieu choisi par le propriétaire : elle est versionnée dans le dépôt, donc ni son domicile exact ni une donnée personnelle (arrondie, ou un lieu public proche).
- La fixture ne contient pas d'image ni de donnée au-delà des champs d'`Aircraft`.

## Questions ouvertes
- Le propriétaire remplace `tests/acceptance/SPEC-0011.trace.json` (aujourd'hui un squelette synthétique, `kind: "synthetic"`) par une trace réellement enregistrée avant de fusionner cette PR : le contrat est immuable ensuite.
- Seuils de H3 (≤ 10 s, ≤ 15 s) : à confirmer par l'humain, comme dans `docs/PRODUCT.md`.
- `docs/PRODUCT.md` (H3, mesure b) parle de l'« heure de passage au point le plus proche » : depuis SPEC-0004 l'heure affichée est l'entrée dans la fenêtre. Cette spec définit b en conséquence ; l'énoncé du produit est à aligner par une PR de cadrage (`/roadmap`).
