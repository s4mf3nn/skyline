# Roadmap des specs

<!-- Rédigée par `/roadmap <brief>`, validée par l'humain dans la PR de cadrage. Elle ordonne les specs à écrire :
chaque ligne devient une spec par `/new-spec`, qui reporte ici son identifiant. Une fois la spec écrite, sa ligne
`Dépend de` fait foi : `node scripts/plan-gate.mjs deps <SPEC-XXXX>` refuse de planifier une spec dont une dépendance
n'est pas livrée (contrat encore en `.skip`). Une ligne par tranche verticale livrable seule, de 3 à 5 tâches. -->

Périmètre : la **v0** du brief (`docs/brief/cahier-des-charges-v0.md`, sections 1 à 6). Les étapes 1 à 5 du brief
sont redécoupées en tranches ; l'étape 6 (nettoyage) est sans objet (ADR-0001). Les identifiants `SPEC-0002` et
suivants sont prévisionnels : `/new-spec` reporte l'identifiant réel.

| Ordre | Milestone | Spec | Objet | Dépend de |
|---|---|---|---|---|
| 1 | Socle | SPEC-0000 | Bootstrap du projet | aucune |
| 2 | Socle | SPEC-0001 | Livraison, cible réelle et observabilité | SPEC-0000 |
| 3 | Étape 1 : thème | SPEC-0002 (à écrire) | Thème des compagnies : `fit()` et `mix()` à l'identique de `data.js`, table des compagnies (couleurs du handoff, codes IATA et OACI), résolution de la compagnie depuis l'indicatif avec repli `UNKNOWN_AIRLINE` (INV5, INV8), composant de dérive générique SVG en miroir. Interface publique : fonctions et composant exportés par la feature | SPEC-0000 |
| 4 | Étape 2 : navigation | SPEC-0003 (à écrire) | Pager horizontal à deux pages (seuil 60 pt, résistance ×0,3, 380 ms, verrouillage d'axe à 8 pt), indicateur à deux traits, ouverture sur Ciel ; pages lues dans le registre généré des features | SPEC-0000 |
| 5 | Étape 5 : calculs | SPEC-0004 (à écrire) | Calcul de la scène : distance au sol, extrapolation en ligne droite, point le plus proche, heure de passage, fenêtre « En ce moment », gisement d'arrivée, huit points cardinaux, angle de la flèche, survol en cours (INV1 à INV4) ; crochet qui lit un instantané de la source ADS-B et recalcule à chaque seconde. Tranche le point ouvert de `docs/DOMAIN.md` (cible du compte à rebours) | SPEC-0000 |
| 6 | Étape 3 : Ciel | SPEC-0005 (à écrire) | Écran Ciel sur la source ADS-B factice : couleurs de la compagnie survolante, typographie Archivo, colonne d'infos, dérive générique, flèche de direction qui tourne avec le cap du téléphone ; route affichée en repli « inconnue » jusqu'à SPEC-0009 | SPEC-0002, SPEC-0003, SPEC-0004 |
| 7 | Étape 4 : Passages | SPEC-0006 (à écrire) | Carrousel Prochains passages sur la source factice : cartes de 650 pt calées tous les 662 pt, comptes à rebours à la seconde sans re-rendre la liste, bascule en « En ce moment » à 00:00, jauge de visibilité, carte « En ce moment » | SPEC-0002, SPEC-0003, SPEC-0004 |
| 8 | Étape 5 : données réelles | SPEC-0007 (à écrire) | Client adsb.lol (conversion d'unités, avions au sol écartés, âge de la position pris en compte), validation de la réponse à la frontière (INV6), rafraîchissement toutes les 10 s en pause en arrière-plan. Tranche l'ADR-0004 (validation des entrées) | SPEC-0005, SPEC-0006 |
| 9 | Étape 5 : états | SPEC-0008 (à écrire) | États d'interface sur les deux écrans : chargement, aucun avion au-dessus (avec délai du prochain passage), aucun passage prévu, localisation refusée (bouton vers les réglages), hors ligne et données périmées ; textes proposés dans la spec et validés par l'humain | SPEC-0007 |
| 10 | Routes de vol | SPEC-0009 (à écrire) | Client adsbdb.com (ADR-0002) mis en cache par indicatif, codes et villes d'origine et de destination sur Ciel et sur les cartes, repli quand la route est inconnue. Heures et progression : **ADR-0003 à décider** avant d'écrire la spec | SPEC-0007 |
| 11 | Dérives réelles | SPEC-0010 (à écrire) | Consignation de l'autorisation des images d'`airlines-scraper` (périmètre, notice de crédit), import dans `assets/tails/`, résolution compagnie vers image avec repli SVG ; fournit le texte de crédit des mentions | SPEC-0002 |
| 12 | Parcours critique | SPEC-0011 (à écrire) | Parcours « lever les yeux au bon moment » sur iPhone réel avec un vrai survol (`docs/PRODUCT.md`, parcours 1) : bascule « En ce moment » à quelques secondes près (H3), flèche qui suit le téléphone en temps réel, défilement fluide des comptes à rebours, compte rendu des écarts au handoff | SPEC-0008, SPEC-0009, SPEC-0010 |

Notes :
- SPEC-0002, SPEC-0003 et SPEC-0004 avancent en parallèle entre elles et avec SPEC-0001 ; SPEC-0005 et SPEC-0006
  aussi ; SPEC-0010 peut avancer dès SPEC-0002 livrée.
- SPEC-0002 et SPEC-0004 sont de la logique pure : leur interface publique est l'`index.ts` de leur feature, jouée
  sous Vitest (mutation comprise). Elles fondent l'algorithme que le backend du MVP reprendra (`GET /passages`).
- Mentions légales (attribution ODbL, licence d'Archivo, non-affiliation, crédits des dérives) : réalisées par le
  propriétaire hors roadmap des agents (`docs/PRODUCT.md`, « Hors périmètre »).
- Repoussés hors v0 : mode nuit, seuils réglables, toute la liste du MVP du brief.
