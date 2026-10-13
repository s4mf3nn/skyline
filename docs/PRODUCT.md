# Produit : skyline

<!-- Rédigé par `/roadmap <brief>`, validé par l'humain dans la PR de cadrage. Une spec qui contredit ce document
demande d'abord de l'amender (même PR de cadrage). Rester court : le détail vit dans les specs. -->

Source : `docs/brief/cahier-des-charges-v0.md` (sections 1 à 6 pour la v0) et le handoff
`docs/brief/design_handoff_skyline_ciel_passages/`. Ce document couvre la **v0** ; le MVP et les versions suivantes
seront cadrés par un nouveau `/roadmap` une fois la v0 validée à l'usage (règle de passage du brief, section 8).

## Problème
Quand un avion passe dans le ciel, on ne sait pas qui il est, d'où il vient ni où il va, et on ne sait pas quand passera
le suivant. Les applications existantes (Flightradar24) répondent avec une carte dense qu'il faut lire, pas avec une
réponse immédiate à « qui est au-dessus de moi, et qui sera le suivant ? ».

## Hypothèses à valider
La v0 tranche une seule question : le rendu « Dérive » et la prévision des passages donnent-ils envie d'ouvrir l'app
plusieurs fois par jour ? Mesure pendant deux semaines d'usage par Sam et quelques testeurs (règle de passage).

| Hypothèse | Signal qui la valide | Seuil |
|---|---|---|
| H1 : l'écran Ciel et la prévision des passages donnent envie d'ouvrir l'app plusieurs fois par jour | Sessions par testeur et par jour dans TestFlight (seule source qui relie une session à un testeur) ; sessions Sentry par release en contrôle global | Médiane ≥ 3 sessions par jour et par testeur iOS, sur 14 jours consécutifs (seuil à confirmer par l'humain) |
| H2 : l'usage tient dans la durée, au-delà de l'effet de nouveauté | Testeurs actifs chaque jour pendant les deux semaines, lus dans TestFlight | Sam et au moins la moitié des testeurs iOS actifs au moins 12 jours sur 14 (seuil à confirmer par l'humain) |
| H3 : la prévision en ligne droite est assez juste pour lever les yeux au bon moment | (a) Rejeu d'une trace enregistrée : écart entre l'heure prévue d'entrée dans la fenêtre et l'entrée réelle de la trace dans cette fenêtre. (b) Sur iPhone : écart entre l'heure de passage au point le plus proche affichée et l'instant où l'observateur voit l'avion au plus près | (a) ≤ 10 s, (b) ≤ 15 s, avion en croisière sans virage (seuils à confirmer par l'humain) |

## Utilisateurs et rôles
Un seul rôle, **observateur**, sans compte ni identifiant : toute personne qui ouvre l'app (curieux et passionnés
d'aviation, riverains d'aéroports, familles, proches qui attendent un vol). Aucun droit différencié en v0, aucun autre
utilisateur visible. Les testeurs de la v0 sont des observateurs qui reçoivent l'app par TestFlight ou par le test
interne de Google Play.

## Parcours principaux
1. **Parcours critique : lever les yeux au bon moment.** L'observateur ouvre l'app et accorde la localisation
   « pendant l'utilisation ». Ciel montre le survol en cours aux couleurs de sa compagnie, ou « aucun avion au-dessus »
   avec le délai avant le prochain passage. Il glisse vers Prochains passages : la première carte annonce le prochain
   avion (compte à rebours, heure, direction d'arrivée, flèche qui suit le téléphone). Il lève les yeux dans la
   direction indiquée ; quand l'avion arrive, la carte bascule en « En ce moment » et Ciel montre ce même avion.
   Vérifié sur iPhone réel avec un vrai survol.
2. **Coup d'œil.** L'observateur entend un avion, ouvre l'app : Ciel l'identifie en une seconde (compagnie, vol,
   origine et destination, altitude, vitesse, direction).
3. **Parcours dégradés.** Localisation refusée (explication et bouton vers les réglages), hors ligne (dernières données
   avec leur heure), aucun avion au-dessus, aucun passage prévu.

## Hors périmètre
- Tout ce que le brief repousse au MVP et au-delà : hangar et collection, fiche avion, recherche, carte, alertes,
  widgets, Live Activity, réglages, onboarding, lieux enregistrés, mode ambiance, vues Radar, Tableau, Profil 60, AR.
- Backend, compte, base de données, notifications, travail en arrière-plan.
- Mode nuit (fond mélangé à 40 % de noir selon l'heure solaire) : décision du propriétaire le 2026-10-13, repoussé.
- Unités impériales et langue anglaise (métrique et français seulement).
- Seuils réglables : 4 km, 80 km, 10 passages, ±5 km et 10 s sont des constantes en v0.
- Nettoyage des écrans hors v0 (étape 6 du brief) : sans objet, le dépôt part de zéro (ADR-0001).
- Mentions légales dans l'app (attribution ODbL, licence d'Archivo, non-affiliation, crédits des dérives) : réalisées
  par le propriétaire lui-même, hors roadmap des agents (décision du 2026-10-13). Les specs ne les reprennent pas,
  mais la spec des dérives réelles fournit le texte de crédit à afficher. Ces mentions sont une obligation de licence
  (ODbL) : elles doivent être dans l'app avant la première image de dérive et avant toute livraison aux testeurs
  (critères de sortie de SPEC-0007, SPEC-0010 et SPEC-0011). Le propriétaire choisit leur emplacement et coche leur
  présence avant chaque `pnpm release` vers les stores. Si un agent y touche, il passe par le mode hors spec de la factory.
- Le matériel, le site vitrine, le checkout et le multi-devises (hors périmètre durable).

## Données personnelles
| Donnée | Pourquoi | Où elle va | Conservation |
|---|---|---|---|
| Position de l'appareil (latitude, longitude), permission « pendant l'utilisation » | Trouver le survol en cours et prévoir les passages | Reste sur l'appareil, sauf dans la requête à la source ADS-B (latitude, longitude, rayon), en `https` | Mémoire seulement, jamais écrite sur disque, jamais loggée, jamais envoyée au suivi des erreurs |
| Cap du téléphone | Orienter la flèche de direction | Reste sur l'appareil | Mémoire seulement |
| Erreurs et sessions techniques (version, environnement, feature, écran) | Stabilité et mesure de H1 et H2 | Sentry, sans donnée personnelle ni coordonnée (SPEC-0001) | Selon la rétention de Sentry |

La requête de routes de vol (adsbdb.com, ADR-0002) ne porte que l'indicatif de l'avion, jamais la position de
l'observateur. Aucune donnée n'est montrée à un autre utilisateur : il n'y en a pas en v0.

## KPI et événements produit
La v0 n'émet **aucun événement produit** : pas de SDK d'analytique, aucune nouvelle donnée sortante (décision du
propriétaire le 2026-10-13). Les KPI se lisent dans le suivi des sessions de Sentry (actif par défaut dans
`@sentry/react-native`, anonyme) et dans les statistiques par testeur de TestFlight (le test interne de Google Play ne donne pas de sessions par testeur : les
testeurs Android ne comptent que dans le total Sentry). Les testeurs iOS sont invités nominativement (e-mail), seule façon d'avoir leurs statistiques par testeur. Les sessions
Sentry sont anonymes. SPEC-0011 vérifie qu'une
session apparaît dans Sentry pour la release livrée. Une spec qui voudrait un
événement produit amende d'abord ce document.

| KPI | Calcul | Événements |
|---|---|---|
| Sessions par testeur et par jour (H1) | Médiane, sur 14 jours, du nombre de sessions par testeur iOS et par jour | Sessions TestFlight ; total Sentry en contrôle |
| Testeurs actifs chaque jour (H2) | Nombre de jours sur 14 avec au moins une session, par testeur iOS | Sessions TestFlight |
| Précision de la prévision (H3) | (a) écart calculé par le rejeu de trace ; (b) écart relevé à la main sur iPhone | Aucun (test et relevé manuel) |
| Taux de sessions sans plantage | Sessions sans erreur fatale / sessions | Sessions Sentry |

| Événement | Déclencheur | Propriétés |
|---|---|---|
| (aucun en v0) | | |
