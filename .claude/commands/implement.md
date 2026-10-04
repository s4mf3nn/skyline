---
description: Implémenter une tâche d'un plan dans ce workspace, la relire et ouvrir la PR
argument-hint: <SPEC-XXXX> <T#>
model: sonnet
effort: medium
---

Tâche : $ARGUMENTS

0. Contrôle que le plan est fusionné : `node scripts/plan-gate.mjs check <SPEC-XXXX> <T#>`. En cas d'échec, arrête-toi et recopie son message : le plan doit être sur `origin/main` (PR de plan fusionnée) avant tout bail. Retire ensuite les scénarios cachés de ce workspace : `node scripts/holdout.mjs hide`. Tu ne lis jamais `tests/holdout/`, ni dans un autre dossier ni par git.
1. Lis `CLAUDE.md` et les règles actives de `docs/factory/LEARNINGS.md`. Pour la spec et la tâche, lance `node scripts/split-plan.mjs task <SPEC-XXXX> <T#>` : il donne la tâche, les critères de la spec qu'elle couvre et, si la tâche y renvoie, le préambule du plan (`--with-preamble` pour le forcer). Ne lis `plan.md` et `spec.md` en entier que si cette sortie est insuffisante, et dis pourquoi dans le résumé de PR.
2. Pose le bail : `node scripts/lease.mjs acquire <SPEC-XXXX-T#> <chemins du périmètre>`. En cas d'échec, arrête-toi et dis-moi quel bail bloque.
   Une fois le bail posé, signale la tâche en cours sur le tableau : `node scripts/board.mjs start <SPEC-XXXX> <T#>` (informatif : s'il échoue, continue).
3. Renomme la branche : `git branch -m spec-xxxx-t#-<slug>`.
4. Si la « Définition de fini » de la tâche demande de retirer le `.skip` (dernière tâche de la spec : son retrait active les scénarios cachés en CI), retire-le du `describe` de chaque fichier de contrat de la spec dans `tests/acceptance/` (`SPEC-XXXX.test.ts(x)` et fichiers suffixés `SPEC-XXXX.<suffixe>.test.ts(x)`) et ne touche à rien d'autre dans ces fichiers. Sinon, laisse le `.skip`.
5. Avant d'écrire du code qui appelle une bibliothèque ou qui la configure, applique `docs/factory/CONTEXT7.md` (cache `docs/factory/libs-cache.md` d'abord, Context7 à la version épinglée seulement pour une API nouvelle) et alimente le cache. Garde la liste des bibliothèques consultées pour le résumé de PR.
   Si la tâche a un bloc `Conception`, il a été validé par l'humain dans la PR de plan : reprends ses fichiers, ses signatures et son arbre d'appels, et avance dans son « Ordre de construction », une tranche à la fois, en la vérifiant de bout en bout (test ciblé, et `curl` ou écran si l'application tourne) avant de passer à la suivante. Si la conception se révèle fausse ou impossible, ne la contourne pas en silence : un écart local se note pour « Décisions prises » du résumé de PR (ce qui change, pourquoi) ; un écart qui touche une interface partagée ou le périmètre t'arrête (règle 2).
   Écris ensuite les tests unitaires, puis le code, en restant strictement dans le périmètre. Écris les commentaires en français ; messages d'erreur, codes d'erreur, identifiants, noms de tests et logs en anglais ; privilégie un code simple et lisible, sans astuce (voir « Conventions de code » dans `CLAUDE.md`).
6. Pendant la boucle, lance seulement les contrôles ciblés (`pnpm exec vitest run <fichiers>`, `pnpm exec tsc --noEmit`). Avant de commiter, boucle jusqu'à ce que `pnpm verify:quiet` (qui lance `pnpm verify`, sortie filtrée, log complet dans `.context/verify.log`) soit vert. Crée (ou écrase) `.pr-summary.md` avec au minimum la section « Documentation consultée (Context7) » remplie (« Nouvelles dépendances » si tu en ajoutes : `/review` le contrôle par script ; « Décisions prises » si tu t'es écarté de la conception) : le relecteur la compare au diff. Puis commite (Conventional Commits, spec en scope).
7. Revue adversariale, au maximum 3 passages :
   - lance `/review` (pré-revue par script, puis subagent `reviewer`, contexte vierge). Si la pré-revue signale des violations, corrige-les, commite et relance `/review` : ce n'est pas un passage.
   - Aux passages 2 et 3, passe en arguments de `/review` les points `Bloquants` et `À corriger` du passage précédent, tels quels, avec `--loops N` ;
   - si le verdict est `OK`, continue ;
   - sinon corrige les points `Bloquants` et `À corriger`, mets à jour la section « Documentation consultée (Context7) » de `.pr-summary.md` si les bibliothèques utilisées ont changé, relance `pnpm verify:quiet`, commite, et relance `/review` (arguments : `--loops N` et les points à vérifier) ;
   - si le verdict n'est pas `OK` après le 3e passage, arrête-toi, résume ce qui bloque et propose un redécoupage (règle 6). Ne contourne jamais le relecteur.
8. Complète le résumé de PR selon `.github/pull_request_template.md` dans `.pr-summary.md` (ignoré par git). La section « Documentation consultée (Context7) » est déjà remplie et à jour. Reprends les « Points d'incertitude » du relecteur, cumulés sur tous les passages (le dernier passage ne ré-énumère pas ceux déjà signalés), et ajoute le bloc produit par `node scripts/review-gate.mjs section`.
9. Enchaîne avec `/ship`.
10. Ne libère pas le bail : il est libéré à l'archivage du workspace.
