# ADR-0004 : Validation des entrées

Date : 2026-10-13
Statut : proposée

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
À trancher par SPEC-0007, première spec qui valide une réponse externe. Recommandation : **option 1, Zod 4**, pour la
lisibilité des schémas et le typage déduit ; version et compatibilité Hermes à vérifier dans la documentation au moment
de la spec.

## Conséquences
- Les schémas vivent avec le client de chaque source (`src/shared/adsb/`, `src/shared/routes/`), jamais dans un écran.
- La dépendance est justifiée par cette ADR dans le résumé de PR de SPEC-0007.
- Une fois tranchée, la ligne « Validation des entrées » de l'ADR-0001 renvoie ici.
