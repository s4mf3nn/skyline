# SPEC-0000 : Bootstrap du projet

Statut : BROUILLON
Risque estimé : élevé (fonde toutes les conventions)
Tests de contrat : `tests/acceptance/SPEC-0000.test.ts`

## Objectif
Poser le socle technique décrit dans `docs/adr/0001-stack.md` pour que toutes les specs suivantes puissent être implémentées en parallèle sans toucher de fichier commun.

## Critères d'acceptation
<!-- À adapter à la stack de l'ADR-0001, puis écrire les assertions dans tests/acceptance/SPEC-0000.test.ts. -->
- **CA1** : un point de santé observable répond, un par application du dépôt. Exemples : pour une API HTTP, `GET /health` répond `200` avec `{ "status": "ok" }` ; pour une application web ou mobile, l'écran d'accueil se rend avec son titre ; pour une CLI, `--version` sort avec le code `0` ; pour une bibliothèque, son point d'entrée exporte une fonction documentée par la spec.
- **CA2** : `pnpm verify` passe sur un repo propre.
- **CA3** : une feature ajoutée dans `src/features/<nom>/index.ts` est montée automatiquement après `pnpm gen`, sans modifier aucun autre fichier.
- **CA4** : `pnpm dev` lance l'application en local (sur `$PORT` si elle écoute sur un port). Sans objet pour une bibliothèque.
- **CA5** : si l'ADR-0001 prévoit une livraison, `pnpm release` existe, livre sur la cible décrite, et son mode à blanc passe quand la cible en offre un. Les secrets viennent de l'environnement GitHub `production`.

## Contrat d'interface
<!-- À compléter : point d'entrée testable sans processus externe (serveur, navigateur, simulateur), format d'erreur unique.
Pour une application web ou mobile : un composant racine rendu par les tests. Pour une CLI : une fonction `run(argv)`.
Exemple pour une API HTTP : -->
- Une fabrique d'application exportée par `src/app.ts`, utilisée par les tests sans ouvrir de port.
- Format d'erreur unique : `{ "error": { "code": string, "message": string } }`.

## Hors périmètre
Toute fonctionnalité métier.

## Contraintes
Cette spec est exécutée **seule**, par un unique agent, avant toute autre.

## Questions ouvertes
À vider avant de passer le statut à VALIDÉE.
