---
description: Transformer un incident ou une remarque récurrente en règle durable
argument-hint: <description de l'incident ou de la remarque>
---

Incident : $ARGUMENTS

Propose la forme la plus **déterministe** possible pour éviter la récidive, dans cet ordre de préférence :
1. une règle Biome ou une option TypeScript,
2. un test de non-régression,
3. une vérification dans la CI ou un script,
4. une consigne pour le subagent `reviewer`,
5. en dernier recours, une ligne dans « Règles actives » de `docs/factory/LEARNINGS.md`.

« Règles actives » est plafonnée à 10 lignes (elles sont relues par chaque agent à chaque tâche) : si le plafond est atteint, propose d'abord d'en retirer ou de convertir l'une d'elles en forme plus déterministe (journal conservé).

Si l'incident est un bug déjà corrigé par `/fix`, son test de non-régression existe : vise la classe de défauts (les autres endroits où le même bug peut se produire), pas ce cas précis.

Montre-moi la proposition avant d'appliquer, puis ajoute une entrée datée dans le journal de `LEARNINGS.md`.
