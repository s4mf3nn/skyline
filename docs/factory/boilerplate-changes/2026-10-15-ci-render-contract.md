# Changements à reporter dans le boilerplate : CI parallélisée (jobs `render` et `contract`)

- Date : 2026-10-15
- Origine : branche `s4mf3nn/ci-gates-too-long` (skyline), PR #104
- Portée : outillage de la factory uniquement (scope `factory`, hors spec). Aucun fichier de `src/`, `specs/` ni `tests/acceptance/`.
- Objectif : suite de [2026-10-15-ci-parallele.md](2026-10-15-ci-parallele.md). Le job `gates` restait le plus long (~1 min 06 s, dont 30 s de setup puis typage, tests, rendu et contrat en série). Les tests de rendu et le contrat d'un autre lanceur passent dans des jobs parallèles. Gain estimé : ~30 s (96 s → ~65 s).

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `.github/workflows/ci.yml` | Étapes « Tests de rendu » (`pnpm test:render`) et « Contrat confié à un autre lanceur que Vitest » (`pnpm test:contract`) sorties de `gates` vers deux jobs `render` et `contract`. Chaque job : checkout (profondeur par défaut), pnpm, node, install, `gen`, puis son test. Pas de `ci-data.sh` ni de `db:migrate` (sans effet sans base). Commentaire du bloc `services: postgres` : à dupliquer aussi dans `render` et `contract` si activé |
| `.claude/commands/land.md` | Étape 3 : checks verts attendus = `gates`, `holdout`, `render`, `contract`, `security`, trace de revue |
| `docs/factory/BOILERPLATE.md` | Liste des checks requis de `main` : `render` et `contract` ajoutés |
| `docs/factory/LEXIQUE.md` | Définition de « Gates » : détail des jobs `gates`, `holdout`, `render`, `contract`, `mutation` |

## Procédure de report

1. Reporter les quatre fichiers ci-dessus dans le boilerplate (le diff de la PR #104 fait foi : `gh pr diff 104`).
2. Si le boilerplate a une base activée (bloc `services: postgres`), copier ce bloc et `env:` dans `render` et `contract`, et y ajouter `ci-data.sh setup <suffixe>` / `archive` si leurs tests touchent la base.
3. Lancer `pnpm verify` puis la PR hors spec : `ci(factory): paralléliser les tests de rendu et le contrat`.
4. Dans les réglages GitHub du dépôt dérivé : ajouter `render` et `contract` aux checks requis de `main` (plan payant seulement ; sur le plan Free, `/land` fait barrière).

## Points d'attention

- Chaque job paie ~30 s de setup : le gain réel dépend de la durée de `test:render` (~20 s) et de `test:contract` (~11 s). Les minutes CI facturées augmentent de deux jobs.
- `gates` reste le job le plus long (~1 min) : le gain est borné par lui.
- `render` et `contract` n'utilisent pas l'historique git : pas de `fetch-depth: 0`. À revoir si `scripts/contract-files.mjs` appelle git un jour.
- `release.yml` lit le run du workflow `gates` dans son ensemble : aucun changement nécessaire.
