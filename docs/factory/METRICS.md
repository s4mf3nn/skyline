# Métriques hebdomadaires

| Semaine | Tâches livrées | Taux de reprise | Défauts échappés | Erreurs de production | Conflits | Part auto-merge | Délai spec vers prod (médiane) | Tours | Contexte moyen par tour | Tokens pondérés par tâche |
|---|---|---|---|---|---|---|---|---|---|---|

Définitions :
- **Taux de reprise** : PR ayant nécessité au moins un nouveau passage agent après la CI ou la revue, divisé par les PR ouvertes.
- **Défauts échappés** : bugs trouvés après merge.
- **Erreurs de production** : nouvelles issues Sentry de la semaine en environnement `production`, avec la release qui les a introduites ; `n/d` sans livraison ou sans accès au serveur MCP `sentry`. Une issue qui demande une correction devient une issue `bug` (`/fix <lien Sentry>`) et compte alors dans les défauts échappés.
- **Délai spec vers prod** : de la fusion de la PR de spec au premier run vert du workflow `release` qui la contient ; `n/d` tant que le projet n'a pas de livraison.
- **Conflits** : lignes ajoutées à `HOTSPOTS.md` dans la semaine.
- **Tours, contexte moyen par tour** : sortie de `pnpm tokens --since <date>` (transcripts locaux). **Tokens pondérés par tâche** : total pondéré divisé par les tâches livrées (pondération : voir `scripts/token-report.mjs`). Objectif : voir ces valeurs baisser par rapport à la première ligne mesurée.

## Tableau de bord

`pnpm dashboard [--since AAAA-MM-JJ]` génère `.context/dashboard.html` (fichier statique, 30 jours par défaut) et liste les seuils dépassés ; `--json` pour `/retro`. Il croise trois sources :
- **Transcripts locaux** (`scripts/token-report.mjs`) : tokens pondérés par jour, moyenne par jour actif, par PR fusionnée. Limite : seuls les transcripts de ce poste sont lus.
- **Journal des revues** : chaque passage du relecteur (verdict, niveau, modèle, bloquants, à corriger) est ajouté à `.context/review-log.jsonl` par `review-gate.mjs record`, puis publié par `/ship` en commentaire de la PR (`review-gate.mjs publish`, marqueur `<!-- factory-review-log -->`). Le corps de la PR ne garde que le dernier verdict ; le commentaire garde les rejets. Les PR ouvertes avant ce journal n'en ont pas : elles sont comptées à part, hors des taux de revue.
- **PR GitHub** (`gh`) : fusionnées, fermées sans fusion, délai médian.

Seuils (`THRESHOLDS` dans `scripts/dashboard.mjs`), au-delà desquels `/retro` propose un `/learn` :

| Indicateur | Seuil | Lecture |
|---|---|---|
| Rejet au premier passage | 40 % | spec ou plan trop flou, ou contexte insuffisant pour l'implémenteur |
| Passages moyens par PR | 2 | la boucle de correction ne converge pas |
| PR fermées sans fusion | 20 % | tâches mal découpées, spec à amender avant de coder |
| Tokens par PR fusionnée | pas de seuil | à comparer d'une semaine à l'autre : doit baisser |

Critère pour passer à la phase suivante de la roadmap (voir `WORKFLOW.md`) : deux semaines de taux de reprise stable et zéro défaut échappé sur les zones à risque.
