---
description: Rebaser sur main et traiter un éventuel conflit (résoudre ou régénérer)
model: haiku
effort: low
---

1. `git fetch origin && git rebase origin/main`.
2. S'il n'y a pas de conflit, lance `pnpm verify:quiet`, puis `node scripts/review-gate.mjs check`. Si la revue est périmée, lance `/review`. Arrête-toi ensuite.
3. S'il y a un conflit, utilise le subagent `conflict-resolver`, puis `pnpm verify:quiet` et `/review` : une résolution de conflit modifie le code.
4. S'il répond `RÉGÉNÉRER`, fais `git rebase --abort` et dis-moi de relancer la tâche dans un nouveau workspace depuis main à jour.
5. Si la PR existe déjà, dis-moi de lancer `/ship` pour repousser.
