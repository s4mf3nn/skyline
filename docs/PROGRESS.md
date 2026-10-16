# Avancement du projet

<!-- Fichier généré par scripts/progress-table.mjs (workflow `progress`). Ne pas éditer à la main. -->
Mis à jour le 2026-10-16 d'après origin/main. Légende : ✅ fait, 🟡 en cours, ⬜ à faire.

## Étapes du projet

| | Étape | Détail |
|---|---|---|
| ✅ | Initialisation |  |
| ✅ | Cadrage |  |
| ✅ | Socle | SPEC-0000 |
| ✅ | Livraison prête | SPEC-0001 |
| 🟡 | Specs métier | 6 / 10 |
| ⬜ | En production | aucune livraison |

## Specs

| Spec | Titre | Spec | Plan | Implémentation | Livrée | Production | Étape |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| SPEC-0000 | Bootstrap du projet | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0001 | Livraison, cible réelle et observabilité | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0002 | Thème et table des compagnies | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0003 | Pager à deux pages | ✅ | ✅ | ✅ 3/3 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0004 | Calcul de la scène, position et cap de l'observateur | ✅ | ✅ | ✅ 1/1 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0006 | Carrousel Prochains passages | ✅ | ✅ | ✅ 4/4 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0005 | Écran Ciel et présence de Ciel dans le pager | ✅ | ✅ | ✅ 5/5 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0007 | Données réelles adsb.lol | ✅ | ✅ | ✅ 3/3 | ✅ | ⬜ | Livrée, à mettre en production |
| SPEC-0008 | États d'interface | ✅ | ✅ | 🟡 2/3 | ⬜ | ⬜ | En cours |
| SPEC-0009 | Routes de vol et type d'appareil | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0010 | Dérives réelles (livrées des compagnies) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |
| SPEC-0011 | Parcours critique, rejeu de trace et preuve sur iPhone | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Plan à écrire |

## Bloquants

- SPEC-0009 : ligne « Dépend de » illisible : "SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007 (SPEC-0004 telle qu'amendée : `Passage` porte la position de l'avion, voir « Décisi…
- SPEC-0010 : ligne « Dépend de » illisible : "SPEC-0002, SPEC-0004, SPEC-0005, SPEC-0006 (cette spec reste `BROUILLON` tant que SPEC-0005 n'est pas écrite : les `testID` de…
- SPEC-0011 : 3 question(s) ouverte(s) dans la spec
- SPEC-0011 : ligne « Dépend de » illisible : "SPEC-0008, SPEC-0009, SPEC-0010 (le parcours complet existe : états, routes, dérives ; cette spec reste `BROUILLON` tant que c…

## Prochaines actions

- /implement SPEC-0008 T3 : Groupe 2 (après fusion du groupe 1) débloqué
- workflow release : livrée(s), pas en production : SPEC-0000, SPEC-0001, SPEC-0002, SPEC-0003, SPEC-0004, SPEC-0006, SPEC-0005, SPEC-0007
