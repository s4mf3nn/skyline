---
description: Fusionner une PR en toute sécurité (sans merge queue)
argument-hint: <numéro de PR>
---

PR : $ARGUMENTS

Sans merge queue, c'est cette commande qui fait foi. Une seule PR à la fois.

1. `gh pr view $ARGUMENTS --json title,labels,mergeStateStatus,isDraft,url`. Arrête-toi si la PR est en brouillon.
2. Vérifie que `main` est saine : `gh run list --branch main --workflow gates --limit 1 --json status,conclusion,url`. S'il est en cours, attends sa fin. Si la liste est vide (aucun run sur `main` : dépôt neuf), `main` n'est pas prouvée saine : dis-moi de lancer le workflow à la main, ou de pousser un commit sur `main`, avant de continuer. Toute conclusion autre que `success` (échec, `cancelled`, `timed_out`) : arrête-toi, `main` n'est pas prouvée saine ; relance le run (`gh run rerun`, par moi) ou répare `main` avant toute autre fusion.
3. Attends les checks : `gh pr checks $ARGUMENTS --watch`. Ils doivent tous être verts, dont `gates`, `holdout`, `security` et le contrôle de la trace de revue. Sinon, arrête-toi et liste ce qui échoue. Si c'est le job `holdout` (scénarios cachés), ne cherche pas le détail et ne le transmets à aucun agent : dis-moi de suivre `docs/factory/WORKFLOW.md`, section « Scénarios cachés ».
4. Si `mergeStateStatus` indique que la branche est en retard sur `main` ou en conflit, arrête-toi : dis-moi de lancer `/resolve` puis `/ship` dans le workspace de la tâche, puis de relancer `/land`.
5. Présente-moi la PR dans l'ordre de lecture de `docs/factory/RISK.md` : spec, tests, résumé, verdict du relecteur, et les fichiers signalés comme incertains ou sensibles.
6. Si la PR porte le label `risk:high` ou `contract-change`, demande-moi une confirmation explicite avant de continuer. Sans réponse claire, ne fusionne pas. Pour `contract-change`, si la ligne « Clients installés » de `docs/adr/0001-stack.md` n'est pas « aucun », rappelle-moi que les versions déjà installées appellent encore l'ancien contrat : le changement doit être un ajout, ou la spec relève la version minimale prise en charge.
7. Fusionne : `gh pr merge $ARGUMENTS --squash --delete-branch`.
8. Rappelle-moi d'archiver le workspace (le bail est libéré à l'archivage) et indique quelle PR est la suivante à fusionner, le cas échéant. Le run `gates` que cette fusion déclenche sur `main` doit être vert avant la suivante : l'étape 2 le contrôle.
