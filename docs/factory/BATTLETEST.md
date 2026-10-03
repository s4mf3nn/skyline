# Battletest du boilerplate sur trois formes de projet

Date : 2026-10-02 (analyse), 2026-10-03 (lots 1 à 6). Base de l'analyse : `main` à `a589488`. Trace de décision, conservée comme `SPEC-CONTRAINTES-TECHNO.md` : les notes décrivent le boilerplate **avant** les lots.

Méthode : pour chaque forme, lecture du boilerplate comme si le projet démarrait demain, sondes sur les scripts de la factory, et vérification dans Context7 des deux points qui dépendent d'une bibliothèque.

| | Projet | Forme | Origine |
|---|---|---|---|
| A | Carte de fidélité d'une friterie : PWA React, API Hono, Postgres, OTP, RBAC, ledger, jetons QR | Web + API dans un dépôt | Soumis par l'utilisateur |
| B | Réservation de créneaux pour un club de sport : Expo / React Native, API, notifications push, mode hors ligne | Mobile + API dans un dépôt | Choisi pour l'exercice |
| C | Validation et conversion de fichiers CSV : bibliothèque npm et sa CLI | CLI + bibliothèque publiées | Choisi pour l'exercice |

L'API seule n'a pas été rejouée : c'est la forme du projet d'origine du boilerplate (raccourcisseur d'URL). Ses manques se lisent dans les colonnes communes (cadrage, livraison).

## 1. Verdict

| Forme | Note | En une phrase |
|---|---|---|
| A. Web + API | 5,5 | Serveur solide ; le reste repose sur SPEC-0000 et sur l'humain |
| B. Mobile + API | 4,5 | Le contrat d'un écran ne peut pas s'exécuter : le lanceur de tests est codé en dur |
| C. CLI + bibliothèque | 6,5 | La chaîne d'outils convient ; la bibliothèque est annoncée mais absente des modèles |

Le boilerplate n'est pas encore générique au sens « n'importe quel projet JS/TS ». Il l'est pour le processus (spec, plan, baux, revue, fusion), qui tient sur les trois formes sans changement. Il ne l'est pas pour quatre mécanismes qui supposent une API à un seul paquet testée par Vitest.

## 2. Ce qui tient sur les trois formes

- Le cycle spec, plan, tâche, revue, fusion, et tous ses scripts (`lease`, `plan-gate`, `split-plan`, `review-gate`, `board`).
- L'ADR-0001 avec technologies imposées, et le cache Context7.
- Les tests de contrat immuables : sur une API ou une bibliothèque, ils servent aussi de garde de compatibilité ascendante (un changement de comportement exige `contract-change`).
- La mutation et la couverture sur la logique pure (ledger, synchronisation hors ligne, analyse de CSV).
- Les règles de lisibilité et de tranche verticale.

## 3. Sondes et vérifications

| # | Sonde | Résultat | Formes |
|---|---|---|---|
| S1 | `tests/holdout/SPEC-0004.api.test.ts` | Ignoré sans message | A, B |
| S2 | Contrat en deux fichiers, l'un encore en `.skip` | Scénarios cachés déclarés actifs | A, B |
| S3 | Niveau de revue de `web/src/features/auth/…`, `apps/api/src/features/auth/…`, `src/shared/auth-middleware.ts`, `drizzle/0001_init.sql` | `light` | A, B |
| S4 | Lanceur des scénarios cachés | `pnpm exec vitest run` en dur (`scripts/holdout.mjs:96`) ; `stryker.config.json` impose `vitest-runner` | B |
| S5 | React Native Testing Library, documentation | « Tested to work with Jest, but it should work with other test runners » ; Expo ne documente que `jest-expo` | B |
| S6 | Expo et pnpm (SDK 56) | Pris en charge, y compris en installation isolée depuis le SDK 54 : pas d'obstacle | B |
| S7 | `gen-features` sur une bibliothèque | Génère `export const features = [...]`, pas de ré-export : la surface publique (`src/index.ts`) reste un fichier central édité à la main | C |
| S8 | Mot « bibliothèque » comme type d'application | Présent dans le guide et l'ADR ; absent de `specs/_template/spec.md`, `/new-spec`, `spec-reviewer`, SPEC-0000 | C |
| S9 | CI | Node 22 seul, `ubuntu-latest` seul, aucune étape de build | A, B, C |
| S10 | Livraison (déploiement, store, publication) | Une ligne « Déploiement » dans l'ADR ; aucun script, workflow ni zone de risque | A, B, C |
| S11 | Registre d'une feature à deux entrées (`server.ts`, `client.tsx`) | Feature ignorée, un seul registre | A, B |

## 4. Notes par forme

### A. Web + API (friterie)

| Partie | Note | Manque principal |
|---|---|---|
| Cadrage produit | 4 | Pas de passage d'un brief à une suite ordonnée de specs |
| Stack et socle | 6 | Plusieurs applications : un paragraphe, un seul registre |
| Données et migrations | 6 | Isolation des tests sur base partagée, chemin des migrations supposé |
| Auth, RBAC, multi-commerce | 6 | Middleware partagé hors zone de risque |
| Moteur de fidélité | 8 | Stryker et tests parallèles sur une seule base |
| Jetons QR | 7 | Zone à déclarer à la main |
| Interfaces | 4 | Ni états ni maquette dans la spec, caméra et PWA intestables en jsdom |
| Parcours E2E | 4 | Aucun emplacement pour un lanceur navigateur |
| Règles de développement | 9 | |
| Pilotage du MVP | 5 | Ordre des specs écrit nulle part |
| Livraison | 2 | Rien |

### B. Mobile + API (réservation)

| Partie | Note | Manque principal |
|---|---|---|
| Cadrage produit | 4 | Identique à A |
| Stack et socle | 5 | Preset `tsconfig` du framework, dossiers natifs générés, deux paquets : tout à la charge de SPEC-0000 |
| API | 8 | |
| Contrat des écrans | 3 | S4 et S5 : un test qui rend un écran React Native demande Jest, que ni `pnpm test`, ni `holdout.mjs`, ni Stryker ne savent lancer. Le contrat d'une spec d'écran se réduit à sa logique |
| Logique côté appareil (hors ligne, synchronisation) | 7 | TypeScript pur, testable par Vitest |
| API d'appareil (push, stockage sûr, caméra) | 5 | Pas de convention de faux |
| Tests sur simulateur | 2 | Runner Linux seul ; un simulateur partagé entre workspaces parallèles |
| Zones de risque | 5 | Fichiers de build et de publication non classés |
| Livraison (signature, stores, mises à jour à distance) | 1 | Rien |

### C. CLI + bibliothèque (CSV)

| Partie | Note | Manque principal |
|---|---|---|
| Cadrage produit | 5 | Produit plus petit, mais même absence de feuille de route |
| Stack et socle | 7 | `noEmit`, `private: true`, pas de build : à défaire dans SPEC-0000 |
| Contrat et interface publique | 7 | CLI prévue (`run(argv)`) ; bibliothèque non nommée, et « aucun import d'un module interne » devient ambigu pour le relecteur de spec |
| Montage des features | 5 | S7 : la surface publique d'une bibliothèque est un fichier central |
| Logique | 9 | Mutation, couverture et scénarios cachés conviennent exactement |
| Compatibilité ascendante | 8 | Assurée par les contrats immuables ; non reliée au numéro de version |
| Cible réelle (paquet installé, binaire, versions de Node) | 4 | S9 |
| Sécurité | 6 | Règles par défaut pensées pour une API ; rien sur l'intégrité du paquet publié |
| Livraison (publication, version, journal des changements) | 2 | Conventional Commits imposés, bonne base, mais aucun point d'accroche |

## 5. Lecture croisée

| Manque | A | B | C | Conclusion |
|---|---|---|---|---|
| Brief vers suite ordonnée de specs | x | x | x | Générique |
| Livraison | x | x | x | Générique. Je l'avais classée « hors boilerplate » après le seul projet A : c'était faux |
| Cible réelle (navigateur, simulateur, paquet installé) | x | x | x | Générique |
| Zones de risque liées à `src/` racine | x | x | zones mortes | Générique |
| Plusieurs runtimes ou surfaces dans un dépôt | x | x | x (barrel) | Générique |
| Contrat en plusieurs fichiers | x | x | | Deux formes |
| Lanceur du contrat codé en dur | | x | | Une forme, mais bloquant pour elle |
| Type d'application absent des modèles | | | x | Une forme, correctif de texte |

## 6. Plan d'amélioration

Huit lots proposés ; les lots 1 à 6 sont livrés, un commit par lot, avec leurs tests dans `tests/unit/`, `pnpm verify` et la revue locale. Les lots 7 et 8 sont reportés (section 8). Tous touchent `scripts/`, `.claude/` ou `.github/` : risque élevé, fusion par l'humain. Aucune dépendance ajoutée au boilerplate.

### Critère de généricité, vérifié à la relecture de chaque lot

1. Aucun nom de technologie ni de fournisseur dans un script, un workflow ou une commande (exemples permis dans la documentation).
2. Tout ajout est neutre, ou activé par la présence d'un fichier ou d'un script (`--if-present`), ou renvoyé à l'ADR-0001.
3. Un projet à une seule application sans interface ne voit aucune différence.

### Lot 1 : contrat en plusieurs fichiers (S1, S2)

- `scripts/holdout.mjs` : accepter `SPEC-XXXX.test.ts(x)` et `SPEC-XXXX.<suffixe>.test.ts(x)` ; une spec est active quand aucun de ses fichiers de contrat n'a de `.skip` ; échec si `tests/holdout/` ou `tests/acceptance/` contient un fichier de test au nom non reconnu.
- `/new-spec`, `specs/_template/spec.md`, `spec-reviewer`, `planner`, `LEXIQUE.md` : nommage et règle du `.skip`.

### Lot 2 : zones de risque indépendantes de la disposition (S3)

- `.github/labeler.yml`, `CODEOWNERS`, `RISK.md` : globs `**/features/auth/**`, `**/migrations/**`, `**/config/**` ; `src/shared/**` et le point d'entrée en `risk:medium`.
- `scripts/pre-review.mjs zones` : liste les globs qui ne correspondent à aucun fichier suivi (avertissement). Appelée par `/retro`.
- `ci.yml` (mutation) : `**/src/**` ; hook Biome de `settings.json` : tout le dépôt (0,2 s, `.gitignore` respecté).
- `/init-project` : étape 6 systématique dès que le projet a une authentification, des données personnelles ou un fichier de livraison.

### Lot 3 : lanceur du contrat déclaré par le projet (S4, S5)

- `package.json`, clé `factory.contractRunners` : associe un suffixe du lot 1 à une commande (ex. `"native": "<commande>"`). La commande reçoit les fichiers et écrit un rapport JSON au format de Jest, que le rapport de Vitest reprend déjà. Sans cette clé, comportement actuel.
- `scripts/holdout.mjs` : regroupe les fichiers par lanceur ; `vitest.config.ts` : exclut les suffixes confiés à un autre lanceur ; script `test:contract` enchaîné par `pnpm verify`.
- Guide et ADR-0001 (Implications) : couverture et mutation des fichiers testés par un autre lanceur sont à sa charge ; sinon ils sortent explicitement des seuils.
- Dépend du lot 1.

### Lot 4 : plusieurs runtimes ou surfaces dans un dépôt (S7, S11)

- `scripts/gen-features.mjs` : options `--entry <fichier>` et `--out <fichier>` (un registre par runtime), et `--reexport` (génère des `export * from` : surface publique d'une bibliothèque). Sans option, comportement actuel.
- Guide, « Plusieurs applications dans le même dépôt » : les deux dispositions, la configuration de test à plusieurs environnements, ce que SPEC-0000 pose.
- `specs/SPEC-0000-bootstrap/spec.md` : un point de santé par application ; ADR-0001 : ligne « Disposition du dépôt ».
- Guide, « Ressource de données par workspace » : isolation des tests sur ressource partagée, concurrence de Stryker, outil à fichier central à inscrire dans `HOTSPOTS.md`.

### Lot 5 : cible réelle et build (S9)

Cible réelle : navigateur, simulateur ou appareil, paquet installé, binaire.

- Convention `tests/e2e/` et script `test:e2e`. `ci.yml` : job `e2e` qui lance `pnpm run --if-present test:e2e` sur le runner et les versions de Node donnés par deux variables de dépôt (défaut : `ubuntu-latest`, Node 22) ; étape `pnpm run --if-present build` dans `gates`.
- `specs/_template/spec.md` : section facultative « Parcours sur cible réelle ».
- Pilotage d'un navigateur par un agent : la procédure existait déjà (`TOKENS.md`, mesure 13) ; le guide y renvoie.

### Lot 6 : point d'extension de livraison (S10)

- `.github/workflows/release.yml`, déclenché à la main : lance `pnpm release` (échec explicite si le script manque) dans un environnement GitHub `production` (secrets et approbation côté GitHub), seulement si `gates` est vert sur `main`.
- ADR-0001 (Implications) : la ligne « Déploiement » devient « Livraison : cible, commande, secrets, retour arrière ». `/init-project` : les fichiers de livraison entrent dans les zones de risque (lot 2).
- `specs/SPEC-0000-bootstrap/spec.md` : critère « la commande de livraison existe et s'exécute à blanc » (passé ensuite à SPEC-0001, CA1 : lot 12, section 9).
- `METRICS.md` : « délai spec vers prod » se mesure sur ce workflow.

### Lot 7 : cadrage produit et ordre des specs

- Modèles `docs/PRODUCT.md` (problème, utilisateurs, parcours, hors périmètre, données personnelles) et `docs/DOMAIN.md` (vocabulaire, invariants).
- `specs/ROADMAP.md` et ligne `Dépend de : SPEC-XXXX | aucune` dans le modèle de spec ; `plan-gate.mjs` refuse le plan d'une spec dont une dépendance n'est pas livrée.
- Commande `/roadmap <brief>` : produit ces documents et les ADR à trancher, sans écrire de spec.
- `pre-review.mjs` (`reviewKind`) : une PR spec + ADR + documents produit reste une PR de spec.

### Lot 8 : modèles de spec selon le type d'application (S8)

- `specs/_template/spec.md`, `/new-spec`, `spec-reviewer`, SPEC-0000 : ajout de la bibliothèque (fonctions exportées, types, erreurs levées ; les tests importent par le point d'entrée du paquet). Pour un écran : états et maquette en texte.
- `docs/factory/UI.md` : modèle vide rempli par SPEC-0000, supprimé à l'init sans interface ; cité par `reviewer` sur un diff `.tsx`.
- `DOMAIN-SECURITY.md` : colonne « vérifiée par » ; règles par défaut triées par type d'application.
- `CLAUDE.md` : tout ce que les tests ne peuvent pas appeler pour de vrai (service tiers, API d'appareil, horloge, réseau) passe par une interface avec un faux.

### Ordre, taille, formes servies

| Ordre | Lot | Taille | A | B | C |
|---|---|---|---|---|---|
| 1 | 1. Contrat en plusieurs fichiers | petite | x | x | |
| 2 | 2. Zones de risque | petite | x | x | x |
| 3 | 3. Lanceur du contrat | moyenne | | x | |
| 4 | 4. Plusieurs runtimes ou surfaces | moyenne | x | x | x |
| 5 | 5. Cible réelle et build | petite | x | x | x |
| 6 | 6. Livraison | petite | x | x | x |
| 7 | 7. Cadrage produit | moyenne | x | x | x |
| 8 | 8. Modèles de spec | petite | x | x | x |

Notes visées après les huit lots : A 8, B 7, C 8,5. B reste en dessous : la mutation et la couverture des écrans dépendent d'un second lanceur, et les tests sur simulateur ne se parallélisent pas entre workspaces.

## 7. Limites de cet exercice

- B et C sont des battletests sur papier : aucun socle Expo ni paquet npm n'a été monté. S4 à S6 reposent sur la lecture des scripts et de la documentation, pas sur une exécution.
- Le lot 3 supposait que le rapport JSON de Jest et celui de Vitest sont assez proches pour `summarize()` : vérifié avec un rapport réel de Jest 30.5 (décompte, échec et erreur de chargement lus correctement). Les tests unitaires du lot utilisent un lanceur factice au même format.
- Formes non examinées : extension de navigateur, application de bureau, fonction planifiée ou file de messages, dépôt à plus de deux applications.

## 8. Décisions prises

1. Périmètre : lots 1 à 6 maintenant ; lots 7 et 8 plus tard (livrés ensuite, section 9).
2. Lot 3 : maintenant, sans attendre un projet mobile.
3. Lot 5 : tests sur cible réelle en CI seulement, pas dans `pnpm verify`.
4. Lot 7 : une commande `/roadmap`.
5. Ce rapport : conservé dans `docs/factory/`.

## 9. Second battletest (projet D) et lots 7 à 13

Date : 2026-10-03. Projet D, soumis par l'utilisateur et fictif : mise en relation de partenaires sportifs (PWA React, API Hono sur Cloudflare Workers, Neon, Drizzle, R2, lien magique, chat en polling, sessions planifiées, modération, photos), brief rédigé en milestones M0 à M10. Même forme que A, avec plus de services tiers, de temps et de rôles. Objectif fixé : 8 au minimum sur chaque partie.

| Partie de D | Avant | Lots | Manque principal avant |
|---|---|---|---|
| Cadrage produit (M0) | 4 | 7 | Ni modèle produit ni domaine, aucun passage du brief aux specs |
| Pilotage des milestones | 5 | 7 | Ordre et dépendances des specs écrits nulle part |
| Stack et socle | 7 | 12 | SPEC-0000 trop lourde pour un seul agent |
| Données et migrations | 7 | 10 | Migrations hors du dossier `migrations/` non protégées |
| Auth par lien magique | 6 | 8, 9, 11 | Envoi d'email sans convention de faux |
| Matching transactionnel | 7 | 10 | Tests de concurrence non outillés, pilote sans transaction non détecté |
| Sessions et rappel | 7 | 9 | Ni tâche planifiée ni horloge |
| Sécurité et modération | 6 | 11 | Rôles et administration hors zone |
| Photos | 5 | 8, 9 | Stockage d'objets sans faux, upload sans règle |
| Interfaces | 6 | 8 | Ni états ni maquette dans la spec |
| Parcours E2E | 6 | 12 | Services du job et parcours à plusieurs utilisateurs |
| KPI et funnel | 6 | 7, 9 | Aucun appui produit |
| Livraison | 7 | 12, 13 | Migrations et retour arrière non reliés |
| Monitoring | n/a | 13 | Absent |

Lots livrés (un commit par lot) :

| Lot | Contenu |
|---|---|
| 7. Cadrage et ordre des specs | `docs/PRODUCT.md`, `docs/DOMAIN.md`, `specs/ROADMAP.md`, `/roadmap` ; ligne `Dépend de` ; `plan-gate.mjs deps` (une spec est livrée quand aucun de ses fichiers de contrat n'a de `.skip` sur la base) ; PR de cadrage relue par `spec-reviewer` |
| 8. Modèles de spec | Section « Écrans » (états, maquettes rangées avec la spec), bibliothèque par son point d'entrée, `docs/factory/UI.md`, règle des faux dans `CLAUDE.md`, règles de sécurité par type d'application avec « vérifiée par » |
| 9. Services tiers, horloge, tâches planifiées | Interface et faux dans `src/shared/<service>/`, ligne « Services tiers » de l'ADR, horloge injectée, tâches déclarées par la feature, événements produit par leur faux, CA5 de SPEC-0000 |
| 10. Concurrence et transactions | Lignes « Transactions » et « Contraintes portées par la base » de l'ADR, forme d'un test de concurrence, blocage par les relecteurs, fichiers SQL hors zone signalés par `pre-review.mjs zones` |
| 11. Rôles et administration | Section « Acteurs et rôles », refus testés, `**/shared/**/auth*` et `**/features/admin/**` en zone sensible |
| 12. Socle en deux specs | SPEC-0001 (livraison, retour arrière, cible réelle) après SPEC-0000, en parallèle des specs métier ; liste de contrôle du socle ; parcours E2E à plusieurs utilisateurs |
| 13. Observabilité | Sentry imposé par la factory, service `src/shared/monitoring/` posé par SPEC-0001 (version livrée, aucune donnée personnelle, sourcemaps), zone sensible, serveur MCP `sentry` en lecture seule pour `/fix` et `/retro` |

Décisions :

1. Sentry est **imposé** par la factory, comme Tailwind, pour toute application qui s'exécute ; sans objet pour une bibliothèque. Le critère 1 de généricité (section 6) devient : aucun nom de technologie ni de fournisseur dans un script ou un workflow, **sauf technologie imposée par la factory** consignée dans l'ADR-0001. Aucun script `.mjs` ne nomme Sentry ; le workflow `release` le cite seulement en commentaire.
2. Serveur MCP Sentry : **en lecture seule** (`MCP_SKILLS=inspect`, jeton aux droits de lecture, hors du dépôt).
3. Socle en **deux specs**. Proposé pour les dépôts à plusieurs applications, appliqué à tous : une découpe conditionnelle aurait obligé `/init-project` à fusionner deux modèles, et livraison, cible réelle et observabilité concernent aussi un projet à une application.

Limite : comme pour B et C, ces notes restent sur papier ; aucun socle Workers ni Neon n'a été monté.
