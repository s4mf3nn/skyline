# Workflow de la factory

## Cycle d'une fonctionnalité

1. **Spec** (workspace Conductor dédié) : `/new-spec <besoin>`. L'agent pose ses questions, rédige `spec.md`, les tests de contrat en `describe.skip` et les scénarios cachés, puis les fait relire par le subagent `spec-reviewer` (critères testables, couverture, interface publique) avant d'ouvrir la PR. Tu relis spec, tests et scénarios, puis tu fusionnes cette PR toi-même. C'est l'étape où ton temps a le plus de valeur.
2. **Plan** (même workspace ou un nouveau, depuis main à jour) : `/plan SPEC-XXXX`. Le subagent `planner` produit `plan.md` avec groupes parallèles et périmètres. Le plan est commité et ouvert en PR par `/plan` ; tu relis, tu fusionnes. Tant que cette PR n'est pas fusionnée, les nouveaux workspaces ne voient pas `plan.md` : `/implement` le contrôle via `node scripts/plan-gate.mjs check <SPEC-XXXX> <T#>` et s'arrête sinon.
3. **Production** : un workspace Conductor par tâche du groupe 1, chacun avec le prompt `/implement SPEC-XXXX T#`. Chaque agent retire les scénarios cachés de son workspace, pose son bail, code dans son périmètre et boucle jusqu'à `pnpm verify` vert.
4. **Revue locale automatique** : `/implement` lance `/review` une fois `pnpm verify:quiet` vert : une pré-revue par script (`scripts/pre-review.mjs check` : périmètre, contrat, dépendances, section Context7) puis le subagent `reviewer` (contexte vierge, niveau de revue selon le risque, diff filtré ; en risque élevé, sur un autre modèle que celui du producteur), corrige et relance jusqu'à 3 passages. Après un premier verdict `CHANGEMENTS`, les passages suivants ne classent en « À corriger » que les défauts du diff depuis le commit relu, pour que la boucle converge. Le verdict est enregistré par `scripts/review-gate.mjs`. `/review` permet de la relancer à la main.
5. **PR** : `/ship` vérifie, pousse (le hook `pre-push` refuse un push sans revue `OK` à jour et lance Semgrep et gitleaks, avec un simple avertissement si l'outil est absent en local) et ouvre la PR avec `.pr-summary.md`. La CI lance les gates (dont les scénarios cachés des specs entièrement implémentées), contrôle la trace de revue (`review-trace`) et pose l'étiquette de risque. Il n'y a pas de revue Claude en CI.
   Hors spec (amélioration du boilerplate ou de l'outillage), `/ship` ne bloque pas : il commite si besoin (scope `factory`), génère `.pr-summary.md` depuis le template avec « Référence : Hors spec », puis suit les mêmes étapes (verify, revue locale, push, PR `type(factory): ...`).
6. **Arbitrage** : tu lis dans l'ordre spec, tests, résumé, verdict du relecteur, puis le code seulement là où c'est signalé. Revue approfondie obligatoire si `risk:high`.
7. **Merge** : `/land <PR>`, une PR à la fois. Il vérifie que le dernier run `gates` sur `main` est vert, puis les checks de la PR, demande ta confirmation pour `risk:high` ou `contract-change`, puis fait un squash-merge. Sans ruleset ni merge queue (plan GitHub Free), `/land` et le hook `pre-push` tiennent lieu de barrières ; les gates tournent aussi sur `main` après chaque fusion, pour voir deux PR vertes séparément qui la cassent ensemble. En cas de retard sur `main` ou de conflit : `/resolve` puis `/ship` dans le workspace de la tâche.
8. **Archivage** du workspace : le bail est libéré (et la base dédiée supprimée, s'il y en a une) automatiquement.
9. On passe au groupe suivant du plan.

## Scénarios cachés

Les tests de contrat sont visibles de l'agent producteur : il peut les faire passer sans satisfaire l'intention (valeurs codées en dur, cas particulier). Les scénarios cachés ferment ce trou.

- **Écriture** : `/new-spec` écrit `tests/holdout/SPEC-XXXX.test.ts` (2 à 4 parcours de bout en bout, autres données que les tests de contrat). Tu les valides dans la PR de spec. Ensuite ils sont immuables, comme le contrat (`scripts/check-contract.mjs`, label `contract-change`).
- **Invisibilité** : `/implement` commence par `node scripts/holdout.mjs hide`, qui retire le dossier du workspace (sparse-checkout, propre au workspace). `pnpm verify` ne les joue pas, et la pré-revue refuse un workspace de tâche où ils sont visibles. C'est une barrière contre l'accident, pas contre un agent qui chercherait à tricher : l'historique git les contient toujours.
- **Exécution** : en CI, étape « Scénarios cachés » du job `gates`. Les scénarios d'une spec ne sont joués que lorsque son test de contrat n'a plus aucun `.skip`. Les logs ne donnent qu'un décompte par spec.
- **En cas d'échec** : lance toi-même `node scripts/holdout.mjs run --details` sur la branche de la PR, dans le dépôt principal (pas dans le workspace de la tâche). Ne donne pas le scénario à l'agent. Soit l'implémentation est trop étroite : relance la tâche en nommant le critère de la spec qui n'est pas tenu, ou précise la spec. Soit le scénario exigeait plus que la spec : corrige-le dans une PR `contract-change`.

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

Prérequis de la phase 3, où plus personne ne lit les PR `risk:low` : des scénarios cachés sur chaque spec, et `gates` vert sur `main`.

## Sobriété en tokens

Les mesures qui limitent la consommation (extrait de tâche, cache Context7, vérification silencieuse, pré-revue par script, niveaux de revue, modèles par commande) sont décrites dans `docs/factory/TOKENS.md`.
