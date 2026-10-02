---
description: Corriger un bug sur une spec livrée, avec un test de non-régression, le relire et ouvrir la PR
argument-hint: <numéro d'issue | description du bug>
---

Bug : $ARGUMENTS

0. Retire les scénarios cachés de ce workspace : `node scripts/holdout.mjs hide`. Tu ne lis jamais `tests/holdout/`, ni dans un autre dossier ni par git.
1. Lis `CLAUDE.md` et les règles actives de `docs/factory/LEARNINGS.md`. Si l'argument est un numéro, lis l'issue (`gh issue view <n>`). Sinon, pose-moi les questions qui manquent (étapes pour reproduire, résultat attendu, résultat observé), puis crée l'issue : `gh issue create --label bug --title "<titre>" --body "<étapes, attendu, observé>"`. Garde son numéro.
2. Trouve la spec concernée (`specs/SPEC-XXXX-*/spec.md`) à partir de la feature touchée et lis ses critères d'acceptation, ses cas limites et son contrat d'interface. Lis le code de la feature pour localiser la cause. N'écris encore rien.
3. Classe le bug, et dis-moi dans quel cas on est avant de continuer :
   - **A. Le code ne respecte pas la spec** (un critère, un cas limite ou le contrat d'interface n'est pas tenu) : continue à l'étape 4.
   - **B. La spec est fausse, muette ou contradictoire** sur ce comportement : arrête-toi. Corriger ici reviendrait à décider du contrat à ma place. Propose `/new-spec` pour amender la spec, son test de contrat et ses scénarios cachés (PR `contract-change`), puis un correctif ou une tâche une fois cette PR fusionnée.
   - **C. Le bug est dans l'outillage** (`scripts/`, `.claude/`, `.github/`, `docs/factory/`, config) : pas de spec, pas de bail. Écris le test qui reproduit le bug, corrige, puis `/ship` en mode hors spec (`fix(factory): ...`).
   - Si le correctif demande une migration, change une interface partagée ou dépasse une feature, arrête-toi et propose une spec ou une tâche (règle 6) : ce n'est plus un correctif.
4. Pose le bail sur le plus petit périmètre qui contient la cause et son test (en général `src/features/<feature>`) : `node scripts/lease.mjs acquire <SPEC-XXXX-FIX-n> <chemins>`, où `n` est le numéro de l'issue. En cas d'échec, arrête-toi et dis-moi quel bail bloque.
5. Renomme la branche : `git branch -m spec-xxxx-fix-<n>-<slug>`. Ce nom fait passer `/ship` en mode `spec` et active le contrôle du test de non-régression dans la pré-revue.
6. Écris d'abord le test qui reproduit le bug, à côté du code (`*.test.ts` de la feature), jamais dans `tests/acceptance/` ni `tests/holdout/`. Lance-le (`pnpm exec vitest run <fichier>`) et vérifie qu'il **échoue pour la raison décrite dans l'issue**. S'il passe, tu n'as pas reproduit le bug : ne corrige rien à l'aveugle, reviens à l'étape 2 ou demande-moi des précisions.
7. Corrige la cause, pas le symptôme, en restant dans le périmètre : pas de refactoring ni d'amélioration au passage. Si le code appelle ou configure une bibliothèque, applique `docs/factory/CONTEXT7.md`. Mêmes conventions que pour une tâche (voir « Conventions de code » dans `CLAUDE.md`). Le test de l'étape 6 doit passer sans avoir été affaibli.
8. Pendant la boucle, lance seulement les contrôles ciblés (`pnpm exec vitest run <fichiers>`, `pnpm exec tsc --noEmit`). Avant de commiter, boucle jusqu'à ce que `pnpm verify:quiet` soit vert. Crée (ou écrase) `.pr-summary.md` avec, au minimum, « Référence » (spec, `Correctif : Fixes #<n>` à la place de la tâche, critère ou cas limite non tenu) et « Documentation consultée (Context7) » : le relecteur s'en sert pour savoir quoi vérifier. Puis commite : `fix(spec-xxxx): <description en français>`.
9. Revue adversariale, au maximum 3 passages, comme à l'étape 7 de `/implement` : `/review`, correction des points `Bloquants` et `À corriger`, `pnpm verify:quiet`, commit, puis `/review --loops N` avec les points précédents. Si le verdict n'est pas `OK` après le 3e passage, arrête-toi et résume ce qui bloque. Ne contourne jamais le relecteur.
10. Complète `.pr-summary.md` selon `.github/pull_request_template.md`. Dans « Intention », donne la cause du bug et pourquoi les tests existants ne l'ont pas vu. Reprends les « Points d'incertitude » du relecteur et ajoute le bloc produit par `node scripts/review-gate.mjs section`.
11. Enchaîne avec `/ship` (titre de PR : `fix(spec-xxxx): ...`). La fusion ferme l'issue grâce à `Fixes #<n>`.
12. Si le bug révèle une classe de défauts qui peut se reproduire ailleurs (pas seulement ce cas), propose-moi la commande `/learn <description>` à lancer. Ne la lance pas. Ne libère pas le bail : il est libéré à l'archivage du workspace.
