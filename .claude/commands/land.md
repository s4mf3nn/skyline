---
description: Fusionner une PR en toute sécurité (sans merge queue)
argument-hint: <numéro de PR>
---

PR : $ARGUMENTS

Sans merge queue, c'est cette commande qui fait foi. Une seule PR à la fois.

1. `gh pr view $ARGUMENTS --json title,labels,mergeStateStatus,isDraft,url`. Arrête-toi si la PR est en brouillon.
2. Attends les checks : `gh pr checks $ARGUMENTS --watch`. Ils doivent tous être verts, dont `gates`, `security` et le contrôle de la trace de revue. Sinon, arrête-toi et liste ce qui échoue.
3. Si `mergeStateStatus` indique que la branche est en retard sur `main` ou en conflit, arrête-toi : dis-moi de lancer `/resolve` puis `/ship` dans le workspace de la tâche, puis de relancer `/land`.
4. Présente-moi la PR dans l'ordre de lecture de `docs/factory/RISK.md` : spec, tests, résumé, verdict du relecteur, et les fichiers signalés comme incertains ou sensibles.
5. Si la PR porte le label `risk:high` ou `contract-change`, demande-moi une confirmation explicite avant de continuer. Sans réponse claire, ne fusionne pas.
6. Fusionne : `gh pr merge $ARGUMENTS --squash --delete-branch`.
7. Rappelle-moi d'archiver le workspace (le bail est libéré à l'archivage) et indique quelle PR est la suivante à fusionner, le cas échéant.
