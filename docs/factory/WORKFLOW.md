# Workflow de la factory

## Cycle d'une fonctionnalité

1. **Spec** (workspace Conductor dédié) : `/new-spec <besoin>`. L'agent pose ses questions, rédige `spec.md` et les tests de contrat en `describe.skip`. Tu relis spec et tests, puis tu fusionnes cette PR toi-même. C'est l'étape où ton temps a le plus de valeur.
2. **Plan** (même workspace ou un nouveau, depuis main à jour) : `/plan SPEC-XXXX`. Le subagent `planner` produit `plan.md` avec groupes parallèles et périmètres. Le plan est commité et ouvert en PR par `/plan` ; tu relis, tu fusionnes. Tant que cette PR n'est pas fusionnée, les nouveaux workspaces ne voient pas `plan.md` : `/implement` le contrôle via `node scripts/plan-gate.mjs check <SPEC-XXXX> <T#>` et s'arrête sinon.
3. **Production** : un workspace Conductor par tâche du groupe 1, chacun avec le prompt `/implement SPEC-XXXX T#`. Chaque agent pose son bail, code dans son périmètre et boucle jusqu'à `pnpm verify` vert.
4. **Revue locale automatique** : `/implement` lance `/review` une fois `pnpm verify:quiet` vert : une pré-revue par script (`scripts/pre-review.mjs check` : périmètre, contrat, dépendances, section Context7) puis le subagent `reviewer` (contexte vierge, niveau de revue selon le risque, diff filtré), corrige et relance jusqu'à 3 passages. Après un premier verdict `CHANGEMENTS`, les passages suivants ne classent en « À corriger » que les défauts du diff depuis le commit relu, pour que la boucle converge. Le verdict est enregistré par `scripts/review-gate.mjs`. `/review` permet de la relancer à la main.
5. **PR** : `/ship` vérifie, pousse (le hook `pre-push` refuse un push sans revue `OK` à jour et lance Semgrep et gitleaks, avec un simple avertissement si l'outil est absent en local) et ouvre la PR avec `.pr-summary.md`. La CI lance les gates, contrôle la trace de revue (`review-trace`) et pose l'étiquette de risque. Il n'y a pas de revue Claude en CI.
   Hors spec (amélioration du boilerplate ou de l'outillage), `/ship` ne bloque pas : il commite si besoin (scope `factory`), génère `.pr-summary.md` depuis le template avec « Référence : Hors spec », puis suit les mêmes étapes (verify, revue locale, push, PR `type(factory): ...`).
6. **Arbitrage** : tu lis dans l'ordre spec, tests, résumé, verdict du relecteur, puis le code seulement là où c'est signalé. Revue approfondie obligatoire si `risk:high`.
7. **Merge** : `/land <PR>`, une PR à la fois. Il vérifie les checks, demande ta confirmation pour `risk:high` ou `contract-change`, puis fait un squash-merge. Sans ruleset ni merge queue (plan GitHub Free), `/land` et le hook `pre-push` tiennent lieu de barrières. En cas de retard sur `main` ou de conflit : `/resolve` puis `/ship` dans le workspace de la tâche.
8. **Archivage** du workspace : le bail est libéré (et la base dédiée supprimée, s'il y en a une) automatiquement.
9. On passe au groupe suivant du plan.

## Règles de parallélisme

- Jamais deux tâches dont les périmètres se recoupent en même temps : `node scripts/lease.mjs list` fait foi.
- Démarrer avec 2 agents en parallèle, monter à 3 ou 4 quand le taux de reprise est stable.
- Une interface partagée se fige dans une tâche « contrat » fusionnée avant les autres.

## Conflits

Petit et local : `/resolve`, le subagent tente la résolution. Gros, ou sur une migration : on jette la branche et on relance la tâche depuis main. Tout conflit est noté dans `HOTSPOTS.md`.

## Boucle d'amélioration

Chaque vendredi, 20 minutes : relire les PR rejetées, les verdicts `BLOQUANT`, les bugs et `HOTSPOTS.md`, puis `/learn` sur chaque problème récurrent. Mettre à jour `METRICS.md`. `/retro` prépare tout ça : métriques, problèmes récurrents et `/learn` à lancer.

## Roadmap d'autonomie

<!-- Proposition à ajuster : seuls la phase 3 (auto-merge) et le critère de passage viennent du projet d'origine. -->
| Phase | Parallélisme | Merge |
|---|---|---|
| 1 | 2 agents | Humain sur toutes les PR (`/land`) |
| 2 | 3 ou 4 agents | Humain sur toutes les PR, lecture allégée hors `risk:high` |
| 3 | 3 ou 4 agents | Auto-merge des PR `risk:low` (ligne à décommenter dans `.github/workflows/risk.yml`) |

Critère de passage : voir `METRICS.md`. Phase en cours : 1.

## Sobriété en tokens

Les mesures qui limitent la consommation (extrait de tâche, cache Context7, vérification silencieuse, pré-revue par script, niveaux de revue, modèles par commande) sont décrites dans `docs/factory/TOKENS.md`.
