# SPEC-0000 : Bootstrap du projet

Statut : BROUILLON
Risque estimé : élevé (fonde toutes les conventions)
Dépend de : aucune
Tests de contrat : `tests/acceptance/SPEC-0000.test.ts`

## Objectif
Poser le socle technique décrit dans `docs/adr/0001-stack.md` pour que toutes les specs suivantes puissent être implémentées en parallèle sans toucher de fichier commun.

## Critères d'acceptation
<!-- À adapter à la stack de l'ADR-0001, puis écrire les assertions dans tests/acceptance/SPEC-0000.test.ts. -->
- **CA1** : un point de santé observable répond, un par application du dépôt. Exemples : pour une API HTTP, `GET /health` répond `200` avec `{ "status": "ok" }` ; pour une application web ou mobile, l'écran d'accueil se rend avec son titre ; pour une CLI, `--version` sort avec le code `0` ; pour une bibliothèque, son point d'entrée exporte une fonction documentée par la spec.
- **CA2** : `pnpm verify` passe sur un repo propre.
- **CA3** : une feature ajoutée dans `src/features/<nom>/index.ts` est montée automatiquement après `pnpm gen`, sans modifier aucun autre fichier.
- **CA4** : `pnpm dev` lance l'application en local (sur `$PORT` si elle écoute sur un port ; avec plusieurs serveurs, `$PORT`, `$PORT+1`... dans l'ordre de l'ADR-0001, sans port en dur). Sans objet pour une bibliothèque.
- **CA5** : chaque service de la ligne « Services tiers » de l'ADR-0001 (et l'horloge) a une interface et un faux dans `src/shared/` ; la fabrique de l'application les reçoit, et un test de contrat le montre en passant les faux.

## Contrat d'interface
<!-- À compléter : point d'entrée testable sans processus externe (serveur, navigateur, simulateur), format d'erreur unique.
Pour une application web ou mobile : un composant racine rendu par les tests. Pour une CLI : une fonction `run(argv)`.
Exemple pour une API HTTP : -->
- Une fabrique d'application exportée par `src/app.ts`, utilisée par les tests sans ouvrir de port.
- Format d'erreur unique : `{ "error": { "code": string, "message": string } }`.

## Liste de contrôle du socle
<!-- Ce que le plan de cette spec doit couvrir selon l'ADR-0001 ; cocher ou écrire « sans objet ». Détail : guide du
boilerplate (`docs/factory/BOILERPLATE.md`), section « Options ». -->
- [ ] Disposition du dépôt (un paquet ou un paquet par application) et registre généré par runtime
- [ ] `tsconfig.json` et `tsconfig.test.json` par runtime (`jsx`, `lib`, `types`)
- [ ] Environnement de test par runtime (`vitest.config.ts`), points d'entrée exclus de la couverture et de la mutation
- [ ] Isolation des tests sur la ressource de données, `concurrency` de `stryker.config.json`
- [ ] `scripts/workspace-data.sh` si la ressource de données n'est pas Postgres en Docker (appelé aussi par la CI, secret `WORKSPACE_DATA_TOKEN`) ; `db:migrate`
- [ ] Interfaces et faux des services tiers et de l'horloge (CA5)
- [ ] `docs/factory/UI.md`, composants de base et tokens de style (interface seulement)
- [ ] Routage par fichiers : dossier et fichiers hors routes déclarés dans `factory.routeDirs` et `factory.routeIgnore` de `package.json`, layouts qui lisent le registre généré (onglets, menu)
- [ ] Point d'entrée de chaque application et dossier des migrations dans `.github/labeler.yml`, `RISK.md`, `CODEOWNERS`
- [ ] `.env.example` avec des clés factices

## Hors périmètre
Toute fonctionnalité métier. La livraison et les tests sur cible réelle : SPEC-0001.

## Contraintes
Cette spec est exécutée **seule**, avant toute autre, **une tâche à la fois** : son plan a une tâche par groupe, chacune implémentée par un agent neuf après fusion de la précédente (`node scripts/plan-gate.mjs lint` et `check` le contrôlent). Une seule tâche suffit pour une application simple ; avec plusieurs applications, par exemple : outillage commun et disposition du dépôt, puis une tâche par application, puis CI et zones de risque.

Avec une interface : elle remplit `docs/factory/UI.md` et pose les composants de base et les tokens de style qu'il cite.

## Questions ouvertes
À vider avant de passer le statut à VALIDÉE.
