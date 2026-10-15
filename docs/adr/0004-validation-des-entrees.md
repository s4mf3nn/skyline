# ADR-0004 : Validation des entrées

Date : 2026-10-13
Statut : acceptée

## Contexte
L'ADR-0001 laisse `à décider` la façon de valider les entrées à la frontière : réponses d'adsb.lol et d'adsbdb.com
(ADR-0002), et plus tard les deep links. INV6 (`docs/DOMAIN.md`) exige qu'une réponse invalide ou partielle donne un
champ `null` ou une erreur typée, jamais un plantage. Le code tourne sous Hermes ; la validation est de la logique pure
jouée sous Vitest, mutation comprise.

Options :
1. **Zod 4** (mini ou classique) : schémas déclaratifs, types déduits, très répandu ; quelques dizaines de Ko dans le
   bundle, `zod/mini` réduit cette taille.
2. **Valibot** : même modèle, découpé en fonctions, bundle plus léger ; moins connu des agents et des relecteurs.
3. **Gardes de type écrites à la main** : aucune dépendance, mais du code répétitif et plus de cas à tester, pour deux
   formats de réponse riches en champs facultatifs.

## Décision
**Option 1, Zod 4**, épinglé en `4.6.5` exact (SPEC-0007) : schémas lisibles, types déduits, repli par champ avec
`.catch(null)`. Hermes n'autorise pas `new Function`, que Zod utilise pour sa compilation rapide : chaque module qui
valide appelle `z.config({ jitless: true })` en tête, ce qui désactive cette compilation. Les tests unitaires
vérifient le comportement sous Vitest ; la compatibilité Hermes reste à confirmer sur appareil (SPEC-0007, T3).

## Conséquences
- Les schémas vivent avec le client de chaque source (`src/shared/adsb/`, `src/shared/routes/`), jamais dans un écran.
- La dépendance est justifiée par cette ADR dans le résumé de PR de SPEC-0007.
- La ligne « Validation des entrées » de l'ADR-0001 renvoie ici.
