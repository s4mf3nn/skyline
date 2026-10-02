---
description: Vérifier, s'assurer que la revue est à jour, pousser et ouvrir la PR
model: haiku
effort: low
---

1. `git status --porcelain` doit être vide et `.pr-summary.md` doit exister. Sinon, arrête-toi. La section « Documentation consultée (Context7) » doit aussi être remplie (une bibliothèque par ligne, ou `Aucune`, ou la mention que Context7 était indisponible) : si elle est vide ou encore au texte du template, arrête-toi.
2. Lance `pnpm verify:quiet`. S'il échoue, arrête-toi.
3. `node scripts/review-gate.mjs check` :
   - s'il échoue parce que la revue est absente ou périmée, lance `/review` ;
   - si le verdict n'est pas `OK`, arrête-toi et dis-moi pourquoi. Ne corrige pas ici : la boucle de correction est dans `/implement`.
4. Remplace dans `.pr-summary.md` le bloc « ## Revue locale » par la sortie de `node scripts/review-gate.mjs section`.
5. Pousse : `git push -u origin HEAD`. Le hook `pre-push` revérifie la revue. Jamais de `--no-verify`. Si le push est refusé en non-fast-forward après un `/resolve`, utilise `git push --force-with-lease`, jamais `--force`.
6. Crée la PR : `gh pr create --base main --title "<type(spec-xxxx): description>" --body-file .pr-summary.md`. Le titre suit les Conventional Commits avec la spec en scope.
7. Affiche l'URL de la PR et rappelle que les labels de risque sont posés par la CI.
