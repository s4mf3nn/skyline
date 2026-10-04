# Boilerplate de software factory IA

Socle réutilisable pour développer un projet avec des agents Claude Code en parallèle (workspaces Conductor), sous contrôle humain. Il ne contient aucun code applicatif : seulement le processus, ses garde-fous et l'outillage TypeScript qui les fait tenir. Il ne présume pas du type d'application (API ou service, application web, application mobile, CLI, bibliothèque) : ce choix se fait dans l'ADR-0001 et se pose avec SPEC-0000.

Extrait d'un projet réel (service de raccourcissement d'URL), dont il reprend les scripts et leurs tests tels quels.

## Le principe

L'humain décide du **quoi** (spec et tests de contrat) et arbitre les fusions. Les agents font le **comment**, chacun dans un workspace isolé, sur un périmètre de fichiers déclaré. Tout ce qu'un script peut vérifier est vérifié par un script, pas par une consigne.

```
/new-spec ──► PR de spec ──► /plan ──► PR de plan ──► /implement T1 ┐
 (humain relit et fusionne)   (humain relit et fusionne)  /implement T2 ├─► /review ─► /ship ─► CI ─► /land
                                                          /implement T3 ┘   (boucle ≤ 3)        (humain arbitre)
                          bug : issue ─► /fix (test qui échoue, puis correction) ─► /review ─► /ship ─► CI ─► /land
                                        vendredi : /retro ─► /learn ─► règle durable
```

Le cycle complet est décrit dans `docs/factory/WORKFLOW.md`, et chaque concept (bail, périmètre, test de contrat, verdict, patch-id…) est défini dans `docs/factory/LEXIQUE.md`.

## Ce que contient la factory

| Mécanisme | Ce qu'il garantit | Fichiers |
|---|---|---|
| Cadrage produit | Un brief devient un produit, un domaine (invariants, cycles de vie) et une suite ordonnée de specs ; une spec ne se planifie pas avant ses dépendances | `docs/PRODUCT.md`, `docs/DOMAIN.md`, `specs/ROADMAP.md`, `/roadmap`, `scripts/plan-gate.mjs` |
| Spec contrat | Pas de code sans spec ; critères numérotés `CA#` | `specs/_template/spec.md`, `/new-spec` |
| Tests de contrat immuables | Un agent ne peut que retirer `.skip` ; le reste demande le label `contract-change` ; une partie peut être confiée à un autre lanceur que Vitest | `tests/acceptance/`, `scripts/check-contract.mjs`, `scripts/contract-files.mjs` |
| Scénarios cachés | L'implémentation satisfait l'intention, pas seulement les tests qu'elle voit : parcours écrits avec la spec, retirés du workspace du producteur, joués en CI | `tests/holdout/`, `scripts/holdout.mjs`, `/new-spec`, `/implement` |
| Relecture de spec | Critères testables et tests qui les vérifient, avant la lecture humaine | subagent `spec-reviewer`, `/new-spec`, `/review` |
| Plan en tâches | 3 à 5 tâches par spec, groupes parallèles, périmètre en chemins | subagent `planner`, `/plan`, `scripts/plan-gate.mjs`, `scripts/split-plan.mjs` |
| Baux de périmètre | Deux workspaces ne modifient jamais les mêmes chemins | `scripts/lease.mjs` (état dans `.factory/` du dépôt principal, hors git) |
| Suivi visuel | Une issue par spec et par tâche, statut dérivé des PR, Kanban via GitHub Project | `scripts/board.mjs`, `.github/workflows/board.yml`, `docs/factory/BOARD.md` |
| Aucun registre central | Ajouter une feature ne touche aucun fichier partagé | `scripts/gen-features.mjs` (`pnpm gen`) |
| Vérification unique | Typage, lint, tests, couverture 80 %, contrat en une commande | `pnpm verify`, `pnpm verify:quiet` |
| Revue adversariale locale | Relecteur à contexte vierge, sur un autre modèle que le producteur au niveau `full` (`review:full`) ; verdict lié au `patch-id` du diff ; push refusé sans revue `OK` à jour | subagent `reviewer`, `/review`, `scripts/pre-review.mjs`, `scripts/review-gate.mjs`, `lefthook.yml` |
| Trace de revue en CI | Le corps de la PR porte un verdict qui correspond au diff | `.github/workflows/review-trace.yml` |
| Routage par risque | Étiquette `risk:*` selon les chemins ; niveau de revue et arbitrage humain en découlent | `.github/labeler.yml`, `.github/workflows/risk.yml`, `.github/CODEOWNERS`, `docs/factory/RISK.md` |
| Gates de CI | Titre de PR, typage, lint, tests, contrat, build, scénarios cachés, mutation sur les fichiers modifiés, tests sur cible réelle, gitleaks, Semgrep ; rejoués sur `main` après chaque fusion | `.github/workflows/ci.yml`, `scripts/security-scan.mjs` |
| Livraison | Lancée à la main, depuis un commit de `main` vert, avec approbation et secrets de l'environnement `production` ; la commande vient du projet ; migrations compatibles et retour arrière répété ; les clients installés (mobile, bureau) sous la version minimale sont refusés, et l'API n'évolue que par ajout | `.github/workflows/release.yml`, `pnpm release` (SPEC-0001) |
| Fusion sans merge queue | `main` verte, checks verts, confirmation humaine sur `risk:high` et `contract-change`, squash | `/land`, `/resolve`, subagent `conflict-resolver` |
| Correction de bug | Un bug se corrige contre la spec existante, avec le test qui le reproduit ; une spec fausse s'amende avant | `/fix`, `scripts/pre-review.mjs`, `docs/factory/WORKFLOW.md` |
| Boucle d'amélioration | Un incident devient un lint, un test ou un script avant de devenir une consigne | `/retro`, `/learn`, `docs/factory/{LEARNINGS,METRICS,HOTSPOTS}.md` |
| Observabilité | Toute application qui s'exécute remonte ses erreurs à Sentry (imposé par la factory), avec la version livrée et sans donnée personnelle ; `/fix` part d'une issue Sentry, `/retro` compte les erreurs de production | `src/shared/monitoring/` (SPEC-0001), `.mcp.json` (serveur `sentry` en lecture seule), `/fix`, `/retro` |
| Documentation de bibliothèques | Context7 à version épinglée, précédé d'un cache local | `.mcp.json`, `docs/factory/CONTEXT7.md`, `docs/factory/libs-cache.md` |
| Sobriété en tokens | Extraits de plan, sortie filtrée, niveaux de revue, modèles par commande | `docs/factory/TOKENS.md`, `scripts/token-report.mjs` |
| Workspaces isolés | Dépendances, `.env` partagé, base dédiée optionnelle, nettoyage à l'archivage | `.conductor/settings.toml`, `scripts/conductor-{setup,archive}.sh` |

## Prérequis

- Node ≥ 22.12 et pnpm 10 (version épinglée dans `package.json`)
- `gh` authentifié, un dépôt GitHub
- Claude Code et Conductor
- Recommandé en local : `semgrep` (`pipx install semgrep==1.179.0`, version alignée sur la CI) et `gitleaks` (`brew install gitleaks`). Absents, le `pre-push` avertit et la CI fait le scan.
- Optionnel : Docker, pour une base Postgres par workspace

## Démarrer un nouveau projet

1. Crée le dépôt à partir de ce boilerplate : `gh repo create <nom> --template <toi>/software-factory-boilerplate --private --clone`, ou copie ce dossier puis `git init -b main`.
2. Personnalise. Le plus simple : lance `/init-project` dans Claude Code, il te pose les questions (nom, propriétaire, phase d'autonomie 1, 2 ou 3, type d'application, Postgres, stack) puis applique tout. À la main : `node scripts/init-factory.mjs <nom-du-projet> <propriétaire-github> [--phase 1|2|3] [--description '<phrase>']`. Le script remplace les jetons, renomme le paquet, déplace ce guide dans `docs/factory/BOILERPLATE.md`, installe le README du projet et se supprime.
3. Complète les fichiers de la liste « À personnaliser » ci-dessous, dont `docs/adr/0001-stack.md`, `specs/SPEC-0000-bootstrap/spec.md`, `specs/SPEC-0001-delivery/spec.md` et leurs tests de contrat (`tests/acceptance/SPEC-0000.test.ts`, `SPEC-0001.test.ts`). Fais-le **dans ce commit initial** : une fois le fichier de contrat sur `main`, le modifier demande le label `contract-change`.
4. Commite et pousse sur `main` **avant** `pnpm install` : `git add -A && git commit -m "chore(factory): bootstrap software factory" && git push -u origin main`. Une fois les hooks installés, le `pre-push` refuse tout push sans revue enregistrée, y compris sur `main`, et il a besoin d'un `origin/main` existant. Si tu as déjà lancé `pnpm install`, la sortie prévue est `node scripts/review-gate.mjs waive "commit initial"` (réservée à l'humain).
5. Applique les « Réglages GitHub » ci-dessous.
6. Crée un `.env` à la racine du dépôt principal si le projet a des variables d'environnement (il est relié dans chaque workspace par le setup).
7. Ajoute le dépôt dans Conductor : `.conductor/settings.toml` déclare déjà les scripts de setup, d'archivage et de lancement.
8. Dans un premier workspace : `/plan SPEC-0000`, fusionne la PR de plan, puis `/implement SPEC-0000 T1` dans un nouveau workspace, puis T2 après fusion de T1, etc. SPEC-0000 s'exécute seule, avant toute autre spec, une tâche à la fois (une par groupe : `plan-gate` le contrôle), chacune par un agent neuf. SPEC-0001 (livraison et cible réelle) la suit, en parallèle des premières specs métier.
9. En parallèle de SPEC-0000, dans un autre workspace : `/roadmap <brief>` (cadrage produit, domaine et ordre des specs), fusionne la PR de cadrage, puis enchaîne les `/new-spec` dans l'ordre de `specs/ROADMAP.md`.

## À personnaliser

| Fichier | Quoi |
|---|---|
| `CLAUDE.md` | Sections « Le projet », « Conventions de code » (selon la stack) et « Sécurité propre au domaine » |
| `docs/adr/0001-stack.md` | Type d'application, tableau des technologies (imposées, choisies, à décider) et section Implications (runtime, tests, données, secrets, déploiement) |
| `specs/SPEC-0000-bootstrap/spec.md`, `tests/acceptance/SPEC-0000.test.ts` | Critères et assertions du socle, liste de contrôle, puis statut `VALIDÉE` |
| `specs/SPEC-0001-delivery/spec.md`, `tests/acceptance/SPEC-0001.test.ts` | Livraison, retour arrière, cible réelle (à adapter à l'ADR-0001), puis statut `VALIDÉE` |
| `docs/factory/DOMAIN-SECURITY.md` | Les règles de sécurité du domaine |
| `docs/factory/RISK.md`, `.github/labeler.yml`, `.github/CODEOWNERS` | Les zones sensibles du domaine, dans les trois fichiers à la fois |
| `.claude/settings.json` | `enabledPlugins` et les connecteurs refusés dépendent du poste (voir `docs/factory/TOKENS.md`) |
| `package.json` | Le script `dev`, posé par SPEC-0000 |
| `tsconfig.json`, `tsconfig.test.json` | `jsx`, `lib` et `types` selon le type d'application (voir « Options ») |
| `vitest.config.ts`, `.github/workflows/ci.yml` | Environnement de test ; points d'entrée exclus de la couverture et de la mutation ; services de CI |
| `.env.example` | À créer : variables attendues, avec des clés factices `test-key` ou `key-<nom>` (convention de `.gitleaks.toml`) |
| `docs/PRODUCT.md`, `docs/DOMAIN.md`, `specs/ROADMAP.md` | Remplis par `/roadmap <brief>`, pas à la main |
| `docs/factory/WORKFLOW.md` | La roadmap d'autonomie (proposition à ajuster) ; la phase de départ est fixée par `--phase` |

## Réglages GitHub

Les étiquettes doivent exister avant la première PR (`gh pr edit --add-label` échoue sinon) :

```bash
gh label create "risk:high" --color d73a4a --description "Zone à risque élevé : revue humaine obligatoire"
gh label create "risk:medium" --color fbca04 --description "Risque moyen : revue humaine allégée"
gh label create "risk:low" --color 0e8a16 --description "Risque faible"
gh label create "review:full" --color 8f1a8f --description "Relecteur sur Opus : auth, administration, migrations, config, docker-compose.yml"
gh label create "contract" --color 5319e7 --description "Tests d'acceptation / spec contrat"
gh label create "contract-change" --color b60205 --description "Modification d'un test de contrat : validation humaine requise"
```

- Fusion : n'autoriser que le squash-merge, avec suppression automatique des branches.
- Si le plan GitHub le permet : protection de `main` avec les checks `gates`, `security`, `pr-title`, `review-trace` requis et « Require review from Code Owners ». Sur le plan Free d'un dépôt privé, ces règles n'existent pas : `/land` et le hook `pre-push` tiennent lieu de barrières.
- `contract-change` et `node scripts/review-gate.mjs waive` sont réservés à l'humain.
- Livraison (si l'ADR-0001 en prévoit une) : crée l'environnement `production` (Settings → Environments) avec toi en relecteur obligatoire et `main` comme seule branche de déploiement, et range-y les secrets de livraison, dont le DSN Sentry de chaque application et `SENTRY_AUTH_TOKEN` (envoi des sourcemaps). Le workflow `release` (lancé à la main : Actions → release → Run workflow) refuse un commit de `main` dont `gates` n'est pas vert, puis lance `pnpm release`. Variable facultative : `RELEASE_RUNNER` (défaut `ubuntu-latest` ; une application iOS demande macOS).
- Tests sur cible réelle (si le projet a un script `test:e2e`) : ajoute les checks `e2e` aux checks requis.
- Ressource de données hors Docker (si le projet a un `scripts/workspace-data.sh`) : secret de dépôt `WORKSPACE_DATA_TOKEN`, limité à la création et à la suppression de ressources de test (voir « Options »).

## Options

**Ressource de données par workspace.** Des agents travaillent en parallèle : chacun a besoin de sa propre ressource de données, créée au setup du workspace et supprimée à son archivage. Le mécanisme est une décision de l'ADR-0001 (section Implications) : Postgres local en Docker (ci-dessous, le seul que les scripts de la factory savent créer), branche d'une base hébergée (ex. Neon), instance locale d'un service (ex. Supabase), ou aucune ressource. Pour tout mécanisme autre que Docker, le projet fournit un script exécutable `scripts/workspace-data.sh`, appelé s'il existe par le setup (`setup`) et par l'archivage (`archive`) Conductor, avec les variables `WORKSPACE_NAME` et `PROJECT_NAME` (identifiants en minuscules et underscores). `setup` crée la ressource (ex. une branche de base hébergée) et ajoute ses variables à `.env.local` sans l'écraser, une par ligne au format `NOM=valeur` (sans `export`, valeur sur une seule ligne) ; `archive` la supprime (son code de retour est ignoré). Les deux sont idempotents. Ce script est écrit par SPEC-0000 d'après l'ADR-0001 : ne code aucun fournisseur en dur dans les scripts de la factory. La CI l'appelle aussi (`scripts/ci-data.sh`, jobs `gates` et `e2e`), avec un nom propre au run : les tests y tournent sur le même fournisseur et le même pilote qu'en production, et la ressource est supprimée en fin de job. Son jeton d'accès est le secret de dépôt `WORKSPACE_DATA_TOKEN`, limité à la création et à la suppression de ressources de test : une PR peut modifier le script qui le lit, et une PR venue d'un fork n'y a pas accès (ses gates échouent à cette étape).

Dans un même workspace, les fichiers de test tournent en parallèle sur la même ressource, et Stryker relance les tests en parallèle à chaque mutant. SPEC-0000 fixe comment les tests s'isolent (transaction annulée par test, schéma par processus de test, ou `fileParallelism: false`) et règle `concurrency` de `stryker.config.json` en conséquence. **Tests de concurrence.** Une règle qui doit tenir face à deux requêtes simultanées (unicité, réciprocité, solde, place disponible) est garantie par la base : contrainte, ou transaction au niveau d'isolation suffisant (invariants de `docs/DOMAIN.md`, ligne « Transactions » de l'ADR-0001). Son test lance les requêtes en même temps par l'interface publique (`Promise.all`), sur la vraie ressource de données du workspace, puis vérifie l'invariant (un seul enregistrement, aucune erreur interne exposée). Un test qui enchaîne les requêtes l'une après l'autre ne prouve rien. Pas de faux pour la base dans ces tests.

Un outil qui tient un fichier central (ex. un journal de migrations) recrée un fichier partagé entre tâches : choisis une version ou une option qui l'évite, sinon inscris le fichier dans `docs/factory/HOTSPOTS.md` et range les tâches qui le touchent dans des groupes différents.

**Postgres en Docker, une base par workspace.** Ajoute ce `docker-compose.yml` à la racine : le setup Conductor crée alors la base `<projet>_<workspace>`, écrit `DATABASE_URL` dans `.env.local`, et l'archivage la supprime. Décommente aussi le bloc `services` de `.github/workflows/ci.yml` et ajoute un script `db:migrate` (appelé s'il existe).

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      retries: 20
volumes:
  pgdata:
```

**Application web ou mobile.** Rien n'est préinstallé : SPEC-0000 pose le framework choisi dans l'ADR-0001. À prévoir dans cette spec :

- `tsconfig.json` : l'option `jsx`, et la `lib` ou le preset du framework. `types: ["node"]` et l'absence de `DOM` sont les valeurs par défaut du socle, pas une règle.
- `vitest.config.ts` : l'environnement de test (ex. `jsdom`) et ce qui sort de la couverture (point d'entrée, écrans sans logique si l'ADR le décide). Les fichiers `.tsx` sont déjà pris en compte par les tests, la couverture et la mutation.
- `package.json` : le script `dev` (bundler, simulateur) ; `.gitignore` : les dossiers générés par le framework (Biome suit `.gitignore`).
- Tests de contrat et scénarios cachés : ils passent par l'interface rendue, en `SPEC-XXXX.test.tsx`. Une spec qui couvre une API et un écran répartit son contrat en fichiers suffixés (`SPEC-XXXX.api.test.ts`, `SPEC-XXXX.ui.test.tsx`).
- Tests d'interface hors de portée de Vitest (ex. rendu React Native, documenté avec Jest) : le lanceur ajouté est une dépendance à justifier. Le contrat et les scénarios cachés concernés prennent un suffixe (`SPEC-XXXX.native.test.tsx`) déclaré dans `package.json` : `"factory": { "contractRunners": { "native": "test:native" } }`, où `test:native` reçoit les fichiers en arguments et écrit un rapport JSON au format de Jest dans `$CONTRACT_REPORT` (ex. `jest --json --outputFile=$CONTRACT_REPORT`). Vitest ignore alors ces fichiers ; `pnpm test:contract` (dans `pnpm verify` et en CI) joue le contrat, `scripts/holdout.mjs` les scénarios cachés (avec `HOLDOUT=1`). Restent à la charge de SPEC-0000 : le typage de ces fichiers (les sortir de `tsconfig.test.json` s'ils utilisent les globaux du lanceur), leur couverture et leur mutation (configuration propre au lanceur, ou exclusion explicite des seuils et de l'étape de mutation de la CI).
- Tailwind est imposé par la factory pour toute interface (NativeWind pour React Native), comme Sentry pour toute application qui s'exécute (voir « Observabilité ») ; il est consigné dans l'ADR-0001, et SPEC-0000 le pose.
- Routage par fichiers du framework (ex. Expo Router) : routes fines et layouts qui lisent le registre généré, voir « Routage par fichiers » ci-dessous.
- `docs/factory/UI.md` : rempli par SPEC-0000 (tokens de style, composants de base, états standard, accessibilité, tests d'interface), lu par le relecteur sur tout diff `.tsx`. Chaque spec décrit ses écrans (section « Écrans » : états, actions, maquette rangée dans `specs/SPEC-XXXX-*/maquettes/`).
- Gestes, API du navigateur ou de l'appareil (géolocalisation, caméra, notifications) : dans le contrat, l'écran les reçoit par une interface remplacée par un faux (voir « Services tiers, horloge et faux ») ; le comportement réel (geste, permission, installation) se vérifie dans `tests/e2e/`.
- `docs/factory/RISK.md`, `.github/labeler.yml` : les zones par défaut visent une API. `docs/factory/DOMAIN-SECURITY.md` : règles par défaut triées par type d'application.

**Plusieurs applications ou runtimes dans le même dépôt** (ex. API et interface web, API et application mobile, bibliothèque et sa CLI). Deux dispositions, à choisir dans l'ADR-0001 (ligne « Disposition du dépôt ») :

- *Un seul paquet*, chaque feature verticale ayant un point d'entrée par runtime (ex. `src/features/<feature>/server.ts` et `client.tsx`). Un registre généré par runtime, pour que le code serveur n'entre jamais dans le bundle client : `"gen": "node scripts/gen-features.mjs --entry server.ts --out features.server.gen.ts && node scripts/gen-features.mjs --entry client.tsx --out features.client.gen.ts"`. Les tests de chaque runtime choisissent leur environnement (ex. `projects` de Vitest, ou commentaire `// @vitest-environment jsdom` en tête de fichier).
- *Un paquet par application* (`web/`, `mobile/`, `apps/api/`) et un `pnpm-workspace.yaml` : enchaîne `pnpm --filter <paquet> <script>` dans `gen`, `typecheck` et `test:coverage`, et ajoute les paquets à `include` de `tsconfig.json` et de la couverture. Les zones de risque par défaut sont écrites en `**/` et valent déjà dans chaque paquet ; l'étape de mutation de la CI mute aussi `**/src/**` : un paquet que Vitest ne teste pas depuis la racine doit en être exclu, sinon ses mutants comptent comme non couverts.

Dans les deux cas, `pnpm dev` lance tous les serveurs du dépôt, chacun sur son port : `$PORT` pour le premier, `$PORT+1` pour le suivant, dans l'ordre fixé par l'ADR-0001 (ligne « Commande `dev` »). Conductor réserve dix ports par workspace, de `$CONDUCTOR_PORT` à `$CONDUCTOR_PORT+9` : deux workspaces ne se gênent pas. Aucun port en dur (ni celui par défaut du bundler), et l'application cliente lit l'adresse de l'API dans une variable dérivée de `$PORT`. Les serveurs lancés par un même script restent dans le même groupe de processus (un lanceur de processus est une dépendance à justifier), pas en arrière-plan avec `&`.

Dans les deux cas aussi : le contrat d'une spec qui touche plusieurs runtimes se répartit en fichiers suffixés (`SPEC-XXXX.api.test.ts`, `SPEC-XXXX.ui.test.tsx`), SPEC-0000 a un point de santé par application, et le point d'entrée de chaque application est classé en `risk:medium` dans `labeler.yml`.

**Tests sur cible réelle.** Ce que Vitest ne peut pas reproduire (navigateur réel, simulateur ou appareil, paquet installé depuis `npm pack`, binaire de la CLI) se teste dans `tests/e2e/`, avec le lanceur choisi dans l'ADR-0001 (dépendance à justifier) et un script `test:e2e`. Ils tournent **en CI seulement**, dans le job `e2e`, qui ne fait rien tant que ce script n'existe pas : `pnpm verify` reste rapide et ne les lance pas. Runner et versions de Node : variables de dépôt `E2E_RUNNER` (défaut `ubuntu-latest`) et `E2E_NODE_VERSIONS` (tableau JSON, défaut `[22]`, ex. `[20, 22, 24]` pour une bibliothèque). Les services dont ils ont besoin (base, API démarrée) s'ajoutent au job. Le scénario de bout en bout qui doit absolument passer s'écrit dans la section « Parcours sur cible réelle » de la spec. SPEC-0001 pose le lanceur, les services du job et un premier parcours (point de santé). Un parcours à plusieurs utilisateurs ouvre un contexte de navigateur (ou une session) par utilisateur ; ses données de départ se créent par l'interface publique (API, écrans), jamais en écrivant dans la base, et les services tiers y gardent leur faux (ex. boîte de réception factice), sauf si la spec demande le service réel. Pour qu'un agent pilote un navigateur pendant une tâche d'interface, voir `docs/factory/TOKENS.md` (mesure 13). Le job `gates` lance aussi `pnpm run --if-present build`.

**Services tiers, horloge et faux.** Ce que les tests ne peuvent pas appeler pour de vrai (service tiers : email, stockage d'objets, paiement, notifications ; API du navigateur ou de l'appareil ; horloge ; réseau) passe par une interface du projet, avec une implémentation réelle et un faux en mémoire. L'application reçoit ses implémentations par sa fabrique (ex. `createApp({ mailer, clock })`) : les tests de contrat et les scénarios cachés lui passent les faux, et vérifient par eux ce qui a été envoyé (l'email du lien de connexion, le fichier stocké). Ce n'est pas un mock par test : le faux se comporte comme le service (il stocke, il refuse ce que le service refuserait) et sert à toutes les specs. La base de données n'en fait pas partie : elle se teste pour de vrai, sur la ressource du workspace.

- *Où* : l'interface et le faux vivent dans `src/shared/<service>/` (ex. `mailer.ts`, `mailer.fake.ts`), l'implémentation réelle à côté. La liste des services, avec leur implémentation, est la ligne « Services tiers » de l'ADR-0001 (Implications). Un service nouveau s'ajoute dans une tâche « contrat » placée avant celles qui l'utilisent.
- *Horloge* : tout code qui dépend de l'heure (expiration, échéance, rappel, « depuis 30 jours ») la reçoit par une interface `Clock` ; les tests avancent l'horloge factice au lieu d'attendre. Pas de `Date.now()` ni de `new Date()` sans argument dans une feature.
- *Tâches asynchrones* : planifiées (rappel, purge, relance) ou déclenchées par un message d'une file (envoi d'une notification, traitement d'une photo). Une feature les déclare dans son `feature` exporté (ex. `{ routes, jobs, consumers }`), le point d'entrée de l'application les branche sur le planificateur ou la file du runtime (lignes « Tâches planifiées » et « Files de messages » de l'ADR-0001). La publication d'un message passe par le service tiers « file » (`src/shared/queue/`), dont le faux garde les messages publiés. Le contrat appelle la tâche ou le consommateur directement (avec l'horloge factice, ou avec le message relevé dans le faux) et vérifie son effet par l'interface publique et par les faux. Une file livre un message au moins une fois : un consommateur est idempotent, et le contrat le prouve en lui passant deux fois le même message. Une erreur d'un consommateur remonte au suivi des erreurs, et le message est réessayé selon l'ADR-0001. Une publication qui suit une écriture en base n'est pas atomique avec elle : l'ADR-0001 dit comment le message manquant est rattrapé, et le contrat le prouve en faisant échouer la publication dans le faux puis en vérifiant que l'effet finit par se produire. Une notification envoyée à un système tiers (webhook) ne fait que signaler : l'état se relit par l'API.
- *Temps réel* (chat, présence, compteur qui bouge) : l'état vit dans la base et se lit par l'API (liste des messages depuis un curseur, marque de lecture). Un canal temps réel, s'il y en a un (ligne « Temps réel » de l'ADR-0001), ne fait que signaler qu'il y a du nouveau : c'est un service tiers « diffusion » (`src/shared/realtime/`), dont le faux garde les signaux émis. Le contrat vérifie l'état par l'API et le signal par le faux ; un client qui a perdu la connexion retrouve tout par l'API, et ce cas est testé. Sans canal, le client interroge l'API à intervalle, avec l'horloge factice dans ses tests. La connexion réelle se vérifie dans `tests/e2e/`.
- *Événements produit* : le traceur des événements de `docs/PRODUCT.md` (« KPI et événements produit ») est un service comme un autre. Une spec qui émet un événement le vérifie par le faux ; aucune donnée personnelle dans ses propriétés.
- *Contrôle* : SPEC-0000 pose les faux des services connus à l'initialisation ; `scripts/pre-review.mjs check` refuse `Date.now()`, `new Date()` sans argument et `throw new Error(` dans une feature (et `biome-ignore`, `@ts-ignore`, `@ts-expect-error` dans tout `src/`) ; le relecteur signale un appel direct à un service, au réseau ou à une API du navigateur.

**Observabilité.** Sentry est imposé par la factory pour toute application qui s'exécute (API, web, mobile ; CLI si l'ADR-0001 le décide), avec le SDK de son runtime ; sans objet pour une bibliothèque. Il passe par le service tiers « suivi des erreurs » (`src/shared/monitoring/`, faux en test), posé par SPEC-0001 : erreur non gérée transmise avec la version (SHA du commit) et l'environnement, collecte automatique de données personnelles désactivée et filtre avant envoi, prouvés par le contrat avec le faux ; sourcemaps envoyées par `pnpm release`. Sans DSN (tests, développement local par défaut), le suivi est inactif. Ces fichiers sont en zone sensible (`review:full`).

Le serveur MCP `sentry` de `.mcp.json` est en **lecture seule** (`MCP_SKILLS=inspect`) : `/fix` lit une issue Sentry (trace, release, fréquence) et `/retro` compte les erreurs de production. Il lit le jeton `SENTRY_ACCESS_TOKEN` de l'environnement du poste : un jeton utilisateur limité aux droits `org:read`, `project:read`, `team:read`, `event:read`, jamais dans le dépôt ni dans `.env`. Sans jeton, le serveur ne démarre pas et le reste de la factory n'en dépend pas. Pour t'en passer, retire `sentry` de `enabledMcpjsonServers` dans `.claude/settings.json`. Les jetons Sentry sont détectés par les règles par défaut de gitleaks.

**Montage des features.** `scripts/gen-features.mjs` liste dans `src/features.gen.ts` les features qui exportent `feature` depuis `src/features/<feature>/index.ts` (ou `index.tsx`). Ce qu'est une `feature` (routes HTTP, écrans, commandes de CLI) est fixé par SPEC-0000. Une feature sans point d'entrée est ignorée. Options : `--entry <fichier>` et `--out <fichier>.gen.ts` (un registre par runtime, voir ci-dessus) ; `--reexport` génère des `export * from` au lieu de la liste, pour la surface publique d'une bibliothèque (`src/index.ts` contient alors `export * from "./features.gen";` et n'est plus édité par les tâches). Pour un autre mode de montage, adapte le script et son test en gardant la règle : aucun registre édité à la main.

**Routage par fichiers** (ex. Expo Router, App Router de Next.js). Le framework impose un dossier de routes (`app/`) hors de `src/features/`. Pour qu'il ne devienne ni un second emplacement du code, ni un registre central :

- *Frontières entre features* : une feature n'importe que ses fichiers, `src/shared/` et le point d'entrée public d'une autre feature (`index.ts`). `scripts/pre-review.mjs check` refuse un import vers l'intérieur d'une autre feature (chemin relatif ou alias `@/` ; un autre alias n'est pas vu). Une feature qui a un point d'entrée par runtime les déclare : `"factory": { "featureEntries": ["server.ts", "client.tsx"] }`. Le contrôle ne lit que les fichiers modifiés du diff, et ne regarde pas les imports faits depuis hors de `src/features/` (point d'entrée de l'application, routes fines).
- *Routes fines* : un fichier de route ne fait que réexporter l'écran de sa feature (`export { default } from "@/features/events/screens/EventScreen";`). L'écran, sa logique et ses tests restent dans `src/features/<feature>/`. Le dossier est déclaré dans `package.json` (`"factory": { "routeDirs": ["mobile/app"], "routeIgnore": ["_layout.tsx", "+*"] }`), et `scripts/pre-review.mjs check` refuse une route qui contient autre chose que des réexports. `routeIgnore` liste, en globs sur le nom du fichier, ce qui n'est pas une route dans ce framework : layouts et fichiers spéciaux (Expo Router : `_layout.tsx`, `+not-found.tsx` ; App Router de Next.js : `layout.tsx`, `loading.tsx`, `error.tsx`). Sans cette liste, tout fichier `.ts` ou `.tsx` du dossier est contrôlé.
- *Layouts qui lisent le registre* : un layout qui liste des écrans (onglets, menu) lit le registre généré du runtime au lieu d'une liste écrite à la main. Chaque feature déclare ses entrées dans son point d'entrée (ex. `tabs: [{ route: "explore", title: "Explorer", icon: "search", order: 2 }]`) et le layout rend un écran d'onglet par entrée, triées par `order` (Expo Router : un `Tabs.Screen` par entrée). Ajouter un onglet touche la feature et son fichier de route, jamais le layout. Les écrans qui ne sont pas des onglets vivent hors du groupe des onglets (ex. `app/events/[id].tsx`).
- *Propriété* : les layouts sont posés par SPEC-0000 et n'entrent dans le périmètre d'aucune tâche de feature ; les changer est une tâche « contrat » à part, et le fichier s'inscrit dans `docs/factory/HOTSPOTS.md`. Les routes, hors de `src/`, sortent de la couverture et de la mutation, sans perte puisqu'elles ne contiennent rien.

## Adopter la factory dans un projet existant

Copie `.claude/`, `.conductor/`, `.github/`, `.mcp.json`, `.gitleaks.toml`, `lefthook.yml`, `commitlint.config.js`, `scripts/`, `tests/unit/`, `docs/factory/`, `docs/adr/_template.md`, `specs/_template/` et `CLAUDE.md`. Reprends de `package.json` les scripts `gen`, `typecheck`, `lint`, `test:coverage`, `verify`, `verify:quiet`, `tokens`, `prepare` et les dépendances de développement, et de `.gitignore` les entrées `.pr-summary.md`, `.factory/`, `.context/`. Crée `tests/acceptance/`, `tests/holdout/` et un `tsconfig.test.json` qui les inclut, et reprends de `vitest.config.ts` l'exclusion de `tests/holdout` (variable `HOLDOUT`). Les scripts supposent `origin/main` comme base (`BASE_REF` pour en changer) et `pnpm verify` comme commande de vérification.

## Limites connues

- Les scénarios cachés sont retirés du workspace, pas de l'historique git : la barrière arrête l'accident (une recherche, un `pnpm test`), pas un agent qui irait les chercher. Deux règles `deny` de `.claude/settings.json` ferment les chemins les plus directs.
- Le relecteur au niveau `full` change de modèle, pas de famille de modèles : les erreurs communes à tous les modèles d'un même éditeur ne sont pas couvertes.
- Outillage lié à TypeScript, pnpm, Biome et Vitest (le hook d'édition `scripts/lint-edit.mjs` lance Biome sur le fichier édité et renvoie ses erreurs à l'agent ; les règles `noConsole`, `noNonNullAssertion` et de complexité de `biome.json` ne visent que `src/` ; `src/shared/` peut appeler `console`, pour l'implémentation réelle des logs, et les tests échappent aux deux autres). Un autre lanceur peut jouer une partie du contrat et des scénarios cachés (`factory.contractRunners`, voir « Options ») ; la couverture et la mutation livrées restent celles de Vitest et Stryker. Les scripts de la factory (`scripts/*.mjs`) n'ont besoin que de Node et de git ; pour une autre stack, il faut réécrire `pnpm verify`, la CI et le hook Biome de `.claude/settings.json`.
- Le rapport de tokens lit les transcripts locaux de Claude Code (`~/.claude/projects/`) : il dépend de leur format et du nom du dossier du dépôt.
- Les baux reposent sur les variables `CONDUCTOR_ROOT_PATH` et `CONDUCTOR_WORKSPACE_PATH` : hors Conductor, ils se replient sur le dossier courant et ne protègent plus rien entre deux clones.
- La règle `Read(.env.*)` de `.claude/settings.json` couvre aussi `.env.example` : un agent ne peut ni le lire ni l'écrire avec ses outils de fichiers. Remplace-la par `Read(.env.local)` si tu veux que les tâches le tiennent à jour.
- Documentation, commandes et messages des scripts sont en français.
