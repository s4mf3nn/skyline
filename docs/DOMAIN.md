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
| Gisement d'arrivée | `arrivalBearingDeg` | Direction, vue de l'observateur, depuis laquelle l'avion arrive (0 au nord, sens horaire) |
| Point cardinal | `CardinalPoint` | L'un des huit secteurs N, NE, E, SE, S, SO, O, NO, de 45° chacun |
| Angle de la flèche | `arrowAngleDeg` | Gisement visé moins le cap du téléphone, ramené dans [0, 360) |
| Fenêtre « En ce moment » | `overheadWindow` | Intervalle de temps pendant lequel l'avion parcourt les ±5 km de sa trajectoire autour du point le plus proche |
| Survol en cours | `overhead` | L'avion montré par Ciel et par la carte « En ce moment » (INV1) |
| Passage | `Passage` | Prévision pour un avion : heure de passage, distance au point le plus proche, gisement d'arrivée, fenêtre |
| Prochains passages | `upcomingPassages` | Les 10 passages à venir triés par heure (INV3) |
| Compte à rebours | `countdown` | Temps restant avant le passage, affiché `MM:SS` |
| Route de vol | `FlightRoute` | Origine et destination d'un vol (codes IATA, villes, coordonnées), issues de la source des routes (ADR-0002) |

## Invariants
- **INV1** : il y a au plus un survol en cours, et c'est le même avion sur Ciel et sur la carte « En ce moment ». C'est
  l'avion dont l'heure courante est dans sa fenêtre « En ce moment » et dont le point le plus proche est à 4 km ou
  moins ; s'il y en a plusieurs, le plus proche de l'observateur à l'heure courante. (garantie par : une seule fonction
  pure de calcul de la scène, lue par les deux écrans ; décision du propriétaire du 2026-10-13, qui remplace la règle
  « distance actuelle ≤ 4 km » de l'écran Ciel du brief)
- **INV2** : un passage n'est prévu que pour un avion dont le point le plus proche est devant lui (heure de passage
  postérieure à l'heure de l'instantané, ou fenêtre en cours), à 4 km ou moins de l'observateur, et situé dans le rayon
  de 80 km. Un avion au sol, sans cap ou de vitesse sol nulle ou inconnue n'a pas de passage. (garantie par : fonction
  pure d'extrapolation, testée sur les cas du brief : approche, éloignement, passage à côté, vitesse nulle)
- **INV3** : les prochains passages sont au plus 10, triés par heure de passage croissante, sans doublon d'avion, et
  sans le survol en cours. (garantie par : fonction pure de calcul de la scène)
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
- **INV7** : la position de l'observateur ne sort de l'appareil que dans la requête à la source ADS-B ; la requête de
  routes ne porte que l'indicatif. (garantie par : tests de contrat sur les faux des deux sources et du suivi des
  erreurs ; règle de `docs/factory/DOMAIN-SECURITY.md`)
- **INV8** : aucune couleur ni image de compagnie n'est inventée : une compagnie absente de la table prend
  `UNKNOWN_AIRLINE`, une compagnie sans image autorisée prend la dérive générique SVG. (garantie par : résolution de la
  compagnie dans une fonction pure, testée sur un indicatif inconnu)

**Point à trancher par la spec des calculs de passage.** Le brief fait basculer la carte en « En ce moment » à 00:00
et définit la fenêtre comme ±5 km autour du point le plus proche : si le compte à rebours vise le point le plus proche,
l'avion entre dans la fenêtre (≈ 23 s à 780 km/h) avant 00:00. Recommandation : le compte à rebours et « Passe à »
visent l'entrée dans la fenêtre, pour que 00:00 coïncide avec la bascule et avec INV1.

## Cycles de vie
### Passage (carte du carrousel)
| De | Vers | Déclenchée par | Effet |
|---|---|---|---|
| (aucun) | à venir | Un rafraîchissement prévoit un passage qui entre dans les 10 premiers | Carte ajoutée à sa place dans l'ordre des heures |
| à venir | à venir | Rafraîchissement | Heure, gisement et compte à rebours recalculés ; la carte peut changer de rang |
| à venir | en ce moment | L'horloge atteint le début de la fenêtre (compte à rebours à 00:00) et l'avion devient le survol en cours (INV1) | La carte passe en tête, en version « En ce moment » ; Ciel montre cet avion |
| à venir | retiré | Rafraîchissement qui ne prévoit plus le passage (virage, sortie du rayon, rang > 10) | Carte retirée sans animation particulière |
| en ce moment | terminé | L'horloge dépasse la fin de la fenêtre, ou un autre avion devient le survol en cours | Carte retirée ; Ciel passe au survol suivant ou à « aucun avion au-dessus » |

### Données affichées
| De | Vers | Déclenchée par | Effet |
|---|---|---|---|
| chargement | à jour | Premier instantané reçu | Les écrans affichent la scène |
| chargement | localisation refusée | Permission refusée | Explication en une phrase et bouton vers les réglages, sur les deux écrans |
| chargement | hors ligne | Premier appel à la source en échec | Message court, sans données |
| à jour | à jour | Rafraîchissement réussi | Nouvelle scène |
| à jour | périmées | Rafraîchissements en échec | Dernières données affichées avec leur heure, puis message au-delà du délai fixé par la spec des états |
| périmées | à jour | Rafraîchissement réussi | Nouvelle scène, message retiré |
| localisation refusée | chargement | Permission accordée au retour au premier plan | Reprise du cycle |
| tout état | en pause | L'app passe en arrière-plan | Aucun rafraîchissement ni tick |
| en pause | état précédent | Retour au premier plan | Rafraîchissement immédiat |
