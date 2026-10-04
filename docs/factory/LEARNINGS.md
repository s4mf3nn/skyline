# Apprentissages de la factory

## Règles actives
Consignes que les agents doivent appliquer, uniquement quand aucune forme plus déterministe (lint, test, CI) n'était possible. Garder cette liste courte : **10 lignes au plus** (chaque agent la relit à chaque tâche). Au-delà, retirer une règle ou la convertir en forme plus déterministe (le journal conserve l'historique).

- (vide)

## Journal
| Date | Incident ou remarque | Forme retenue | Fichier modifié |
|---|---|---|---|

## Acquis hérités du boilerplate
Incidents du projet d'origine, déjà traités par l'outillage livré. À connaître avant de retirer l'un de ces mécanismes.

| Incident | Forme retenue | Où |
|---|---|---|
| La revue ne convergeait pas : de nouveaux points mineurs sur du code déjà relu à chaque passage | Après un verdict `CHANGEMENTS`, « À corriger » est limité au diff depuis le commit relu, le reste passe en incertitude ; `/implement` transmet les points précédents et cumule les incertitudes | `.claude/agents/reviewer.md`, `.claude/commands/implement.md`, `.claude/commands/review.md` |
| `/plan` laissait `plan.md` non commité : les nouveaux workspaces (partis de `origin/main`) ne le voyaient pas | `/plan` ouvre une PR de plan ; `/implement` contrôle que le plan est sur `origin/main` en étape 0 | `scripts/plan-gate.mjs`, `.claude/commands/plan.md`, `.claude/commands/implement.md` |
| Semgrep et gitleaks n'étaient vus qu'en CI : sorties de périmètre et réécritures d'historique | Mêmes scans dans le `pre-push` (avertissement si l'outil est absent en local, échec en CI) ; clés factices limitées à `test-key` / `key-<nom>` dans les tests | `scripts/security-scan.mjs`, `lefthook.yml`, `.gitleaks.toml` |
| Consommation de tokens trop élevée malgré un modèle moins cher | Ensemble de mesures de sobriété | `docs/factory/TOKENS.md` |
| Des conventions de `CLAUDE.md` (`biome-ignore`, `@ts-expect-error`, `Date.now()`, `throw new Error` brut, `console.log`, `!` non nul) passaient `biome check` et `tsc` : seul le relecteur pouvait les voir | Règles Biome limitées à `src/` (`noConsole`, `noNonNullAssertion`, complexité) ; contrôles par regex dans la pré-revue (`conventionViolations`) ; hook d'édition qui renvoie les erreurs Biome à l'agent | `biome.json` (`overrides`), `scripts/pre-review.mjs`, `scripts/lint-edit.mjs`, `.claude/settings.json` |
