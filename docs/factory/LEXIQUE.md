# Lexique de la software factory

Document de référence pour l'humain : ce qu'est la factory, ses concepts, ses commandes et ses seuils. Les agents n'ont pas à le lire (leurs règles sont dans `CLAUDE.md`). Le déroulé pas à pas est dans `WORKFLOW.md`.

## Définition générale

Une **software factory IA** est une organisation du développement où des agents de code produisent le logiciel en parallèle, à la chaîne, pendant qu'un humain garde trois décisions : ce qu'il faut construire, si le résultat est acceptable, et comment améliorer la chaîne.

Elle repose sur quatre idées :

1. **Le contrat avant le code.** L'humain écrit (ou valide) une spec et des tests d'acceptation. L'agent ne peut pas les modifier : il doit les faire passer.
2. **L'isolation.** Chaque agent travaille dans son propre workspace, sur une liste de chemins déclarée et réservée. Deux agents ne touchent jamais les mêmes fichiers en même temps.
3. **Le contrôle déterministe d'abord.** Ce qu'un script, un lint ou un test peut vérifier ne dépend jamais de la bonne volonté d'un agent. Les consignes en langage naturel sont le dernier recours.
4. **L'attention humaine routée par le risque.** L'humain ne relit pas tout le code : il lit la spec, les tests, le résumé et le verdict du relecteur, puis le code seulement là où le risque ou une incertitude le demande.

Ce que la factory n'est pas : un agent autonome qui décide du produit, ni une revue de code automatique en CI. La revue par agent est locale, et la fusion reste une décision humaine tant que la roadmap d'autonomie ne dit pas le contraire.

## 1. Les acteurs

- **Humain** : auteur ou valideur des specs et des tests de contrat, relecteur des PR selon le risque, seul à fusionner, à poser le label `contract-change` et à écarter une revue (`waive`).
- **Agent** : session Claude Code qui exécute une commande de la factory dans un workspace. Il n'a aucune mémoire d'une tâche à l'autre : tout ce qu'il sait vient de `CLAUDE.md`, de la spec, du plan et du code.
- **Agent producteur** : l'agent qui implémente une tâche (`/implement`).
- **Subagent** : agent secondaire lancé par un agent, avec son propre contexte, ses outils et son modèle. La factory en définit quatre (`.claude/agents/`) : `planner`, `spec-reviewer`, `reviewer`, `conflict-resolver`.
- **Planner** : subagent « chef d'atelier ». Il découpe une spec en tâches et ne code jamais.
- **Spec-reviewer** : subagent relecteur adversarial d'une PR de spec. Il cherche les critères non testables, les tests qui ne vérifient pas leur critère ou qui dépendent de l'implémentation, avant la lecture humaine.
- **Reviewer** : subagent relecteur adversarial. Il cherche ce qui est faux dans un diff, sans le contexte de l'agent producteur.
- **Conflict-resolver** : subagent qui résout un conflit de rebase petit et local, ou répond `RÉGÉNÉRER`.

## 2. L'environnement

- **Conductor** : application qui lance plusieurs agents en parallèle, chacun dans un workspace.
- **Workspace** : copie de travail isolée du dépôt (un worktree git) sur sa propre branche, créée depuis `origin/main`. Règle de la factory : une tâche par workspace, jeté après fusion.
- **Dépôt principal** : le clone d'origine, dont partent les workspaces (`$CONDUCTOR_ROOT_PATH`). Il porte ce qui est partagé hors git : le `.env` et le dossier `.factory/`.
- **Setup / archivage** : scripts lancés par Conductor à la création et à l'archivage d'un workspace (`scripts/conductor-setup.sh`, `scripts/conductor-archive.sh`). Le setup installe les dépendances, relie le `.env` et crée la base dédiée s'il y en a une ; l'archivage libère les baux et supprime cette base.
- **Base** : la branche de référence, `origin/main`. Tous les contrôles comparent la branche de la tâche à la base (variable `BASE_REF` pour en changer).
- **Branche de tâche** : branche du workspace, renommée `spec-xxxx-t#-<slug>` au début de `/implement`. Une branche par tâche, une PR par branche.
- **`.env` / `.env.local`** : variables d'environnement, hors git. Le `.env` vit dans le dépôt principal et est relié dans chaque workspace ; `.env.local` est écrit par le setup pour ce qui est propre au workspace (l'adresse de sa base). Les agents n'ont pas le droit de les lire.
- **Port** : chaque workspace reçoit le sien (`$CONDUCTOR_PORT`), pour que plusieurs serveurs locaux tournent en même temps.
- **Permissions de l'agent** : liste des commandes autorisées sans confirmation et des actions refusées (`.claude/settings.json`). Sont refusés : le push forcé, `--no-verify`, la lecture des `.env`.
- **Hook d'agent** : commande lancée automatiquement après une action de l'agent. La factory en a un : le formatage par Biome après chaque édition de fichier.
- **MCP** : protocole par lequel un agent accède à des outils externes. La factory n'en garde qu'un pour le projet (Context7) et refuse les autres connecteurs, qui alourdissent le contexte.
- **`.context/`** : dossier du workspace ignoré par git, pour les fichiers de travail (verdict de revue, log de vérification).
- **`.factory/`** : dossier du dépôt principal ignoré par git, visible de tous les workspaces. Il contient les baux.
- **Commande de la factory** : commande slash définie dans `.claude/commands/`, qui décrit une étape du cycle (voir « Les commandes »).

## 3. La spec et le contrat

- **Spec** : document `specs/SPEC-XXXX-<slug>/spec.md` qui dit ce qui doit être vrai une fois le travail livré. C'est la seule source de vérité fonctionnelle : on ne code jamais sans spec.
- **Statut d'une spec** : `BROUILLON`, `VALIDÉE`, `EN COURS`, `LIVRÉE`.
- **Critère d'acceptation (CA#)** : comportement observable et testable, numéroté (`CA1`, `CA2`…). Les tâches, les tests et les PR y font référence par leur identifiant.
- **CU#** : variante utilisée pour le comportement d'une interface, non observable par le test de contrat et vérifié par des tests écrits dans les tâches.
- **Cas limites** : section de la spec qui liste les entrées et situations anormales à traiter (vide, doublon, concurrence, dépendance indisponible).
- **Contrat d'interface** : section de la spec qui fige les entrées et sorties exactes de l'interface publique.
- **Questions ouvertes** : section de la spec où l'agent consigne ce qui est ambigu. Elle doit être vide avant le statut `VALIDÉE` : un agent ne suppose rien sur les règles métier, il demande.
- **Risque estimé** : niveau annoncé par la spec (faible, moyen, élevé), repris tâche par tâche dans le plan. C'est une prévision ; le niveau qui fait foi sur une PR est le label posé par la CI d'après les chemins réellement touchés.
- **Hors périmètre** (d'une spec) : ce que la spec ne fait volontairement pas. À ne pas confondre avec le périmètre d'une tâche.
- **Test de contrat** (ou test d'acceptation) : fichier `tests/acceptance/SPEC-XXXX.test.ts`, un `it` par critère d'acceptation, qui ne dépend que de l'interface publique. Écrit avec la spec, validé par l'humain.
- **`describe.skip`** : état initial d'un test de contrat. L'agent qui implémente la spec retire `.skip` ; c'est la seule modification qui lui est permise.
- **Contrat immuable** : règle selon laquelle un test de contrat fusionné ne change plus. `scripts/check-contract.mjs` refuse toute autre modification ou suppression, en local et en CI.
- **Scénario caché** (holdout) : parcours de bout en bout écrit avec la spec dans `tests/holdout/SPEC-XXXX.test.ts`, validé par l'humain, que l'agent producteur ne voit jamais. Il vérifie que l'implémentation satisfait l'intention et pas seulement les tests visibles. Retiré du workspace par `scripts/holdout.mjs hide`, joué en CI quand le test de contrat de la spec n'a plus de `.skip`, immuable comme le contrat. Le détail d'un échec est réservé à l'humain.
- **`contract-change`** : label posé par l'humain sur une PR pour autoriser une modification de test de contrat ou de scénario caché.
- **PR de spec** : PR qui ne contient que la spec, son test de contrat et ses scénarios cachés. Relue par le `spec-reviewer`, puis relue et fusionnée par l'humain avant tout plan.
- **SPEC-0000 (bootstrap)** : première spec d'un projet, qui pose le socle technique. Exécutée seule, par un seul agent, avant toute autre.
- **ADR** : compte rendu de décision d'architecture (`docs/adr/`). Explique un choix technique durable et ce que les agents doivent respecter. L'ADR-0001 fixe la stack.

## 4. Le plan et les tâches

- **Plan** : fichier `specs/SPEC-XXXX-<slug>/plan.md` produit par le `planner`, qui découpe la spec en tâches.
- **Statut d'un plan** : `PRÊT`, ou `BLOQUÉ` quand la spec est ambiguë (le plan liste alors des questions au lieu d'inventer).
- **Tâche (T#)** : unité de travail qu'un agent peut finir dans un contexte propre. Elle déclare un périmètre, ses dépendances, son risque, les critères couverts et sa définition de fini. Identifiant complet : `SPEC-XXXX-T#`.
- **Périmètre** : liste des chemins (fichiers ou dossiers, pas de globs) qu'une tâche a le droit de modifier. Hors périmètre, l'agent s'arrête et le signale.
- **Définition de fini** : les tests qui doivent passer pour que la tâche soit terminée.
- **Groupe** : ensemble de tâches lancées en parallèle. Deux tâches dont les périmètres se recoupent ne sont jamais dans le même groupe. Un groupe démarre après la fusion du précédent.
- **Tâche « contrat »** : tâche placée dans un groupe antérieur pour figer une interface partagée par plusieurs tâches.
- **Préambule du plan** : texte avant le premier groupe, réservé aux constats et interfaces communs à plusieurs tâches.
- **Extrait de tâche** : sortie de `scripts/split-plan.mjs task`, qui donne à l'agent sa seule tâche et les critères de la spec qu'elle couvre, au lieu du plan et de la spec en entier.
- **Dépendance entre tâches** : champ « Dépend de » d'une tâche. Une tâche ne démarre qu'après la fusion de celles dont elle dépend, ce que l'ordre des groupes traduit.
- **PR de plan** : PR qui ne contient que `plan.md`. Tant qu'elle n'est pas fusionnée, les nouveaux workspaces ne voient pas le plan.
- **PR de tâche** : PR ouverte par `/ship` à la fin d'une tâche. Une spec donne donc une PR de spec, une PR de plan, puis une PR par tâche.
- **Prompt de tâche** : la ligne `/implement SPEC-XXXX T#` que l'humain colle dans un nouveau workspace pour lancer une tâche. `/plan` les fournit, à utiliser après fusion de la PR de plan.
- **Petit et jetable** : principe de dimensionnement. Une tâche tient dans le contexte d'un agent, un workspace ne sert qu'à une tâche, et une branche qui pose problème se jette et se régénère plutôt que de se réparer longuement.
- **Contrôle du plan** : `scripts/plan-gate.mjs` vérifie qu'un plan `PRÊT` et la tâche demandée sont sur `origin/main` avant toute implémentation.
- **Redécoupage** : réponse prévue quand une tâche dépasse le contexte de l'agent ou que la revue ne converge pas. On refait le plan plutôt que de forcer.

## 5. Le parallélisme

- **Bail** : réservation exclusive d'un périmètre par une tâche. C'est le verrou qui empêche deux agents de modifier les mêmes fichiers en même temps, alors qu'ils travaillent dans des workspaces qui ne se voient pas.
  - *Contenu* : l'identifiant de la tâche (`SPEC-XXXX-T#`), ses chemins, le workspace qui le détient et la date de pose.
  - *Stockage* : `.factory/leases.json` dans le dépôt principal, hors git, donc commun à tous les workspaces. Un fichier verrou évite que deux agents l'écrivent au même instant.
  - *Pose* : première action de `/implement`, avec `node scripts/lease.mjs acquire <TASK_ID> <chemins…>`. Elle échoue si un autre bail recoupe l'un des chemins, ou si le même identifiant est déjà tenu par un autre workspace. L'agent s'arrête alors et dit quel bail bloque : il n'attend pas et ne contourne pas.
  - *Durée* : le bail n'est pas rendu à la fin de la tâche. Il reste posé pendant toute la vie de la PR (corrections, rebase) et n'est libéré qu'à l'archivage du workspace. Un workspace fusionné mais non archivé bloque donc son périmètre.
  - *Usages* : le `planner` consulte les baux actifs avant de former les groupes ; la pré-revue s'en sert pour vérifier que le diff reste dans le périmètre. Sans bail, elle signale « périmètre non contrôlé » et ce contrôle revient au relecteur.
  - *Autres commandes* : `list` (baux actifs, fait foi pour le parallélisme), `check <chemins>` (qui tient ces chemins ?), `release <TASK_ID>` (libération manuelle, pour un bail resté orphelin), `release-workspace <chemin>` (appelée par l'archivage).
  - *Limite* : le bail est une convention entre agents, pas un verrou du système de fichiers. Il ne protège que si chaque tâche le pose, et seulement entre workspaces d'un même dépôt principal.
- **Recoupement** : deux chemins se recoupent s'ils sont identiques ou si l'un est un dossier parent de l'autre. Un bail sur `src/features/links` bloque donc `src/features/links/routes.ts`, et un bail sur `src` bloque tout le dossier.
- **Migration** : changement de schéma de base de données. Zone à risque élevé, qui a ses propres règles : préfixe par timestamp (deux agents ne produisent pas le même numéro), une migration par tâche au plus, et aucun conflit résolu automatiquement.
- **Feature** : dossier `src/features/<feature>/` qui regroupe tout le code d'une fonctionnalité, tests compris. L'organisation par feature donne des périmètres disjoints.
- **Registre central** : fichier que chaque nouvelle fonctionnalité devrait modifier (liste de routes, index). La factory l'interdit : c'est une source de conflits entre agents.
- **Fichier généré** : fichier `*.gen.ts` produit par `pnpm gen` à la place d'un registre central, ignoré par git et jamais édité à la main (`scripts/gen-routes.mjs`).
- **Conflit** : désaccord entre la branche d'une tâche et `main` au rebase. Petit et local, il est résolu par `/resolve` ; sinon la tâche est régénérée.
- **`RÉGÉNÉRER`** : réponse du `conflict-resolver` quand le conflit est trop gros, touche une migration ou oppose deux intentions incompatibles. On jette la branche et on relance la tâche depuis `main` à jour.
- **Hotspot** : fichier qui revient dans le journal des conflits (`HOTSPOTS.md`). À la troisième fois, il doit être supprimé par un changement d'architecture.

## 6. La vérification

- **`pnpm verify`** : commande unique de vérification : génération, typage, lint, tests avec couverture, contrôle du contrat. Doit être verte avant de rendre la main.
- **`pnpm verify:quiet`** : la même, avec une sortie réduite à une ligne si tout est vert, aux erreurs sinon. Log complet dans `.context/verify.log`.
- **Contrôles ciblés** : tests et typage lancés sur les seuls fichiers concernés pendant la boucle de développement.
- **Couverture** : part du code exécutée par les tests, avec un seuil minimal.
- **Mutation testing** : la CI modifie volontairement le code des fichiers touchés (mutants) et vérifie que les tests échouent. Détecte les tests qui passent sans rien vérifier (Stryker).
- **Test tautologique** : test qui ne peut pas échouer (assertion faible, mock qui renvoie ce qu'on vérifie). Cible prioritaire du relecteur.
- **Hooks git** : contrôles locaux installés par Lefthook. `pre-commit` : format, lint, typage. `commit-msg` : format du message. `pre-push` : revue à jour et scans de sécurité.
- **Conventional Commits** : format des messages de commit et des titres de PR, avec la spec en scope : `feat(spec-0001): …` (`factory` pour l'outillage).
- **Condition de sortie** : ce qui doit être vrai pour qu'un agent rende la main : `pnpm verify` vert, revue locale `OK` sur le dernier état du code, résumé de PR rédigé.
- **Contournement** : `--no-verify`, `git push --force`, `waive` par un agent. Interdits, et pour partie bloqués par `.claude/settings.json`.

## 7. La revue

- **Revue adversariale** : relecture dont l'objectif est de trouver ce qui est faux, pas de valider. Faite par le `reviewer` (ou le `spec-reviewer` pour une PR de spec, choix fait par `scripts/pre-review.mjs kind`) dans un contexte vierge, jamais par l'agent qui a écrit le code.
- **Revue locale** : la revue a lieu dans le workspace, avant le push. Il n'y a pas de revue par agent en CI, donc pas de clé d'API en CI.
- **Pré-revue** : contrôles par script, sans modèle, faits avant la revue : périmètre, contrat, dépendances déclarées, section Context7 remplie (`scripts/pre-review.mjs check`). Une violation se corrige avant de lancer le relecteur et ne compte pas comme un passage.
- **Brief** : ce que reçoit le relecteur : niveau de revue, résultat de la pré-revue, fichiers modifiés et diff filtré (sans lockfile, fichiers générés ni tests de contrat).
- **Niveau de revue** : ampleur de la relecture, déduite des chemins touchés : `full` (risque élevé), `standard` (risque moyen), `light` (risque faible).
- **Modèle du relecteur** : au niveau `full`, le relecteur tourne sur un autre modèle que celui du producteur, parce qu'un modèle qui relit son propre code répète ses erreurs au lieu de les voir. Le modèle utilisé est tracé dans le bloc « Revue locale » ; `review-gate.mjs record` refuse un verdict `full` sans `--model`, mais ne vérifie pas que le modèle diffère de celui du producteur. Les deux modèles restent de la même famille : la décorrélation est partielle.
- **Verdict** : première ligne de la réponse du relecteur. `BLOQUANT` s'il y a au moins un point bloquant, sinon `CHANGEMENTS` s'il y a au moins un point à corriger, sinon `OK`.
- **Bloquants / À corriger / Points d'incertitude** : les trois rubriques du relecteur. Les deux premières doivent être traitées par l'agent ; la troisième est destinée à l'humain et n'empêche pas un `OK`.
- **Passage** : un tour de revue. Trois au maximum ; au-delà, l'agent s'arrête et propose un redécoupage.
- **Convergence** : règle qui empêche la boucle de tourner sans fin. Après un verdict `CHANGEMENTS`, le relecteur ne lit que le diff depuis le commit déjà relu ; un défaut mineur trouvé ailleurs passe en incertitude.
- **Patch-id** : empreinte du contenu du diff par rapport à `main`. Le verdict lui est lié : un rebase sans changement de contenu le conserve, toute modification le périme.
- **Contrôle de revue** : `scripts/review-gate.mjs`. Il enregistre le verdict (`.context/review.json`), refuse le push si la revue est absente, périmée ou non `OK`, et produit le bloc « Revue locale » de la PR.
- **Trace de revue** : bloc « Revue locale » du corps de la PR (verdict, patch-id, nombre de passages). Le job de CI `review-trace` vérifie qu'il correspond au diff réel.
- **`waive` / `WAIVED`** : dérogation par laquelle l'humain écarte la revue, avec une raison écrite qui apparaît dans la PR.
- **Résumé de PR** : fichier `.pr-summary.md` (ignoré par git) au format de `.github/pull_request_template.md` : référence, intention, fichiers touchés, décisions, incertitudes, documentation consultée, revue locale, nouvelles dépendances. Il devient le corps de la PR. Le relecteur contrôle son honnêteté par rapport au diff.

## 8. Le risque et la fusion

- **Zone de risque** : ensemble de chemins classés selon ce qu'une erreur y coûterait (`RISK.md`). Élevé : sécurité du domaine, authentification, migrations, configuration, et la factory elle-même. Moyen : logique métier, schéma, dépendances. Faible : le reste.
- **Labels de risque** : `risk:high`, `risk:medium`, `risk:low`, posés par la CI d'après `.github/labeler.yml`. Ce même fichier fixe le niveau de revue.
- **Label `contract`** : posé automatiquement quand une PR touche `tests/acceptance/` ou `tests/holdout/`.
- **Code owners** : `.github/CODEOWNERS` désigne l'humain propriétaire des chemins à risque élevé.
- **Sécurité propre au domaine** : règles de sécurité spécifiques au produit (`DOMAIN-SECURITY.md`), lues par l'agent et le relecteur sur les zones concernées.
- **Gates** : contrôles de CI qu'une PR doit passer : `pr-title`, `gates` (typage, lint, tests, contrat, scénarios cachés, mutation), `security` (gitleaks, Semgrep), `review-trace`. `gates` et `security` tournent aussi sur `main` après chaque fusion.
- **gitleaks / Semgrep** : détection de secrets dans les commits, et analyse statique de sécurité. Lancés au `pre-push` (avertissement si l'outil est absent) et en CI (`scripts/security-scan.mjs`).
- **Clé factice** : valeur de test au format `test-key` ou `key-<nom>`, seule forme autorisée dans les fichiers de test par `.gitleaks.toml`.
- **Arbitrage** : lecture humaine d'une PR, dans cet ordre : la spec, les tests, le résumé et le verdict, puis le code aux endroits signalés.
- **`/land`** : commande de fusion, une PR à la fois : `main` verte, checks verts, confirmation explicite sur `risk:high` ou `contract-change`, squash-merge. Elle remplace la merge queue.
- **Merge queue / ruleset** : mécanismes de GitHub qui imposent des règles de fusion côté serveur (checks requis, file d'attente). Absents du plan Free sur un dépôt privé : la factory s'en passe, et ses barrières sont alors `/land` et le hook `pre-push`, qui reposent sur la discipline et non sur le serveur.
- **Squash-merge** : fusion d'une PR en un seul commit sur `main`.
- **Auto-merge** : fusion sans intervention humaine des PR `risk:low`. Désactivé par défaut, prévu en dernière phase de la roadmap.

## 9. L'amélioration continue

- **Boucle d'amélioration** : rendez-vous hebdomadaire où l'on relit les PR rejetées, les verdicts `BLOQUANT`, les bugs et les conflits pour corriger la chaîne plutôt que le symptôme.
- **`/retro`** : prépare la boucle : métriques de la semaine, problèmes récurrents, commandes `/learn` à lancer.
- **`/learn`** : transforme un incident en règle durable, en cherchant la forme la plus déterministe.
- **Forme déterministe** : ordre de préférence pour une règle : règle de lint ou option du compilateur, test de non-régression, vérification par script ou CI, consigne au relecteur, et en dernier recours une règle active.
- **Règles actives** : consignes en langage naturel relues par chaque agent à chaque tâche (`LEARNINGS.md`). Liste plafonnée, parce qu'elle coûte du contexte à chaque tâche.
- **Journal** : historique daté des incidents et de la forme retenue (`LEARNINGS.md`).
- **Taux de reprise** : part des PR qui ont demandé un nouveau passage d'agent après la CI ou la revue.
- **Défaut échappé** : bug trouvé après la fusion.
- **Autres métriques** (`METRICS.md`) : tâches livrées, conflits de la semaine, part des PR fusionnées en auto-merge, délai médian entre la spec et la mise en production.
- **Roadmap d'autonomie** : phases qui élargissent le parallélisme puis l'auto-merge, franchies sur critères mesurés (`WORKFLOW.md`, `METRICS.md`).

## 10. La documentation et les tokens

- **Context7** : serveur MCP qui fournit la documentation des bibliothèques à une version donnée. Utilisé pour vérifier une API plutôt que de se fier à la mémoire du modèle.
- **Version épinglée** : version exacte d'une bibliothèque dans `package.json` et le lockfile. C'est celle dont on consulte la documentation.
- **Cache de bibliothèques** : `libs-cache.md`, faits déjà vérifiés sur une API à une version précise, avec source et date. Consulté avant Context7.
- **API inventée** : appel à une fonction ou option qui n'existe pas dans la version installée. Défaut typique d'un agent, que la procédure Context7 vise à éviter.
- **Nouvelle dépendance** : tout paquet ajouté doit être déclaré et justifié dans le résumé de PR ; la pré-revue le contrôle.
- **Token** : unité de texte lue ou produite par le modèle, qui mesure le coût.
- **Contexte** : tout ce que l'agent relit à chaque tour (instructions, fichiers lus, sorties de commandes). C'est le premier poste de coût.
- **Tour** : un appel au modèle. Le **contexte moyen par tour** est l'indicateur de sobriété suivi.
- **Tokens pondérés** : total ramené à un équivalent de coût (voir les seuils ci-dessous).
- **Modèle et effort par commande** : chaque commande et chaque subagent peut fixer son modèle et son niveau d'effort. Les commandes mécaniques (`/ship`, `/resolve`, `/retro`) tournent sur le modèle le moins coûteux ; les subagents sur un modèle intermédiaire (le relecteur change de modèle en risque élevé) ; `/land`, qui porte les barrières de fusion, reste sur le modèle par défaut.
- **Sobriété en tokens** : ensemble des mesures qui réduisent le contexte relu (`TOKENS.md`) : extrait de tâche, sortie filtrée, pré-revue par script, niveaux de revue, modèle moins coûteux pour les commandes mécaniques.

## Les commandes

| Commande | Rôle | Qui agit ensuite |
|---|---|---|
| `/new-spec <besoin>` | Rédige la spec, les tests de contrat en `describe.skip` et les scénarios cachés, après avoir posé ses questions ; les fait relire (`spec-reviewer`) et ouvre la PR de spec | L'humain relit et fusionne la PR de spec |
| `/plan <SPEC>` | Découpe la spec en tâches (subagent `planner`) et ouvre la PR de plan | L'humain relit et fusionne la PR de plan |
| `/implement <SPEC> <T#>` | Implémente une tâche : bail, tests, code, vérification, revue, puis `/ship` | L'agent enchaîne seul |
| `/review` | Pré-revue par script puis revue adversariale (`reviewer`, ou `spec-reviewer` pour une PR de spec) ; enregistre le verdict | L'agent corrige si besoin |
| `/ship` | Vérifie, contrôle la revue, pousse et ouvre la PR | La CI, puis l'humain |
| `/resolve` | Rebase sur `main` ; résout un petit conflit ou demande de régénérer | `/ship` pour repousser |
| `/land <PR>` | Fusionne une PR si `main` est verte, après checks verts et confirmation selon le risque | L'humain archive le workspace |
| `/retro` | Prépare la boucle d'amélioration hebdomadaire | L'humain lance les `/learn` proposés |
| `/learn <incident>` | Propose une règle durable, sous la forme la plus déterministe | L'humain valide avant application |

## Les scripts

| Script | Rôle |
|---|---|
| `lease.mjs` | Baux de périmètre entre workspaces |
| `plan-gate.mjs` | Le plan et la tâche sont-ils sur `origin/main` ? |
| `split-plan.mjs` | Extrait d'une tâche et de ses critères |
| `check-contract.mjs` | Tests de contrat modifiés seulement par le retrait de `.skip` ; scénarios cachés ni modifiés ni supprimés |
| `holdout.mjs` | Scénarios cachés : retrait du workspace, exécution en CI avec décompte seul |
| `pre-review.mjs` | Pré-revue, niveau de revue, choix du relecteur, brief du relecteur |
| `review-gate.mjs` | Enregistrement et contrôle du verdict, trace dans la PR |
| `security-scan.mjs` | Semgrep et gitleaks, en local comme en CI |
| `verify-quiet.mjs` | `pnpm verify` à sortie filtrée |
| `gen-routes.mjs` | Fichier généré qui remplace le registre central |
| `token-report.mjs` | Mesure de la consommation de tokens |
| `conductor-setup.sh`, `conductor-archive.sh` | Préparation et nettoyage d'un workspace |

## Les outils

| Outil | Rôle dans la factory |
|---|---|
| Claude Code | L'agent : exécute les commandes, lance les subagents |
| Conductor | Workspaces parallèles, scripts de setup et d'archivage |
| `gh` | PR, checks et fusion depuis la ligne de commande |
| pnpm | Dépendances et scripts (`pnpm verify`, `pnpm gen`) |
| TypeScript (strict) | Typage : premier filet contre les erreurs d'agent |
| Biome | Lint et format, en une seule passe |
| Vitest | Tests unitaires et d'acceptation, couverture |
| Stryker | Mutation testing en CI |
| Lefthook | Hooks git locaux |
| commitlint | Format des messages de commit |
| gitleaks, Semgrep | Secrets et analyse statique de sécurité |
| Context7 | Documentation des bibliothèques à version épinglée |
| GitHub Actions | Gates, trace de revue, labels de risque |

## Les seuils

| Seuil | Valeur | Où |
|---|---|---|
| Tâches par spec | 3 à 5 | `.claude/agents/planner.md` |
| Taille visée d'une tâche | moins de 300 lignes de diff | `.claude/agents/planner.md` |
| Diff jugé trop gros pour une revue rapide | plus de 400 lignes (passe en `risk:medium`) | `.github/workflows/risk.yml` |
| Passages de revue | 3 au maximum | `.claude/commands/implement.md`, `.claude/commands/new-spec.md` |
| Scénarios cachés par spec | 2 à 4 | `.claude/commands/new-spec.md` |
| Couverture minimale | 80 % (lignes, fonctions, branches, instructions) | `vitest.config.ts` |
| Score de mutation minimal | 60 % | `stryker.config.json` |
| Conflit résolu automatiquement | 40 lignes au plus, hors migration | `.claude/agents/conflict-resolver.md` |
| Règles actives | 10 lignes au plus | `docs/factory/LEARNINGS.md` |
| Hotspot | 3 apparitions du même fichier | `docs/factory/HOTSPOTS.md` |
| Agents en parallèle | 2 au départ, 3 ou 4 quand le taux de reprise est stable | `docs/factory/WORKFLOW.md` |
| Pondération des tokens | entrée × 1, écriture de cache × 1,25, lecture de cache × 0,1, sortie × 5 | `scripts/token-report.mjs` |
| Passage à la phase suivante | 2 semaines de taux de reprise stable, zéro défaut échappé en zone à risque | `docs/factory/METRICS.md` |
