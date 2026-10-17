# Plan SPEC-0011
Statut : PRÊT
Questions : aucune (préalables humains ci-dessous)

Constats partagés :
- **Aucun fichier de `src/`** : les deux tâches ne font que retirer un `describe.skip` de `tests/acceptance/SPEC-0011.test.ts`. Un critère CA3 à CA5 rouge sur la vraie trace est un bug de SPEC-0004 : la tâche s'arrête, ouvre une issue `bug` et le correctif passe par `/fix` sur SPEC-0004 ; aucune tâche de ce plan ne corrige `src/`.
- **Préalable P1 (propriétaire)** : `tests/acceptance/SPEC-0011.trace.json` est encore le squelette `kind: "synthetic"` alors que la PR de spec est fusionnée ; le remplacer par une trace enregistrée (format de la spec, observateur arrondi ou lieu public, champs d'`Aircraft` seulement) est une modification de contrat : PR humaine avec le label `contract-change`, à fusionner avant T1.
- **Préalable P2 (propriétaire)** : `specs/SPEC-0011-parcours-critique/preuve.md` rempli sur `main` (release sur iPhone réel, mentions légales présentes dans l'app, session Sentry), avant T2.
- **Contrats** : deux `describe` dans un seul fichier. `scripts/holdout.mjs` n'active les scénarios cachés qu'une fois **tous** les `.skip` retirés : T1 retire celui du rejeu (le rejeu protège SPEC-0004 en CI sans attendre l'iPhone), T2 (clôture, seule dans le dernier groupe) retire le dernier.
- **Bibliothèques** : aucune API de bibliothèque touchée (Vitest seul, déjà en place) ; pas de Context7. Aucun bail actif.

## Groupe 1 (parallèle)
### T1 : Rejeu de la trace enregistrée activé en CI
- Périmètre : tests/acceptance/SPEC-0011.test.ts
- Dépend de : aucune (préalable P1 ci-dessus)
- Risque : faible (seul le retrait d'un `.skip` ; aucun code applicatif, un écart révélé part en `/fix`)
- Critères de la spec couverts : CA1, CA2, CA3, CA4, CA5
- Définition de fini : sur `main` à jour, la trace vaut `kind: "recorded"` (sinon arrêt et signalement de P1) ; retrait du seul `.skip` du `describe` « rejeu de trace enregistrée », celui de la fiche de preuve reste ; CA1 à CA5 verts (`pnpm vitest run tests/acceptance/SPEC-0011.test.ts`) ; `node scripts/holdout.mjs list` montre SPEC-0011 inactive ; `pnpm verify` vert. Si CA1 ou CA2 échoue, la trace ne convient pas : retour au propriétaire (P1). Si CA3, CA4 ou CA5 échoue : arrêt, issue `bug` sur SPEC-0004 avec l'écart mesuré (avance, `passageTimeMs`, `entryActualMs`), T1 reprise après le `/fix`.

## Groupe 2 (après fusion du groupe 1)
### T2 : Clôture, fiche de preuve et activation des scénarios cachés
- Périmètre : tests/acceptance/SPEC-0011.test.ts
- Dépend de : T1 (préalable P2 ci-dessus)
- Risque : faible (seul le retrait du dernier `.skip`, qui active les scénarios cachés de SPEC-0011)
- Critères de la spec couverts : CA6
- Définition de fini : `preuve.md` sur `main` sans aucun `À REMPLIR` (sinon arrêt et signalement de P2, la tâche ne touche pas la fiche) ; retrait du dernier `.skip` (fiche de preuve), seule modification ; CA1 à CA6 verts ; `node scripts/holdout.mjs list` montre SPEC-0011 active ; `pnpm verify` vert ; job `holdout` de la CI vert. La PR rappelle la release, l'appareil et le lien Sentry relevés dans la fiche.
