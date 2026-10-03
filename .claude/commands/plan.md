---
description: Découper une spec fusionnée en tâches avec périmètres et groupes parallèles
argument-hint: <SPEC-XXXX>
---

Contrôle d'abord que les specs dont elle dépend sont livrées : `node scripts/plan-gate.mjs deps $ARGUMENTS`. En cas d'échec, arrête-toi et recopie son message : on ne planifie pas une spec avant ses dépendances (voir `specs/ROADMAP.md`).

Utilise ensuite le subagent `planner` sur la spec $ARGUMENTS. Le plan doit rester lisible tâche par tâche : `node scripts/split-plan.mjs list $ARGUMENTS` doit lister toutes les tâches une fois `plan.md` écrit (titres `### T# : …`).

Une fois `plan.md` écrit :

1. Les nouveaux workspaces Conductor partent de `origin/main` : un `plan.md` non fusionné leur est invisible. Une PR de plan ne contient que `plan.md`. Commite-le (Conventional Commits, `docs(spec-xxxx): add implementation plan`).
2. Rédige `.pr-summary.md` d'après `.github/pull_request_template.md` (section « Documentation consultée (Context7) » remplie d'après le plan), lance `/review`, puis `/ship` (push et PR de plan, à fusionner par un humain).
3. N'affiche les prompts qu'après la PR créée, avec la mention explicite : « À coller seulement après fusion de la PR de plan ». Pour chaque groupe, donne le prompt exact `/implement $ARGUMENTS T<n>`.
4. Termine en donnant la commande de contrôle à lancer une fois la PR fusionnée : `node scripts/plan-gate.mjs check $ARGUMENTS`.
