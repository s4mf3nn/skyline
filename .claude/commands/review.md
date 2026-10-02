---
description: Lancer une relecture adversariale locale du diff courant et enregistrer le verdict
argument-hint: [--loops N] [points précédents]
---

Arguments : $ARGUMENTS

1. Vérifie que tout est commité (`git status --porcelain` vide). Sinon, arrête-toi : la revue porte sur les commits, pas sur le répertoire de travail.
2. Lance `node scripts/pre-review.mjs check` (périmètre, contrat, dépendances déclarées, section Context7 : sans modèle). S'il échoue, affiche les violations et arrête-toi sans lancer le relecteur ni enregistrer de verdict : elles se corrigent avant la revue.
3. Choisis le relecteur avec `node scripts/pre-review.mjs kind` :
   - `spec` (le diff ne contient que des specs, des tests de contrat et des scénarios cachés) : subagent `spec-reviewer` ;
   - `code` : subagent `reviewer`, sur le diff de ce workspace par rapport à `origin/main` ; il obtient le niveau de revue et le diff filtré avec `node scripts/pre-review.mjs brief`.
4. Choisis son modèle : si `node scripts/pre-review.mjs level` répond `full`, lance le subagent avec le modèle `opus` (paramètre `model` de l'outil Agent), sauf si ta propre session tourne déjà sur Opus : garde alors le modèle du subagent (`sonnet`). En zone à risque élevé, le relecteur ne tourne jamais sur le modèle qui a écrit le code. Aux autres niveaux, garde le modèle du subagent.
5. Si les arguments contiennent les points `Bloquants` et `À corriger` d'un passage précédent (hors `--loops N`), transmets-les tels quels dans le prompt du subagent. Affiche son verdict tel quel, sans le commenter ni le corriger.
6. Enregistre-le avec `node scripts/review-gate.mjs record <OK|CHANGEMENTS|BLOQUANT> --model <modèle du relecteur>`, en reprenant la valeur de la première ligne `VERDICT :` (reprends `--loops N` des arguments s'il y est). Au niveau `full`, `--model` est obligatoire : le script refuse l'enregistrement sans lui. Il contrôle sa présence, pas sa valeur : le choix du modèle à l'étape 4 reste une consigne.
