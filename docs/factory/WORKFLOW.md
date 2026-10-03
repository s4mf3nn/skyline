# Workflow de la factory

## Cycle d'une fonctionnalité

1. **Spec** (workspace Conductor dédié) : `/new-spec <besoin>`. L'agent pose ses questions, rédige `spec.md`, les tests de contrat en `describe.skip` et les scénarios cachés, puis les fait relire par le subagent `spec-reviewer` (critères testables, couverture, interface publique) avant d'ouvrir la PR. Tu relis spec, tests et scénarios, puis tu fusionnes cette PR toi-même. C'est l'étape où ton temps a le plus de valeur.
2. **Plan** (même workspace ou un nouveau, depuis main à jour) : `/plan SPEC-XXXX`. Le subagent `planner` produit `plan.md` avec groupes parallèles et périmètres. Le plan est commité et ouvert en PR par `/plan` ; tu relis, tu fusionnes. Tant que cette PR n'est pas fusionnée, les nouveaux workspaces ne voient pas `plan.md` : `/implement` le contrôle via `node scripts/plan-gate.mjs check <SPEC-XXXX> <T#>` et s'arrête sinon.
3. **Production** : un workspace Conductor par tâche du groupe 1, chacun avec le prompt `/implement SPEC-XXXX T#`. Chaque agent retire les scénarios cachés de son workspace, pose son bail, code dans son périmètre et boucle jusqu'à `pnpm verify` vert.
4. **Revue locale automatique** : `/implement` lance `/review` une fois `pnpm verify:quiet` vert : une pré-revue par script (`scripts/pre-review.mjs check` : périmètre, contrat, dépendances, section Context7) puis le subagent `reviewer` (contexte vierge, niveau de revue selon le risque, diff filtré ; au niveau `full` (`review:full`), sur un autre modèle que celui du producteur), corrige et relance jusqu'à 3 passages. Après un premier verdict `CHANGEMENTS`, les passages suivants ne classent en « À corriger » que les défauts du diff depuis le commit relu, pour que la boucle converge. Le verdict est enregistré par `scripts/review-gate.mjs`. `/review` permet de la relancer à la main.
5. **PR** : `/ship` vérifie, pousse (le hook `pre-push` refuse un push sans revue `OK` à jour et lance Semgrep et gitleaks, avec un simple avertissement si l'outil est absent en local) et ouvre la PR avec `.pr-summary.md`. La CI lance les gates (dont les scénarios cachés des specs entièrement implémentées), contrôle la trace de revue (`review-trace`) et pose l'étiquette de risque. Il n'y a pas de revue Claude en CI.
   Hors spec (amélioration du boilerplate ou de l'outillage), `/ship` ne bloque pas : il commite si besoin (scope `factory`), génère `.pr-summary.md` depuis le template avec « Référence : Hors spec », puis suit les mêmes étapes (verify, revue locale, push, PR `type(factory): ...`).
6. **Arbitrage** : tu lis dans l'ordre spec, tests, résumé, verdict du relecteur, puis le code seulement là où c'est signalé. Revue approfondie obligatoire si `risk:high`.
7. **Merge** : `/land <PR>`, une PR à la fois. Il vérifie que le dernier run `gates` sur `main` est vert, puis les checks de la PR, demande ta confirmation pour `risk:high` ou `contract-change`, puis fait un squash-merge. Sans ruleset ni merge queue (plan GitHub Free), `/land` et le hook `pre-push` tiennent lieu de barrières ; les gates tournent aussi sur `main` après chaque fusion, pour voir deux PR vertes séparément qui la cassent ensemble. En cas de retard sur `main` ou de conflit : `/resolve` puis `/ship` dans le workspace de la tâche.
8. **Archivage** du workspace : le bail est libéré (et la base dédiée supprimée, s'il y en a une) automatiquement.
9. On passe au groupe suivant du plan.
10. **Livraison**, quand tu le décides (après une spec, ou plusieurs) : workflow `release` lancé à la main sur `main`. Il refuse un commit dont `gates` n'est pas vert, attend ton approbation (environnement `production`) puis lance `pnpm release`. Aucun agent ne le déclenche.

## Correction d'un bug

Un bug sur du code livré ne passe ni par `/new-spec` ni par `/plan` : `/fix <numéro d'issue | description>` dans un workspace dédié. L'agent lit l'issue (ou la crée avec l'étiquette `bug`), retrouve la spec concernée, puis classe le bug avant d'écrire quoi que ce soit :

| Cas | Suite |
|---|---|
| Le code ne respecte pas la spec (critère, cas limite ou contrat d'interface non tenu) | Correctif : bail `SPEC-XXXX-FIX-<issue>`, branche `spec-xxxx-fix-<issue>-<slug>`, test qui reproduit le bug puis correction |
| La spec est fausse, muette ou contradictoire | L'agent s'arrête. Tu amendes la spec, son test de contrat et ses scénarios cachés par `/new-spec` (PR `contract-change`), puis tu relances un correctif ou une tâche |
| Le bug est dans l'outillage | Correctif hors spec (`fix(factory): ...`), avec son test |

Règles du correctif :

- **Le test d'abord.** Le test qui reproduit le bug est écrit à côté du code, jamais dans `tests/acceptance/` ni `tests/holdout/` (immuables), et il doit échouer avant la correction. La pré-revue (`scripts/pre-review.mjs check`) refuse une branche `spec-xxxx-fix-*` sans fichier `*.test.ts` ou `*.test.tsx` dans le diff.
- **Petit.** Un correctif reste dans une feature, sans migration ni changement d'interface partagée, et sans refactoring au passage. Au-delà, c'est une spec ou une tâche.
- **Mêmes barrières qu'une tâche.** Scénarios cachés retirés du workspace, périmètre contrôlé par le bail, `pnpm verify`, revue locale (le relecteur vérifie que le test reproduit bien le bug de l'issue), `/ship`, CI, `/land`.
- **Trace.** Commit et PR en `fix(spec-xxxx): ...` ; « Référence » de la PR cite la spec, le critère non tenu et `Fixes #<issue>`, ce qui ferme l'issue à la fusion.
- **Ensuite.** Chaque issue `bug` compte dans les défauts échappés (`METRICS.md`). Si le bug révèle une classe de défauts, `/fix` propose un `/learn` ; `/retro` relève les features corrigées plus d'une fois.

Si un scénario caché échoue en CI sur la PR du correctif, la procédure « En cas d'échec » ci-dessous s'applique telle quelle.

## Scénarios cachés

Les tests de contrat sont visibles de l'agent producteur : il peut les faire passer sans satisfaire l'intention (valeurs codées en dur, cas particulier). Les scénarios cachés ferment ce trou.

- **Écriture** : `/new-spec` écrit `tests/holdout/SPEC-XXXX.test.ts` (ou `.test.tsx`, ou des fichiers suffixés `SPEC-XXXX.<suffixe>.test.ts(x)` comme le contrat ; 2 à 4 parcours de bout en bout, autres données que les tests de contrat). Tu les valides dans la PR de spec. Ensuite ils sont immuables, comme le contrat (`scripts/check-contract.mjs`, label `contract-change`).
- **Invisibilité** : `/implement` commence par `node scripts/holdout.mjs hide`, qui retire le dossier du workspace (sparse-checkout, propre au workspace). `pnpm verify` ne les joue pas, et la pré-revue refuse un workspace de tâche où ils sont visibles. C'est une barrière contre l'accident, pas contre un agent qui chercherait à tricher : l'historique git les contient toujours.
- **Exécution** : en CI, étape « Scénarios cachés » du job `gates`. Les scénarios d'une spec ne sont joués que lorsqu'aucun de ses fichiers de contrat n'a plus de `.skip`. Un fichier de test de `tests/acceptance/` ou `tests/holdout/` au nom non reconnu fait échouer l'étape : il ne serait jamais joué. Les logs ne donnent qu'un décompte par spec.
- **En cas d'échec** : lance toi-même `node scripts/holdout.mjs run --details` sur la branche de la PR, dans le dépôt principal (pas dans le workspace de la tâche). Ne donne pas le scénario à l'agent. Soit l'implémentation est trop étroite : relance la tâche en nommant le critère de la spec qui n'est pas tenu, ou précise la spec. Soit le scénario exigeait plus que la spec : corrige-le dans une PR `contract-change`.

## Règles de parallélisme

- Jamais deux tâches dont les périmètres se recoupent en même temps : `node scripts/lease.mjs list` fait foi.
- Démarrer avec 2 agents en parallèle, monter à 3 ou 4 quand le taux de reprise est stable.
- Une interface partagée se fige dans une tâche « contrat » fusionnée avant les autres.

## Conflits

Petit et local : `/resolve`, le subagent tente la résolution. Gros, ou sur une migration : on jette la branche et on relance la tâche depuis main. Tout conflit est noté dans `HOTSPOTS.md`.

## Boucle d'amélioration

Chaque vendredi, 20 minutes : relire les PR rejetées, les verdicts `BLOQUANT`, les bugs (issues `bug` et PR `fix(spec-…)`) et `HOTSPOTS.md`, puis `/learn` sur chaque problème récurrent. Mettre à jour `METRICS.md`. `/retro` prépare tout ça : métriques, problèmes récurrents et `/learn` à lancer.

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
