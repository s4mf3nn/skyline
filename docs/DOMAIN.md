# Domaine : skyline

<!-- Rédigé par `/roadmap <brief>`, validé par l'humain dans la PR de cadrage, lu par `/new-spec`, le `planner` et le
`spec-reviewer`. Une spec qui contredit un invariant ou un cycle de vie amende d'abord ce document. -->

La v0 n'a ni base ni requête concurrente : tout est calculé sur l'appareil, à partir d'un instantané de la source ADS-B.
Les invariants sont garantis par la validation à la frontière et par des fonctions pures testées sous Vitest.

## Vocabulaire
| Terme | Identifiant | Définition |
|---|---|---|
| Observateur | `observer` | La personne qui tient le téléphone ; sa position est celle de l'appareil |
| Avion | `Aircraft` | Un aéronef renvoyé par la source ADS-B, identifié par son `hex` (adresse OACI 24 bits) |
| Instantané | `AircraftSnapshot` | Liste d'avions reçue à une heure donnée, avec cette heure ; base de tous les calculs jusqu'au rafraîchissement suivant |
| Rafraîchissement | `refresh` | Nouvelle requête à la source ADS-B et recalcul, toutes les 10 s au premier plan, en pause en arrière-plan |
| Compagnie | `Airline` | Entrée de la table des compagnies : code, nom, pays, couleur primaire, couleur secondaire, codes IATA et OACI, image de dérive facultative |
| Compagnie inconnue | `UNKNOWN_AIRLINE` | Entrée `xx` du handoff (privé ou non identifié), utilisée quand l'indicatif ne correspond à aucune compagnie |
| Thème de compagnie | `AirlineTheme` | Couleurs calculées pour un fond : `bg`, `big` (texte ≥ 24 pt), `small` (petit texte), `track` |
| Ajustement de contraste | `fit` | Fonction du handoff qui corrige la couleur secondaire jusqu'au contraste visé (3:1 ou 4,5:1) |
| Mélange | `mix` | Fonction du handoff qui interpole deux couleurs |
| Dérive | `tail` | Image de la queue de l'avion aux couleurs de la compagnie : image autorisée, sinon dérive générique SVG |
| Distance au sol | `groundDistanceKm` | Distance horizontale entre l'observateur et la projection au sol de l'avion |
| Trajectoire extrapolée | `projectedTrack` | Droite issue de la position de l'avion, suivant son cap à vitesse sol constante |
| Point le plus proche | `closestApproach` | Point de la trajectoire extrapolée le plus proche de l'observateur, avec sa distance et son heure |
| Heure de passage | `passageTime` | Heure à laquelle l'avion atteint son point le plus proche |
| Cap de l'avion | `trackDeg` | Direction vers laquelle l'avion se dirige (0 au nord, sens horaire), affichée en point cardinal sur Ciel et sur la carte « En ce moment » (« repart vers ») |
| Gisement d'arrivée | `arrivalBearingDeg` | Direction, vue de l'observateur, depuis laquelle l'avion arrive (0 au nord, sens horaire) |
| Point cardinal | `CardinalPoint` | L'un des huit secteurs N, NE, E, SE, S, SO, O, NO, de 45° chacun |
| Angle de la flèche | `arrowAngleDeg` | Direction visée moins le cap du téléphone, ramené dans [0, 360). Direction visée : le gisement d'arrivée sur une carte de passage ; le cap de l'avion sur la carte « En ce moment » (handoff). Ciel n'a pas de flèche en v0 (décision du propriétaire du 2026-10-13) |
| Fenêtre « En ce moment » | `overheadWindow` | Intervalle de temps pendant lequel l'avion parcourt les ±5 km de sa trajectoire autour du point le plus proche |
| Survol en cours | `overhead` | L'avion montré par Ciel et par la carte « En ce moment » (INV1) |
| Avion retenu | `heldOverhead` | Dernier survol en cours montré par Ciel, gardé à l'écran après la fin de son survol tant que l'observateur reste sur Ciel (INV9) |
| Présence de Ciel | `skyPresence` | Ce que la page Ciel montre, ou son absence du pager : `absent`, `neutre` (état d'attente), `survol`, `retenu` (INV9) |
| Passage | `Passage` | Prévision pour un avion : heure de passage, distance au point le plus proche, gisement d'arrivée, fenêtre |
| Prochains passages | `upcomingPassages` | Les 10 passages à venir triés par heure (INV3) |
| Compte à rebours | `countdown` | Temps restant avant le passage, affiché `MM:SS` |
| Route de vol | `FlightRoute` | Origine et destination d'un vol (codes IATA, villes, coordonnées), issues de la source des routes (ADR-0002) |

## Invariants
- **INV1** : il y a au plus un survol en cours, et c'est le même avion sur Ciel et sur la carte « En ce moment » (seule
  exception : Ciel peut montrer un avion retenu quand il n'y a plus de survol en cours, INV9). C'est
  l'avion dont l'heure courante est dans sa fenêtre « En ce moment » et dont le point le plus proche est à 4 km ou
  moins. Un survol en cours le reste tant que l'instantané courant le contient et que sa fenêtre, recalculée à chaque
  rafraîchissement, contient l'heure courante ; le seuil de 4 km n'est évalué qu'à son entrée (pas de bascule d'un
  tick à l'autre) ; quand il
  n'y en a pas, le candidat le plus proche de l'observateur à l'heure courante devient le survol en cours. La fonction
  de scène reçoit donc le survol précédent en entrée (instantané, horloge, position, survol précédent). (garantie par : une seule fonction
  pure de calcul de la scène, lue par les deux écrans ; décision du propriétaire du 2026-10-13, qui remplace la règle
  « distance actuelle ≤ 4 km » de l'écran Ciel du brief)
- **INV2** : un passage n'est prévu que pour un avion dont le point le plus proche est devant lui (heure de passage
  postérieure à l'heure de l'instantané, ou fenêtre en cours), à 4 km ou moins de l'observateur, et situé dans le rayon
  de 80 km. Un avion au sol, sans cap ou de vitesse sol nulle ou inconnue n'a pas de passage. (garantie par : fonction
  pure d'extrapolation, testée sur les cas du brief : approche, éloignement, passage à côté, vitesse nulle)
- **INV3** : les prochains passages sont au plus 10, triés par heure de passage croissante, sans doublon d'avion, et
  sans aucun avion dont la fenêtre « En ce moment » est en cours : le survol en cours a sa carte dédiée, un autre
  avion en fenêtre (éclipsé par INV1) n'est montré nulle part ; aucun compte à rebours n'est donc négatif. (garantie par : fonction pure de calcul de la scène)
- **INV4** : un compte à rebours se calcule à chaque tick comme `heure de passage − horloge`, jamais par décrément d'un
  compteur : il se corrige de lui-même à chaque rafraîchissement. (garantie par : horloge injectée `src/shared/clock/`,
  test avec l'horloge factice)
- **INV5** : sur un fond de compagnie, le texte `big` a un contraste d'au moins 3:1 et le texte `small` d'au moins
  4,5:1, sinon il prend le crème `#F4F1EA` ou l'encre `#1D1D1B` qui contraste le mieux. (garantie par : `fit()`
  reproduit à l'identique de `data.js`, testé aux seuils et sur les couleurs limites)
- **INV6** : une réponse de la source ADS-B ou de la source des routes est validée avant tout calcul ; un champ
  manquant ou invalide vaut `null` sans retirer l'avion, une réponse illisible donne l'erreur typée de la source et un
  état d'interface prévu, jamais un plantage. (garantie par : validation à la frontière dans `src/shared/adsb/` et dans
  le client des routes)
- **INV7** : la position de l'observateur ne sort de l'appareil que dans la requête à la source ADS-B, arrondie à
  3 décimales (environ 100 m) ; la requête de
  routes ne porte que l'indicatif. (garantie par : tests de contrat sur les faux des deux sources et du suivi des
  erreurs ; règle de `docs/factory/DOMAIN-SECURITY.md`)
- **INV8** : aucune couleur ni image de compagnie n'est inventée : une compagnie absente de la table prend
  `UNKNOWN_AIRLINE`, une compagnie sans image autorisée prend la dérive générique SVG. (garantie par : résolution de la
  compagnie dans une fonction pure, testée sur un indicatif inconnu)
- **INV9** : Ciel est une page du pager si et seulement si sa présence n'est pas `absent` (cycle « Page Ciel »
  ci-dessous) : il y a un état d'attente (chargement, localisation refusée, hors ligne sans données), un survol en
  cours, ou un avion retenu. Sinon le pager n'a qu'une page, Prochains passages, sans indicateur ni glissement.
  L'apparition ou le retrait de Ciel ne change jamais la page affichée, sauf le retrait d'un avion retenu, qui se fait
  quand l'observateur quitte Ciel par un glissement. Un avion retenu garde les dernières valeurs affichées et cède la
  place dès qu'un nouveau survol commence. (garantie par : une fonction pure de présence de Ciel, qui reçoit l'état
  des données, le survol en cours et la page affichée, testée sous Vitest ; décisions du propriétaire du 2026-10-13)

Conséquences d'INV1, acceptées par le propriétaire : un avion sans cap ou sans vitesse (hélicoptère en stationnaire)
n'est jamais le survol en cours, même à 1 km ; la distance actuelle d'un survol en cours peut atteindre environ
6,4 km (√(5² + 4²)), au-delà du seuil de 4 km du brief.

**Point à trancher par la spec des calculs de passage.** Le brief fait basculer la carte en « En ce moment » à 00:00
et définit la fenêtre comme ±5 km autour du point le plus proche : si le compte à rebours vise le point le plus proche,
l'avion entre dans la fenêtre (≈ 23 s à 780 km/h) avant 00:00. Recommandation : le compte à rebours et « Passe à »
visent l'entrée dans la fenêtre, pour que 00:00 coïncide avec la bascule et avec INV1. Les deux mesures de H3 sont définies dans `docs/PRODUCT.md`.

## Cycles de vie
### Passage (carte du carrousel)
| De | Vers | Déclenchée par | Effet |
|---|---|---|---|
| (aucun) | à venir | Un rafraîchissement prévoit un passage qui entre dans les 10 premiers | Carte ajoutée à sa place dans l'ordre des heures |
| à venir | à venir | Rafraîchissement | Heure, gisement et compte à rebours recalculés ; la carte peut changer de rang |
| à venir | en ce moment | Le compte à rebours atteint 00:00 (cible fixée par SPEC-0004) et l'avion devient le survol en cours (INV1) | La carte passe en tête, en version « En ce moment » ; Ciel montre cet avion (et apparaît s'il était absent, INV9) |
| retiré ou aucun | en ce moment | Le survol en cours se termine alors que cet avion est encore dans sa fenêtre (INV1) | La carte « En ce moment » montre cet avion ; Ciel aussi |
| à venir | retiré | Rafraîchissement qui ne prévoit plus le passage (virage, sortie du rayon, rang > 10), ou entrée dans sa fenêtre alors qu'un autre avion est le survol en cours (INV3) | Carte retirée sans animation particulière |
| en ce moment | terminé | L'instantané courant ne contient plus l'avion, ou sa fenêtre recalculée ne contient plus l'heure courante (fin de fenêtre, virage) | Carte retirée ; Ciel passe au survol suivant, retient l'avion ou disparaît (cycle « Page Ciel ») |

### Données affichées
| De | Vers | Déclenchée par | Effet |
|---|---|---|---|
| chargement | à jour | Premier instantané reçu | Les écrans affichent la scène |
| chargement | localisation refusée | Permission refusée | Explication en une phrase et bouton vers les réglages, sur les deux écrans |
| chargement | hors ligne | Premier appel à la source en échec | Message court, sans données |
| hors ligne | à jour | Rafraîchissement réussi (les tentatives continuent toutes les 10 s hors ligne) | Les écrans affichent la scène |
| à jour | à jour | Rafraîchissement réussi | Nouvelle scène |
| à jour | périmées | Rafraîchissements en échec | Dernières données affichées avec leur heure, puis message au-delà du délai fixé par la spec des états |
| périmées | à jour | Rafraîchissement réussi | Nouvelle scène, message retiré |
| à jour, périmées ou hors ligne | localisation refusée | Permission retirée en cours d'usage (constatée au retour au premier plan) | Données effacées de la mémoire, explication et bouton vers les réglages |
| localisation refusée | chargement | Permission accordée au retour au premier plan | Reprise du cycle |
| tout état | en pause | L'app passe en arrière-plan | Aucun rafraîchissement ni tick |
| en pause | état précédent | Retour au premier plan | Rafraîchissement immédiat |

### Page Ciel (INV9)
Décisions du propriétaire du 2026-10-13. L'état d'attente est `neutre` : fond neutre, textes fixés par la spec des
états (SPEC-0008).

| De | Vers | Déclenchée par | Effet |
|---|---|---|---|
| (lancement) | neutre | Ouverture de l'app (données en chargement) | Pager à deux pages, ouvert sur Ciel |
| neutre | survol | Données à jour avec un survol en cours | Ciel montre l'avion aux couleurs de sa compagnie |
| neutre | absent | Données à jour sans survol en cours | Ciel retiré ; Prochains passages, seule page, est affichée |
| absent | survol | Un survol commence | Ciel ajouté à gauche ; la page affichée ne change pas |
| survol | survol | Un autre avion devient le survol en cours | Ciel montre le nouvel avion |
| survol | absent | Le survol se termine pendant que Prochains passages est affichée | Ciel retiré |
| survol | retenu | Le survol se termine pendant que Ciel est affichée | Ciel garde l'avion et ses dernières valeurs |
| retenu | survol | Un nouveau survol commence | Ciel montre le nouvel avion |
| retenu | absent | L'observateur glisse vers Prochains passages | Ciel retiré à la fin de la transition |
| absent, survol ou retenu | neutre | Localisation refusée, ou hors ligne sans données | Données et avion retenu effacés ; Ciel montre l'état d'attente, la page affichée ne change pas |
