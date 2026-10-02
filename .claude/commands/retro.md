---
description: Préparer la boucle d'amélioration du vendredi
model: haiku
effort: low
---

1. Liste les PR fusionnées et les PR fermées sans fusion des 7 derniers jours avec `gh pr list --state all --search "updated:>=<date>"`.
2. Calcule les lignes de `docs/factory/METRICS.md` : tâches livrées, taux de reprise (proxy : PR dont la section « Revue locale » indique plus d'un passage, ou avec des commits poussés après l'ouverture), conflits (lignes ajoutées à `HOTSPOTS.md` cette semaine), délai spec vers prod quand il est calculable, sinon `n/d`. Indique le proxy utilisé. Pour « défauts échappés », utilise les issues `bug` ouvertes cette semaine (`gh issue list --label bug --state all --search "created:>=<date>"`) et demande-moi de confirmer.
3. Lance `pnpm tokens --since <date>` et reprends le total, le nombre de tours et le contexte moyen par tour dans la ligne (colonnes tokens de `METRICS.md`).
4. Ajoute la ligne à `METRICS.md` sans commiter.
5. Relève les problèmes récurrents : PR fermées, PR à plusieurs passages de revue, fichiers présents plus d'une fois dans `HOTSPOTS.md`, features ou specs corrigées plus d'une fois (PR `fix(spec-…)` fusionnées, sur 30 jours), revues `waive` (raison dans la PR).
6. Pour chaque problème récurrent, propose la commande `/learn <description>` à lancer. Ne les lance pas.
7. Dis-moi si les critères de `METRICS.md` pour passer à la phase suivante de la roadmap sont remplis.
