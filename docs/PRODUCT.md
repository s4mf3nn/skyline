# Produit : {{PROJECT_NAME}}

<!-- Rédigé par `/roadmap <brief>`, validé par l'humain dans la PR de cadrage. Une spec qui contredit ce document
demande d'abord de l'amender (même PR de cadrage). Rester court : le détail vit dans les specs. -->

## Problème
<!-- Le problème de l'utilisateur, en deux ou trois phrases, sans parler de solution. -->

## Hypothèses à valider
<!-- Ce qui doit être vrai pour que le produit ait de la valeur, et comment on le saura (métrique, seuil, échéance).
Une hypothèse non tranchée qui change le produit (ex. deux modèles possibles) est listée ici, pas décidée par un agent. -->
| Hypothèse | Signal qui la valide | Seuil |
|---|---|---|

## Utilisateurs et rôles
<!-- Qui utilise le produit, et avec quels droits (ex. utilisateur, modérateur, administrateur). Chaque rôle qui a des
droits propres apparaît dans la section « Acteurs et rôles » des specs qui le concernent. -->

## Parcours principaux
<!-- Le parcours critique de bout en bout en premier : c'est lui que le MVP doit faire passer, sur cible réelle. -->

## Hors périmètre
<!-- Ce que le produit ne fait volontairement pas dans cette version. -->

## Données personnelles
<!-- Données collectées, pourquoi, qui y accède, durée de conservation, ce qui n'est jamais exposé à un autre
utilisateur. Chaque ligne devient une règle de `docs/factory/DOMAIN-SECURITY.md`. -->

## KPI et événements produit
<!-- Ce qu'on mesure pour savoir si le produit marche. Chaque KPI se calcule à partir d'événements émis par le code
(un événement par ligne : nom en snake_case anglais, déclencheur, propriétés sans donnée personnelle). Une spec qui
crée un déclencheur reprend l'événement dans ses critères. -->
| KPI | Calcul | Événements |
|---|---|---|

| Événement | Déclencheur | Propriétés |
|---|---|---|
