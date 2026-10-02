# SPEC-0000 : Bootstrap du projet

Statut : BROUILLON
Risque estimé : élevé (fonde toutes les conventions)
Tests de contrat : `tests/acceptance/SPEC-0000.test.ts`

## Objectif
Poser le socle technique décrit dans `docs/adr/0001-stack.md` pour que toutes les specs suivantes puissent être implémentées en parallèle sans toucher de fichier commun.

## Critères d'acceptation
<!-- À adapter à la stack de l'ADR-0001, puis écrire les assertions dans tests/acceptance/SPEC-0000.test.ts. -->
- **CA1** : un point de santé observable répond (pour une API HTTP : `GET /health` répond `200` avec `{ "status": "ok" }`).
- **CA2** : `pnpm verify` passe sur un repo propre.
- **CA3** : une feature ajoutée dans `src/features/<nom>/routes.ts` est montée automatiquement après `pnpm gen`, sans modifier aucun autre fichier.
- **CA4** : `pnpm dev` démarre l'application sur `$PORT`.

## Contrat d'interface
<!-- À compléter : point d'entrée testable sans serveur, format d'erreur unique. Exemple pour une API HTTP : -->
- Une fabrique d'application exportée par `src/app.ts`, utilisée par les tests sans ouvrir de port.
- Format d'erreur unique : `{ "error": { "code": string, "message": string } }`.

## Hors périmètre
Toute fonctionnalité métier.

## Contraintes
Cette spec est exécutée **seule**, par un unique agent, avant toute autre.

## Questions ouvertes
À vider avant de passer le statut à VALIDÉE.
