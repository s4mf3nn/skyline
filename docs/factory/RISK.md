# Zones de risque et routage

La source technique est `.github/labeler.yml` (lue par la CI et par `scripts/pre-review.mjs`) ; ce document explique le pourquoi. Toute modification de l'un doit être répercutée dans l'autre, et dans `.github/CODEOWNERS` pour le niveau élevé.

| Niveau | Chemins | Pourquoi | Traitement |
|---|---|---|---|
| Élevé | <zones sensibles du domaine, voir `DOMAIN-SECURITY.md`> | <à compléter> | Revue humaine approfondie, jamais d'auto-merge |
| Élevé | `src/features/auth/` | Accès et abus | Idem |
| Élevé | `src/db/migrations/`, `src/config/`, `docker-compose.yml` | Données et environnement | Idem |
| Élevé | `.github/`, `scripts/`, `CLAUDE.md`, `.claude/` | Modifient la factory elle-même | Idem |
| Contrat | `tests/acceptance/`, `tests/holdout/` | Définissent ce qui est juste | Label `contract` ; toute modification après fusion demande `contract-change` |
| Moyen | `service.ts`, `repo.ts`, `src/db/schema/`, `package.json` | Logique métier et dépendances | Revue humaine rapide : spec, tests, résumé |
| Faible | Tout le reste, diff < 400 lignes | | Auto-merge possible en phase 3 (voir `WORKFLOW.md`) |

## Contrôles automatiques avant ta lecture

Toute PR a passé `pnpm verify`, une revue locale `OK` du subagent `reviewer` (tracée dans le corps de la PR avec le modèle utilisé, contrôlée par le job `review-trace`) et les gates de CI, dont les scénarios cachés quand la spec est entièrement implémentée. La revue ne remplace pas ta lecture sur `risk:high` : elle la prépare.

## Ordre de lecture humaine

1. La spec était-elle la bonne ?
2. Les tests couvrent-ils réellement la spec ?
3. Le résumé de l'agent et le verdict du relecteur.
4. Le code, uniquement aux endroits signalés comme incertains ou sensibles.
