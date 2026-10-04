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

`pnpm dashboard [--since AAAA-MM-JJ]` génère `.context/dashboard.html` (fichier statique, sans serveur ni JavaScript) et liste les seuils dépassés et les bloquants ; `--json` pour `/retro`. Dans Conductor, le bouton « dashboard » le génère et l'ouvre. La page a deux parties.

**Avancement du projet** (`scripts/progress.mjs`), lu sur `origin/main` (`--local` : l'arbre de travail du workspace ; `--no-github` : sans appel à `gh`, statuts déduits des fichiers seuls) :
- **Étapes du projet** : initialisation, cadrage, socle (SPEC-0000), livraison prête (SPEC-0001), specs métier, en production.
- **Roadmap** : pour chaque ligne de `specs/ROADMAP.md`, l'étape de la spec (à écrire, spécifiée, planifiée, en cours, livrée, en production) et le statut de chaque tâche de son plan (PR par nom de branche `spec-xxxx-t#-slug`, « en cours » par le bail).
- **À faire maintenant** : la prochaine commande de chaque spec (`/new-spec`, `/plan`, `/implement`, `/land`, workflow `release`).
- **Bloquants** : contrat encore en `it.todo`, questions ouvertes, dépendance non livrée ou illisible, plan `BLOQUÉ`, critère couvert par aucune tâche, PR rejetée par le relecteur, bail de plus de 24 h sans PR, `gates` rouge sur `main`.
- **Rythme** : tâches fusionnées en cumul par semaine, délai médian de la fusion d'une spec à celle de sa dernière tâche, issues `bug` et PR `fix(spec-…)` fusionnées, conflits (`HOTSPOTS.md`), règles actives (`LEARNINGS.md`).

Limites : une spec ou un plan en PR non fusionnée n'apparaît pas ; une spec dont aucune PR de tâche n'est retrouvée (branche hors convention, au-delà des 300 dernières PR) n'a ni date de livraison ni passage « en production ».

**Santé de la factory**, sur 30 jours par défaut. Elle croise trois sources :
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
