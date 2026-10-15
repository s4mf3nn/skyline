# Changements à reporter dans le boilerplate : CI parallélisée (jobs `holdout` et `mutation`)

- Date : 2026-10-15
- Origine : branche `s4mf3nn/github-ci-simplify` (skyline), PR #99
- Portée : outillage de la factory uniquement (scope `factory`, hors spec). Aucun fichier de `src/`, `specs/` ni `tests/acceptance/`.
- Objectif : la CI était longue (~2 min 15, étapes toutes séquentielles dans `gates`). Les scénarios cachés et la mutation passent dans des jobs parallèles : le temps devient celui du job le plus long.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `.github/workflows/ci.yml` | Étape « Scénarios cachés » sortie de `gates` vers un job `holdout`. Étape « Mutation testing » sortie vers un job `mutation` (`if: github.event_name == 'pull_request'`). Chaque nouveau job refait checkout, pnpm, node, install, `ci-data.sh setup <suffixe>`, `gen`, `db:migrate`, puis `ci-data.sh archive` en `if: always()`. `gates` appelle `ci-data.sh setup gates`. Commentaire du bloc `services: postgres` : à dupliquer dans `holdout` et `mutation` si activé |
| `.claude/commands/land.md` | Étape 3 : checks verts attendus = `gates`, `holdout`, `security`, trace de revue ; l'échec des scénarios cachés se lit sur le job `holdout` |
| `docs/factory/WORKFLOW.md` | Section « Exécution » des scénarios cachés : job `holdout` au lieu de l'étape du job `gates` |
| `docs/factory/BOILERPLATE.md` | Liste des checks requis de `main` : `holdout` ajouté |

## Procédure de report

1. Reporter les quatre fichiers ci-dessus dans le boilerplate (le diff de la PR #99 fait foi : `gh pr diff 99`).
2. Si le boilerplate a une base activée (bloc `services: postgres`), copier ce bloc et `env:` dans `holdout` et `mutation`.
3. Lancer `pnpm verify` puis la PR hors spec : `fix(factory): paralléliser les jobs CI pour réduire le temps d'exécution`.
4. Dans les réglages GitHub du dépôt dérivé : ajouter `holdout` aux checks requis de `main` (plan payant seulement ; sur le plan Free, `/land` fait barrière).

## Points d'attention

- Le suffixe passé à `ci-data.sh setup` (`gates`, `holdout`, `mutation`) est obligatoire : sans lui, les trois jobs en parallèle partagent la même ressource de données et le premier `archive` supprime celle des autres.
- Chaque job paie ~30 s de setup : le gain réel dépend de la durée des scénarios cachés et de la mutation. Les minutes CI facturées augmentent.
- `mutation` n'est pas un check requis (il ne l'était pas non plus avant, étant une étape de `gates`) ; à décider si on veut qu'il bloque.
- `release.yml` lit le run du workflow `gates` dans son ensemble : aucun changement nécessaire.
- Non traité ici : `release.yml` apparaît en échec à 0 s à chaque push alors qu'il n'a que `workflow_dispatch`.
