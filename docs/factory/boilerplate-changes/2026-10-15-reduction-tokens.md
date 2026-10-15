# Changements à reporter dans le boilerplate : réduction de la consommation de tokens

- Date : 2026-10-15
- Origine : branche `s4mf3nn/tokens-usage-reduction` (skyline), commits `1d945ed` et `b672a98`
- Portée : outillage de la factory uniquement (scope `factory`, hors spec). Aucun fichier de `src/`, `specs/` ni `tests/acceptance/`.
- Objectif : réduire le nombre de tours et le contexte relu à chaque tour (mesures 19 à 24 de `docs/factory/TOKENS.md`).

## Résumé des mesures

| # | Mesure | Fichiers |
|---|---|---|
| 19 | Brief de revue limité au diff depuis le commit relu (passages 2 et 3) | `scripts/pre-review.mjs`, `.claude/agents/reviewer.md` |
| 20 | Règles de sobriété : une commande par appel Bash, pas de `cat` de gros fichiers, `git diff --stat` d'abord, garde-fou ~25 tours / ~120 k, `/clear` entre commandes | `CLAUDE.md` |
| 21 | Détail des conventions de code sorti de `CLAUDE.md` | `CLAUDE.md`, `docs/factory/CONVENTIONS.md` (nouveau) |
| 22 | Plafonds de taille (spec ~8 000 car., plan ~10 000), lecture par sections, cache Context7 interrogé par `grep` | `.claude/commands/{new-spec,roadmap}.md`, `.claude/agents/planner.md`, `docs/factory/CONTEXT7.md` |
| 23 | `reviewer.md` allégé (points d'une PR de plan dans un fichier à part), sortie des relecteurs ~40 lignes | `.claude/agents/{reviewer,spec-reviewer}.md`, `docs/factory/REVIEW-PLAN.md` (nouveau) |
| 24 | Traces de décision archivées | `docs/factory/archive/` |

## Détail par fichier

### À copier tel quel (nouveaux fichiers)

- `docs/factory/CONVENTIONS.md` : contenu complet de l'ancienne section « Conventions de code » de `CLAUDE.md`, lu à la demande avant d'écrire dans `src/`.
- `docs/factory/REVIEW-PLAN.md` : les 8 points de relecture d'une PR de plan, extraits de `reviewer.md` (lus seulement pour ces PR).

### Fichiers déplacés

- `docs/factory/BATTLETEST.md` → `docs/factory/archive/BATTLETEST.md`
- `docs/factory/SPEC-CONTRAINTES-TECHNO.md` → `docs/factory/archive/SPEC-CONTRAINTES-TECHNO.md`

Si le boilerplate référence ces deux chemins ailleurs (README, `WORKFLOW.md`, `LEXIQUE.md`), les mettre à jour.

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `CLAUDE.md` | Règle 1 raccourcie ; section « Conventions de code » réduite à 6 puces + renvoi vers `CONVENTIONS.md` ; section « Sobriété en tokens » étendue (pas de `cat` de `DOMAIN.md`/`PRODUCT.md`/`adr/*`, une commande par appel Bash, `git diff --stat` d'abord, `Edit` indépendants en parallèle, garde-fou 25 tours / 120 k, `/clear`) |
| `.claude/agents/reviewer.md` | Mention du brief réduit au diff depuis le commit relu ; bloc « PR de plan » remplacé par un renvoi vers `REVIEW-PLAN.md` ; sortie limitée à ~40 lignes |
| `.claude/agents/spec-reviewer.md` | Sortie limitée à ~40 lignes |
| `.claude/agents/planner.md` | Plafond `plan.md` ~10 000 caractères, sinon redécouper la spec |
| `.claude/commands/implement.md` | Étape 1 : `CLAUDE.md` déjà chargé, ne lire que « Règles actives » de `LEARNINGS.md` (`grep -A12`) |
| `.claude/commands/new-spec.md` | Étape 1 : lecture ciblée de la roadmap et des sections utiles de `PRODUCT.md`/`DOMAIN.md` ; plafond `spec.md` ~8 000 caractères |
| `.claude/commands/roadmap.md` | Étape 1 : brief lu par sections, une seule fois |
| `docs/factory/CONTEXT7.md` | Cache interrogé par `grep -n -A8 '^## <bibliothèque>'` ; requête `query-docs` ciblée sur un symbole. Pas de paramètre `tokens` (il n'existe pas dans `query-docs`) |
| `docs/factory/TOKENS.md` | Lignes 19 à 24 du tableau |
| `docs/factory/METRICS.md` | Ligne « Référence » (2 238 tours, contexte moyen 72 068) avant les mesures 19 à 24. **Valeurs propres à skyline : ne pas reporter les chiffres**, seulement l'idée d'une ligne de référence |
| `scripts/pre-review.mjs` | Voir ci-dessous |
| `tests/unit/pre-review.test.ts` | Tests de `usableReviewedHead` |

### `scripts/pre-review.mjs`

- `previousReviewedHead()` : le brief ne contient que le diff depuis le commit relu quand le verdict précédent est `CHANGEMENTS`.
- Correctif `b672a98` : le commit relu doit appartenir à la branche courante (ancêtre de `HEAD` et descendant du merge-base avec `base`). Sans cela, un `.context/review.json` laissé par une autre PR tronquait le diff.
- Nouvelle fonction exportée pure `usableReviewedHead(review, { onBranch, ancestorOfHead })`, testée à part ; helper `isAncestor(ancestor, descendant)`.

## Procédure de report

1. Copier les deux fichiers nouveaux et effectuer les deux déplacements.
2. Appliquer les diffs : `git diff 3bb574a..b672a98 -- CLAUDE.md .claude docs/factory scripts/pre-review.mjs tests/unit/pre-review.test.ts` (3bb574a est le dernier commit avant ces changements).
3. Réinitialiser `METRICS.md` du boilerplate plutôt que d'y copier les chiffres de skyline.
4. Ajuster les renvois vers les fichiers archivés.
5. Lancer `pnpm verify` dans le boilerplate puis la PR hors spec : `chore(factory): réduction de la consommation de tokens`.

## Points d'attention

- `CLAUDE.md` de skyline a une section « Le projet » propre à l'application : ne reporter que les sections génériques (règles, conventions, sobriété).
- `CONVENTIONS.md` garde le commentaire `À ajuster après l'ADR-0001` : il reste à adapter à la stack de chaque projet issu du boilerplate.
