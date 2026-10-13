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
| 3 | Étape 1 : thème | SPEC-0002 | Thème des compagnies : `fit()` et `mix()` à l'identique de `data.js`, table des compagnies (couleurs du handoff, codes IATA et OACI), résolution de la compagnie depuis l'indicatif avec repli `UNKNOWN_AIRLINE` (INV5, INV8), composant de dérive générique SVG en miroir. Interface publique : `src/shared/airlines/index.ts` (fonctions) et `tail.tsx` (composant), lus par Ciel et Passages | SPEC-0000 |
| 4 | Étape 2 : navigation | SPEC-0003 (amendement à écrire avant `/plan`) | Pager horizontal à deux pages (seuil 60 pt, résistance ×0,3, 380 ms, verrouillage d'axe à 8 pt), indicateur à deux traits, ouverture sur Ciel ; pages lues dans le registre généré des features. Interface publique : `src/shared/pager/index.ts` (logique) et `pager.tsx` (composant), monté par `createApp`. **Amendement (2026-10-13)** : une page peut être absente (INV9) ; le pager rend alors une seule page, sans indicateur ni glissement, et s'ouvre sur la page présente (Prochains passages). Une page qui apparaît ne change pas la page affichée ; le retrait de la page affichée la fait passer à la page restante par la transition de 380 ms, qu'il suive un glissement ou non. La page affichée est la page de repos, destination comprise d'une transition en cours. La présence d'une page est déclarée par sa feature hors de son écran : la feature exporte, dans son `feature`, un crochet facultatif de présence que le pager appelle même quand l'écran n'est pas monté, et le pager lui fournit la page affichée ; un retrait pendant un glissement annule le geste (INV9). La règle propre à Ciel reste à SPEC-0005. L'amendement réécrit aussi les phrases « s'ouvre sur Ciel » de SPEC-0003 et leurs tests de contrat | SPEC-0000 |
| 5 | Étape 5 : calculs | SPEC-0004 (amendement à écrire avant `/plan`, voir notes) | Calcul de la scène : distance au sol, extrapolation en ligne droite, point le plus proche, heure de passage, fenêtre « En ce moment », gisement d'arrivée, huit points cardinaux, angle de la flèche, survol en cours (INV1 à INV4) ; acquisition de la position de l'observateur (permission « pendant l'utilisation », lecture de la position, relecture au retour au premier plan) et du cap du téléphone dans `src/shared/location/`, sur l'interface et le faux de SPEC-0000 (retour au premier plan : service `AppLifecycle`, `src/shared/lifecycle/`) ; crochet `useScene` (`src/shared/scene/`, lu par Ciel et Passages) qui lit la position et un instantané de la source ADS-B à la demande et recalcule à chaque seconde (le minuteur de 10 s reste à SPEC-0007). Tranche le point ouvert de `docs/DOMAIN.md` : le compte à rebours vise l'entrée dans la fenêtre | SPEC-0000 |
| 6 | Étape 3 : Ciel | SPEC-0005 (à écrire) | Écran Ciel sur une source ADS-B de démonstration (branchée en développement seulement, jamais dans un build livré) : couleurs de la compagnie survolante, typographie Archivo, colonne d'infos (Vitesse, Altitude, Cap en point cardinal, Compagnie, Vol en forme IATA, Appareil « — » tant que le type n'est pas fourni), dérive générique ; présence de Ciel dans le pager et avion retenu (INV9, cycle « Page Ciel ») : fonction pure de présence et crochet de présence dans la feature Ciel, qui détient l'avion retenu (état gardé hors de l'écran, démonté quand Ciel est absent) et le transmet à l'écran. Sans flèche de direction et bloc route masqué jusqu'à SPEC-0009 (décisions du propriétaire du 2026-10-13) | SPEC-0002, SPEC-0003, SPEC-0004 |
| 7 | Étape 4 : Passages | SPEC-0006 | Carrousel Prochains passages sur la source factice (source de démonstration `src/shared/adsb/demo.ts`, branchée en développement seulement) : cartes de 650 pt calées tous les 662 pt, comptes à rebours à la seconde sans re-rendre la liste, bascule en « En ce moment » à 00:00, jauge de visibilité, carte « En ce moment » | SPEC-0002, SPEC-0003, SPEC-0004 |
| 8 | Étape 5 : données réelles | SPEC-0007 (à écrire) | Client adsb.lol (conversion d'unités, avions au sol écartés, âge de la position pris en compte), validation de la réponse à la frontière (INV6), rafraîchissement toutes les 10 s en pause en arrière-plan, position envoyée à adsb.lol arrondie à 3 décimales (règle de la PR `factory`). Tranche l'ADR-0004 (validation des entrées). Critère de sortie : attribution ODbL du propriétaire présente dans l'app (les données réelles l'exigent) | SPEC-0005, SPEC-0006 |
| 9 | Étape 5 : états | SPEC-0008 (à écrire) | États d'interface : chargement, aucun passage prévu, localisation refusée (bouton vers les réglages), hors ligne, sur Prochains passages seulement (Ciel n'existe pas sans avion, INV9) ; données périmées sur les deux écrans ; textes proposés dans la spec et validés par l'humain | SPEC-0007 |
| 10 | Routes de vol | SPEC-0009 (à écrire) | Préalables : PR `factory` des règles de routes (hôtes nommés, indicatif validé avant d'entrer dans le chemin, zone `**/shared/routes/`) et ligne « Source des routes de vol » de l'ADR-0001 renvoyant à l'ADR-0002. Client adsbdb.com (ADR-0002) mis en cache par indicatif, codes et villes d'origine et de destination sur Ciel et sur les cartes, repli quand la route est inconnue. Heures et progression : **ADR-0003 à décider** avant d'écrire la spec | SPEC-0007 |
| 11 | Dérives réelles | SPEC-0010 (à écrire) | Consignation de l'autorisation des images d'`airlines-scraper` (périmètre, notice de crédit), import dans `assets/tails/`, résolution compagnie vers image avec repli SVG, affichage sur Ciel et sur les cartes ; fournit le texte de crédit. Critère de sortie : les mentions du propriétaire (crédits des dérives compris) sont présentes dans l'app avant la fusion de la première image | SPEC-0002, SPEC-0005, SPEC-0006 |
| 12 | Parcours critique | SPEC-0011 (à écrire) | Parcours « lever les yeux au bon moment » (`docs/PRODUCT.md`, parcours 1). Contrat testable : rejeu d'une trace ADS-B enregistrée (fixture) contre le calcul de la scène avec l'horloge factice, l'écart entre l'entrée prévue et l'entrée réelle de la trace dans la fenêtre en assertion, ≤ 10 s pour un avion en croisière sans virage (H3, mesure a). Relevé manuel de la mesure b. Preuve sur iPhone réel avec un vrai survol : flèche qui suit le téléphone, défilement fluide des comptes à rebours, compte rendu des écarts au handoff, session visible dans Sentry pour la release livrée. Critère de sortie : mentions du propriétaire présentes avant toute livraison aux testeurs | SPEC-0008, SPEC-0009, SPEC-0010 |

Notes :
- SPEC-0002, SPEC-0003 et SPEC-0004 avancent en parallèle entre elles et avec SPEC-0001 ; SPEC-0005 et SPEC-0006
  aussi ; SPEC-0010 avance en parallèle de SPEC-0007 à SPEC-0009.
- SPEC-0002 et SPEC-0004 sont de la logique pure : leur interface publique est un `index.ts` (`src/shared/airlines/` pour SPEC-0002, `src/shared/scene/` pour SPEC-0004), jouée
  sous Vitest (mutation comprise). Elles fondent l'algorithme que le backend du MVP reprendra (`GET /passages`).
- Mentions légales (attribution ODbL, licence d'Archivo, non-affiliation, crédits des dérives) : réalisées par le
  propriétaire hors roadmap des agents (`docs/PRODUCT.md`, « Hors périmètre »). Elles sont un préalable de SPEC-0010
  et de toute livraison aux testeurs (critères de sortie de SPEC-0010 et SPEC-0011) ; une modification faite par un
  agent passe par le mode hors spec de la factory.
- PR `factory`, portée par le propriétaire, à fusionner avant le premier `/new-spec` métier (SPEC-0009 la présuppose
  aussi) :
  1. `DOMAIN-SECURITY.md` : hôtes sortants nommés (`api.adsb.lol`, `api.adsbdb.com`, `https`) ; l'hôte n'est jamais
     une donnée reçue, un segment de chemin reçu (indicatif) est validé par format (ADR-0002).
  2. `DOMAIN-SECURITY.md` : la requête de routes ne porte que l'indicatif, jamais la position de l'observateur (INV7).
  3. `DOMAIN-SECURITY.md` : la position envoyée à adsb.lol est arrondie à 3 décimales (environ 100 m) ; le calcul local
     garde la position exacte.
  4. `RISK.md`, `.github/labeler.yml`, `CODEOWNERS` : zone sensible `**/shared/routes/` (`review:full`).
  5. `DOMAIN-SECURITY.md` : la règle « mentions, test de rendu » devient une vérification du propriétaire avant release.
  6. `docs/adr/0001-stack.md` : la ligne « Source des routes de vol » renvoie à l'ADR-0002.
- Repoussés hors v0 : mode nuit, seuils réglables, toute la liste du MVP du brief.
- Amendement du 2026-10-13 (une seule scène pour l'app, INV1) : la présence de Ciel, Ciel et Passages lisent la même
  instance de la scène (même instantané, même survol en cours). Le crochet `useScene` de SPEC-0004 est par consommateur
  (requête et abonnement au cap à chaque montage, CA12 et CA16) : un amendement de SPEC-0004 (spec et tests de contrat,
  `/new-spec SPEC-0004`), qui pose un fournisseur commun dans `src/shared/scene/`, est fusionné avant `/plan SPEC-0004`,
  donc avant SPEC-0005 et SPEC-0006.
- Amendement du 2026-10-13 (Ciel conditionnel, INV9) : l'amendement de SPEC-0003 (spec et tests de contrat, par une
  PR de spec lancée avec `/new-spec SPEC-0003`) est fusionné avant `/plan SPEC-0003` et avant `/new-spec SPEC-0005`. L'état « aucun avion au-dessus »
  et son délai sont abandonnés (plus de Ciel sans survol). Le paragraphe « Ce que lit chaque écran » du contrat de
  SPEC-0004 cite encore la flèche et le délai de Ciel : texte informatif, sans critère ni test ; `docs/DOMAIN.md`
  (« Angle de la flèche », INV9) fait foi et SPEC-0005 ne les reprend pas.
