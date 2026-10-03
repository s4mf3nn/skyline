# Sobriété en tokens

Mesures qui limitent la consommation de la factory. Le choix d'un modèle moins cher change le prix par token, pas leur nombre : le coût vient de la structure du workflow (contexte relu à chaque tour, plans entiers relus, revue qui repart de zéro à chaque passage, documentation rechargée).

## Mesure de référence

À faire après les premières tâches avec `pnpm tokens` (transcripts locaux de tous les workspaces, subagents compris), puis chaque semaine avec `pnpm tokens --since <date>` ; les valeurs vont dans `METRICS.md`. Repère du projet d'origine, avant ces mesures : environ 60 500 tokens de contexte relus par tour.

## Mesures

| # | Mesure | Où |
|---|---|---|
| 1 | Extrait d'une tâche au lieu de `plan.md` + `spec.md` en entier | `scripts/split-plan.mjs`, `/implement`, `reviewer` |
| 2 | Critères de la spec joints à l'extrait (CA/CU cités par la tâche, cas limites si mentionnés) | `scripts/split-plan.mjs` |
| 3 | « Règles actives » plafonnées à 10 lignes | `LEARNINGS.md`, `/learn` |
| 4 | Cache des vérifications de bibliothèques, consulté avant Context7 | `docs/factory/libs-cache.md`, `docs/factory/CONTEXT7.md` |
| 5 | Context7 réservé aux API nouvelles (implémenteur, relecteur, planner) | `CONTEXT7.md`, `reviewer.md`, `planner.md` |
| 6 | Boucle de développement avec contrôles ciblés ; `pnpm verify` complet seulement avant de commiter | `/implement` |
| 7 | `pnpm verify:quiet` : une ligne si vert, erreurs filtrées sinon, log complet dans `.context/verify.log` | `scripts/verify-quiet.mjs`, `package.json`, `/implement`, `/fix`, `/ship`, `/resolve`, `conflict-resolver` |
| 8 | Lectures en parallèle, pas de relecture après édition | `CLAUDE.md` (section « Sobriété en tokens ») |
| 9 | Pré-revue par script : périmètre, contrat, dépendances déclarées, section Context7 | `scripts/pre-review.mjs check`, `/review` |
| 10 | Diff filtré pour le relecteur (sans lockfile, `*.gen.ts`, tests de contrat) | `scripts/pre-review.mjs brief` |
| 11 | Niveau de revue selon le risque (`full` seulement pour `review:full`, `standard` pour `risk:high`/`risk:medium`, `light` sinon, d'après `.github/labeler.yml`) | `scripts/pre-review.mjs level`, `reviewer.md` |
| 12 | Passages 2 et 3 : seul le diff depuis le commit relu est lu | `reviewer.md` |
| 13 | Connecteurs claude.ai (Gmail, Calendar, Drive, Docs) et claude-in-chrome refusés pour le projet par des règles `permissions.deny` ; context7, sentry (lecture seule, pour `/fix` et `/retro`) et Conductor restent. Pour utiliser Chrome sur une tâche d'interface, retire `mcp__claude-in-chrome` de `deny` | `.claude/settings.json` (`permissions.deny`) |
| 14 | Plugins généralistes désactivés pour le projet (la factory a ses propres commandes) | `.claude/settings.json` (`enabledPlugins`) |
| 15 | `CLAUDE.md` court : sécurité du domaine et procédure Context7 dans `docs/factory/` (lues à la demande) | `CLAUDE.md`, `DOMAIN-SECURITY.md`, `CONTEXT7.md` |
| 16 | Haiku + effort bas pour les commandes mécaniques (`retro`, `resolve`, `ship` ; **pas `land`**, qui porte les barrières de merge et reste sur le modèle par défaut) ; Sonnet par défaut du projet (`settings.json`), Sonnet effort moyen pour `/implement`, `spec-reviewer`, `reviewer` et `conflict-resolver`, Sonnet effort bas pour `/review` (orchestration seule) ; au niveau `full` seulement, le relecteur passe sur Opus si le producteur n'y est pas (voir `/review`) | `.claude/commands/{retro,resolve,ship,review}.md`, `.claude/agents/` |
| 16b | **Opus réservé à quatre cas** : cadrage (`/roadmap`), rédaction de spec (`/new-spec`) et découpage (`planner`), parce qu'une erreur s'y propage à toute la suite ; relecteur au niveau `full` (`review:full`). Tout le reste tourne sur Sonnet ou Haiku | `.claude/commands/{roadmap,new-spec}.md`, `.claude/agents/planner.md`, `/review` |
| 17 | Plans de 3 à 5 tâches, préambule court, titres exacts pour le script | `planner.md`, `/plan` |
| 18 | Mesure : `pnpm tokens`, colonnes dans `METRICS.md`, étape dans `/retro` | `scripts/token-report.mjs`, `METRICS.md`, `retro.md` |

## À vérifier sur chaque poste

- Les règles `deny` ne s'appliquent qu'à une **nouvelle** session : lance `/context` et contrôle que les connecteurs refusés ont disparu. Sinon, désactive-les dans `/mcp` (par projet) ou dans les réglages des connecteurs claude.ai (global, hors du dépôt).
- `enabledPlugins` : adapte la liste aux plugins installés sur le poste ; `/context` ne doit plus lister leurs skills.
- Les skills utilisateur (réglage global `~/.claude/settings.json`) restent chargés : hors du dépôt.
- Le modèle par défaut du projet est `sonnet` (`.claude/settings.json`) ; il l'emporte sur la config globale. Pour travailler sur Opus ponctuellement, change-le avec `/model` dans la session.

## Dépendances entre mesures

À connaître avant d'en retirer une : si tu retires un script, retire aussi ses appels.
- 1 et 2 vivent dans `split-plan.mjs` ; `CLAUDE.md`, `/implement` et `reviewer.md` l'appellent.
- 7 : `/implement`, `/fix`, `/ship`, `/resolve` et `conflict-resolver` appellent `verify:quiet`.
- 9 à 11 : `/review` et `reviewer.md` appellent `pre-review.mjs`.
- 4 et 15 : `CLAUDE.md` pointe vers `CONTEXT7.md` et `DOMAIN-SECURITY.md`.
- Les tests des scripts sont `tests/unit/{split-plan,verify-quiet,pre-review,token-report}.test.ts`.
