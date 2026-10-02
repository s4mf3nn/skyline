---
description: Lancer une relecture adversariale locale du diff courant et enregistrer le verdict
argument-hint: [--loops N] [points précédents]
---

Arguments : $ARGUMENTS

1. Vérifie que tout est commité (`git status --porcelain` vide). Sinon, arrête-toi : la revue porte sur les commits, pas sur le répertoire de travail.
2. Lance `node scripts/pre-review.mjs check` (périmètre, contrat, dépendances déclarées, section Context7 : sans modèle). S'il échoue, affiche les violations et arrête-toi sans lancer le relecteur ni enregistrer de verdict : elles se corrigent avant la revue.
3. Utilise le subagent `reviewer` sur le diff de ce workspace par rapport à `origin/main` ; il obtient le niveau de revue et le diff filtré avec `node scripts/pre-review.mjs brief`. Si les arguments contiennent les points `Bloquants` et `À corriger` d'un passage précédent (hors `--loops N`), transmets-les tels quels dans le prompt du subagent. Affiche son verdict tel quel, sans le commenter ni le corriger.
4. Enregistre-le avec `node scripts/review-gate.mjs record <OK|CHANGEMENTS|BLOQUANT>`, en reprenant la valeur de la première ligne `VERDICT :` (reprends `--loops N` des arguments s'il y est).
