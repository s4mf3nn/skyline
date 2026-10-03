# ADR-0001 : Stack technique

Date : AAAA-MM-JJ
Statut : proposée

## Contexte
<!-- À compléter : nature du produit ({{PROJECT_NAME}}), charge attendue, contraintes. -->
Le projet est développé principalement par des agents en parallèle. Les critères prioritaires sont un typage fort qui attrape les erreurs tôt, des tests rapides et une structure qui minimise les fichiers partagés.

## Décision
Imposé par la factory (chaîne d'outils, déjà en place dans le dépôt) :
- Outillage : Node 22, pnpm, TypeScript strict. Ce n'est **pas** le runtime de l'application, qui est une décision de ce projet (voir le tableau).
- Tests : Vitest, couverture v8 (seuils à 80 %), mutation avec Stryker sur les fichiers modifiés.
- Qualité : Biome (lint et format), Lefthook, commitlint.
- Structure par feature avec montage automatique via un fichier généré (`pnpm gen`).
- Style : Tailwind pour toute application avec interface (NativeWind pour React Native, statut `choisie`) ; sans objet pour une API ou une CLI. Dernière version stable à l'initialisation, vérifiée dans la documentation.
- Observabilité : Sentry pour toute application qui s'exécute chez l'utilisateur ou sur un serveur (API, web, mobile ; CLI si ce tableau le décide), avec le SDK de son runtime ; sans objet pour une bibliothèque. Dernière version stable à l'initialisation, vérifiée dans la documentation. Il passe par le service tiers « suivi des erreurs » (`src/shared/monitoring/`, faux en test) et ne reçoit aucune donnée personnelle.

Technologies du projet. Statuts : `imposée` (exigée par l'utilisateur ; ne change que par une nouvelle ADR), `choisie` (proposée par l'agent et validée), `à décider` (le premier travail qui en a besoin la tranche par ADR).

| Technologie | Rôle | Statut | Raison | Source de la doc |
|---|---|---|---|---|
| <à compléter> | <runtime, framework serveur, framework d'interface, style, données, authentification, déploiement, autre> | <imposée / choisie / à décider> | <pourquoi> | <identifiant Context7, ou « introuvable »> |

Type d'application : <API ou service, application web, application mobile, CLI, bibliothèque, ou plusieurs>

Disposition du dépôt : <une application ; ou plusieurs dans un seul paquet (un point d'entrée par runtime dans chaque feature) ; ou un paquet par application. Voir le guide, « Options »>

À préciser pour ce projet (une ligne du tableau suffit quand le choix y figure) : validation des entrées, persistance et migrations (ou « aucune »), tests d'interface (ou « aucun »), découpage interne d'une feature (fichiers de `src/features/<feature>/`).

### Implications
<!-- À compléter, puis à faire valider : ce que les technologies ci-dessus entraînent. -->
- Runtime et conséquences : <API disponibles, pilotes de base de données utilisables>
- Stratégie de test : <comment le contrat et les scénarios cachés s'exécutent sans processus externe. Si le runtime n'est pas Node, tests adaptés (ex. Hono : `app.request()`, ou pool de tests du runtime cible), et lanceur ajouté comme dépendance à justifier. Si une partie du contrat ne peut pas tourner sous Vitest (ex. rendu React Native), son suffixe et son script (`factory.contractRunners` de `package.json`), et ce que deviennent leur couverture et leur mutation>
- Tests sur cible réelle : <navigateur, simulateur, paquet installé, ou « aucun » ; lanceur, runner de CI et versions de Node (variables `E2E_RUNNER`, `E2E_NODE_VERSIONS`)>
- Commande `dev` : <à compléter>
- Services tiers : <un par ligne : rôle (email, stockage d'objets, notifications, traceur d'événements, suivi des erreurs...), implémentation réelle, interface et faux dans `src/shared/<service>/`, ou « aucun ». Voir le guide, « Services tiers, horloge et faux »>
- Tâches planifiées : <planificateur du runtime et branchement par le point d'entrée, ou « aucune »>
- Ressource de données par workspace : <mécanisme, ou « aucune »>
- Transactions (si persistance) : <pilote et mode de connexion qui les permettent depuis le runtime (ex. un pilote HTTP sans transaction interactive ne convient pas à une écriture en plusieurs requêtes), niveau d'isolation par défaut>
- Contraintes portées par la base (si persistance) : <ce que la base garantit seule (unicité, clés étrangères, vérifications) ; dossier des migrations, à classer en zone sensible>
- Secrets et variables d'environnement : <à compléter ; au minimum le DSN Sentry de chaque application (variable d'environnement, absent en test et en développement local : le suivi est alors inactif) et le jeton d'envoi des sourcemaps (environnement `production` seulement)>
- Livraison : <cible de chaque application (hébergement, store, registre de paquets, ou « aucune »), commande `pnpm release` lancée par `.github/workflows/release.yml` (posée par SPEC-0001), mode à blanc s'il existe, secrets de l'environnement GitHub `production`, ordre migrations puis code (migrations compatibles avec la version précédente du code), retour arrière de chaque application (commande ou procédure), fichiers de livraison à classer en zone de risque>

## Conséquences
- Aucun fichier central n'est édité à la main pour ajouter une feature.
- <à compléter : ce que la décision rend facile, difficile, et ce que les agents doivent respecter>
