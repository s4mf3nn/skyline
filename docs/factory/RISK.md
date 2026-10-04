# Zones de risque et routage

La source technique est `.github/labeler.yml` (lue par la CI et par `scripts/pre-review.mjs`) ; ce document explique le pourquoi. Le niveau de revue `full` (relecteur sur Opus) ne suit pas `risk:high` : il vient de l'étiquette `review:full` (auth, administration, migrations, config, `docker-compose.yml`), pour garder Opus rare. L'outillage de la factory reste en risque élevé (revue humaine) mais se relit en `standard`. Toute modification de l'un doit être répercutée dans l'autre, et dans `.github/CODEOWNERS` pour le niveau élevé.

| Niveau | Chemins | Pourquoi | Revue | Traitement |
|---|---|---|---|---|
| Sensible | <zones sensibles du domaine, voir `DOMAIN-SECURITY.md`> | <à compléter> | `full` (Opus) | Revue humaine approfondie, jamais d'auto-merge |
| Sensible | `**/features/auth/`, `**/shared/**/auth*`, `**/features/admin/` | Accès, rôles et abus ; une surface d'administration agit sur les données de tous | `full` (Opus) | Idem |
| Sensible | `**/migrations/`, `**/config/`, `docker-compose.yml` | Données et environnement | `full` (Opus) | Idem |
| Sensible | `**/shared/monitoring/`, `**/sentry.*`, `**/.sentryclirc` | Suivi des erreurs : une fuite y envoie des données personnelles à un tiers | `full` (Opus) | Idem |
| Élevé | `.github/`, `scripts/`, `CLAUDE.md`, `.claude/` | Modifient la factory elle-même | `standard` (Sonnet) | Revue humaine obligatoire, jamais d'auto-merge |
| Cadrage | `specs/`, `docs/PRODUCT.md`, `docs/DOMAIN.md`, `docs/adr/` | Décident du quoi pour toutes les specs suivantes | PR de spec ou de cadrage (`spec-reviewer`) ; protégés par `CODEOWNERS` seulement, sans étiquette de risque | Revue humaine obligatoire, jamais d'auto-merge |
| Contrat | `tests/acceptance/`, `tests/holdout/` | Définissent ce qui est juste | Label `contract` ; toute modification après fusion demande `contract-change` |
| Moyen | `service.ts`, `repo.ts`, `**/db/schema/`, `**/shared/`, `package.json` de chaque paquet, point d'entrée de chaque application (posé par SPEC-0000) | Logique métier, code partagé entre features, dépendances | Revue humaine rapide : spec, tests, résumé |
| Faible | Tout le reste, diff < 400 lignes | | Auto-merge possible en phase 3 (voir `WORKFLOW.md`) |

Les chemins applicatifs de ce tableau commencent par `**/` : ils valent pour `src/` comme pour un paquet (`web/src/`, `apps/api/src/`). Ce sont des valeurs par défaut pensées pour une API avec base de données ; un chemin absent du projet est sans effet, mais il laisse sans protection ce qu'il était censé couvrir (ex. des migrations écrites ailleurs que dans un dossier `migrations/`). Adapte-les au type d'application de l'ADR-0001, et contrôle-les avec `node scripts/pre-review.mjs zones`, qui liste les globs de `labeler.yml` ne correspondant à aucun fichier du dépôt et les fichiers `.sql` qu'aucune zone `risk:high` ne couvre (lancé par `/retro`). Exemples : application web ou mobile, configuration de build et de publication, stockage de session et navigation protégée en élevé, état partagé et appels réseau en moyen ; CLI ou bibliothèque, surface publique (`exports`, `bin`) et fichiers de publication en élevé.

## Contrôles automatiques avant ta lecture

Toute PR a passé `pnpm verify`, une revue locale `OK` du subagent `reviewer` (tracée dans le corps de la PR avec le modèle utilisé, contrôlée par le job `review-trace`) et les gates de CI, dont les scénarios cachés quand la spec est entièrement implémentée. La revue ne remplace pas ta lecture sur `risk:high` : elle la prépare.

## Ordre de lecture humaine

1. La spec était-elle la bonne ?
2. Les tests couvrent-ils réellement la spec ?
3. Le résumé de l'agent et le verdict du relecteur, dont les écarts à la conception validée dans la PR de plan (« Décisions prises »).
4. Le code, uniquement aux endroits signalés comme incertains ou sensibles.
