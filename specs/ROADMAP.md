# Roadmap des specs

<!-- Rédigée par `/roadmap <brief>`, validée par l'humain dans la PR de cadrage. Elle ordonne les specs à écrire :
chaque ligne devient une spec par `/new-spec`, qui reporte ici son identifiant. Une fois la spec écrite, sa ligne
`Dépend de` fait foi : `node scripts/plan-gate.mjs deps <SPEC-XXXX>` refuse de planifier une spec dont une dépendance
n'est pas livrée (contrat encore en `.skip`). Une ligne par tranche verticale livrable seule, de 3 à 5 tâches. -->

| Ordre | Milestone | Spec | Objet | Dépend de |
|---|---|---|---|---|
| 1 | Socle | SPEC-0000 | Bootstrap du projet | aucune |
| 2 | Socle | SPEC-0001 | Livraison, cible réelle et observabilité | SPEC-0000 |
| 3 | <milestone> | à écrire | <objet> | SPEC-0000 |
