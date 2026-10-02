# ADR-0001 : Stack technique

Date : AAAA-MM-JJ
Statut : proposée

## Contexte
<!-- À compléter : nature du produit ({{PROJECT_NAME}}), charge attendue, contraintes. -->
Le projet est développé principalement par des agents en parallèle. Les critères prioritaires sont un typage fort qui attrape les erreurs tôt, des tests rapides et une structure qui minimise les fichiers partagés.

## Décision
Imposé par la factory (déjà en place dans le dépôt) :
- Runtime : Node 22, TypeScript strict, pnpm.
- Tests : Vitest, couverture v8 (seuils à 80 %), mutation avec Stryker sur les fichiers modifiés.
- Qualité : Biome (lint et format), Lefthook, commitlint.
- Structure par feature avec montage automatique via un fichier généré (`pnpm gen`).

À décider pour ce projet :
- Type d'application : <API ou service, application web, application mobile, CLI, bibliothèque, ou plusieurs>
- Framework (HTTP, interface web ou mobile, CLI) : <à compléter>
- Validation des entrées : <à compléter>
- Persistance et migrations : <à compléter, ou « aucune »>
- Tests d'interface (rendu de composants, bout en bout) : <à compléter, ou « aucun »>
- Découpage interne d'une feature (fichiers de `src/features/<feature>/`) : <à compléter>

## Conséquences
- Aucun fichier central n'est édité à la main pour ajouter une feature.
- <à compléter : ce que la décision rend facile, difficile, et ce que les agents doivent respecter>
