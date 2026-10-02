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

Technologies du projet. Statuts : `imposée` (exigée par l'utilisateur ; ne change que par une nouvelle ADR), `choisie` (proposée par l'agent et validée), `à décider` (le premier travail qui en a besoin la tranche par ADR).

| Technologie | Rôle | Statut | Raison | Source de la doc |
|---|---|---|---|---|
| <à compléter> | <runtime, framework serveur, framework d'interface, style, données, authentification, déploiement, autre> | <imposée / choisie / à décider> | <pourquoi> | <identifiant Context7, ou « introuvable »> |

Type d'application : <API ou service, application web, application mobile, CLI, bibliothèque, ou plusieurs>

À préciser pour ce projet (une ligne du tableau suffit quand le choix y figure) : validation des entrées, persistance et migrations (ou « aucune »), tests d'interface (ou « aucun »), découpage interne d'une feature (fichiers de `src/features/<feature>/`).

### Implications
<!-- À compléter, puis à faire valider : ce que les technologies ci-dessus entraînent. -->
- Runtime et conséquences : <API disponibles, pilotes de base de données utilisables>
- Stratégie de test : <comment le contrat et les scénarios cachés s'exécutent sans processus externe. Si le runtime n'est pas Node, tests adaptés (ex. Hono : `app.request()`, ou pool de tests du runtime cible), et lanceur ajouté comme dépendance à justifier, enchaîné par `pnpm verify`>
- Commande `dev` : <à compléter>
- Ressource de données par workspace : <mécanisme, ou « aucune »>
- Secrets et variables d'environnement : <à compléter>
- Déploiement : <à compléter>

## Conséquences
- Aucun fichier central n'est édité à la main pour ajouter une feature.
- <à compléter : ce que la décision rend facile, difficile, et ce que les agents doivent respecter>
