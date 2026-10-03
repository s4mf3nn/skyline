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

Critère pour passer à la phase suivante de la roadmap (voir `WORKFLOW.md`) : deux semaines de taux de reprise stable et zéro défaut échappé sur les zones à risque.
