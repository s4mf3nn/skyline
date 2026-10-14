# Avancement du projet

<!-- Fichier généré par scripts/progress-table.mjs (workflow `progress`). Ne pas éditer à la main. -->
Mis à jour le 2026-10-14 d'après origin/main. Légende : ✅ fait, 🟡 en cours, ⬜ à faire.

## Étapes du projet

| | Étape | Détail |
|---|---|---|
| ✅ | Initialisation |  |
| ✅ | Cadrage |  |
| ✅ | Socle | SPEC-0000 |
| ✅ | Livraison prête | SPEC-0001 |
| 🟡 | Specs métier | 1 / 10 |
| ⬜ | En production | aucune livraison |

## Specs

| Spec | Titre | Spec | Plan | Implémentation | Livrée | Production | Étape |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| SPEC-0000 | Bootstrap du projet | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0001 | Livraison, cible réelle et observabilité | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0002 | Thème et table des compagnies | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0003 | Pager à deux pages | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0004 | Calcul de la scène, position et cap de l'observateur | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0006 | Carrousel Prochains passages | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0005 | Écran Ciel sur une source ADS-B de démonstration (branchée en dévelop… | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Spec à écrire |
| SPEC-0007 | Données réelles adsb.lol | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0008 | États d'interface | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0009 | Routes de vol et type d'appareil | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0010 | Dérives réelles (livrées des compagnies) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0011 | Parcours critique, rejeu de trace et preuve sur iPhone | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |

## Bloquants

- SPEC-0006 : dépend de SPEC-0003, SPEC-0004, pas encore livrée(s)
- SPEC-0007 : ligne « Dépend de » illisible : "SPEC-0004, SPEC-0005, SPEC-0006 (SPEC-0004 telle qu'amendée : fournisseur commun de la scène, clause de non-rafraîchissement r…
- SPEC-0008 : ligne « Dépend de » illisible : "SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007 (le pager et ses indicateurs, la scène, l'écran Ciel, l'écran Prochains…
- SPEC-0009 : ligne « Dépend de » illisible : "SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007 (SPEC-0004 telle qu'amendée : `Passage` porte la position de l'avion, voir « Décisi…
- SPEC-0010 : ligne « Dépend de » illisible : "SPEC-0002, SPEC-0004, SPEC-0005, SPEC-0006 (cette spec reste `BROUILLON` tant que SPEC-0005 n'est pas écrite : les `testID` de…
- SPEC-0011 : 3 question(s) ouverte(s) dans la spec
- SPEC-0011 : ligne « Dépend de » illisible : "SPEC-0008, SPEC-0009, SPEC-0010 (le parcours complet existe : états, routes, dérives ; cette spec reste `BROUILLON` tant que c…

## Prochaines actions

- /plan SPEC-0003 : spec fusionnée, dépendances livrées
- /plan SPEC-0004 : spec fusionnée, dépendances livrées
- /new-spec Écran Ciel sur une source ADS-B de démonstration (branchée en développement seulement, jamais dans un build livré) : couleurs de la compagnie survola…
- workflow release : livrée(s), pas en production : SPEC-0000, SPEC-0001, SPEC-0002
