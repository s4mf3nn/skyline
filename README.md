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
| Livraison | Lancée à la main, depuis un commit de `main` vert, avec approbation et secrets de l'environnement `production` ; la commande vient du projet | `.github/workflows/release.yml`, `pnpm release` (SPEC-0000) |
| Fusion sans merge queue | `main` verte, checks verts, confirmation humaine sur `risk:high` et `contract-change`, squash | `/land`, `/resolve`, subagent `conflict-resolver` |
| Correction de bug | Un bug se corrige contre la spec existante, avec le test qui le reproduit ; une spec fausse s'amende avant | `/fix`, `scripts/pre-review.mjs`, `docs/factory/WORKFLOW.md` |
| Boucle d'amélioration | Un incident devient un lint, un test ou un script avant de devenir une consigne | `/retro`, `/learn`, `docs/factory/{LEARNINGS,METRICS,HOTSPOTS}.md` |
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
3. Complète les fichiers de la liste « À personnaliser » ci-dessous, dont `docs/adr/0001-stack.md`, `specs/SPEC-0000-bootstrap/spec.md` et son test de contrat `tests/acceptance/SPEC-0000.test.ts`. Fais-le **dans ce commit initial** : une fois le fichier de contrat sur `main`, le modifier demande le label `contract-change`.
4. Commite et pousse sur `main` **avant** `pnpm install` : `git add -A && git commit -m "chore(factory): bootstrap software factory" && git push -u origin main`. Une fois les hooks installés, le `pre-push` refuse tout push sans revue enregistrée, y compris sur `main`, et il a besoin d'un `origin/main` existant. Si tu as déjà lancé `pnpm install`, la sortie prévue est `node scripts/review-gate.mjs waive "commit initial"` (réservée à l'humain).
5. Applique les « Réglages GitHub » ci-dessous.
6. Crée un `.env` à la racine du dépôt principal si le projet a des variables d'environnement (il est relié dans chaque workspace par le setup).
7. Ajoute le dépôt dans Conductor : `.conductor/settings.toml` déclare déjà les scripts de setup, d'archivage et de lancement.
8. Dans un premier workspace : `/plan SPEC-0000`, fusionne la PR de plan, puis `/implement SPEC-0000 T1` dans un nouveau workspace. SPEC-0000 s'exécute seule, avant toute autre spec.

## À personnaliser

| Fichier | Quoi |
|---|---|
| `CLAUDE.md` | Sections « Le projet », « Conventions de code » (selon la stack) et « Sécurité propre au domaine » |
| `docs/adr/0001-stack.md` | Type d'application, tableau des technologies (imposées, choisies, à décider) et section Implications (runtime, tests, données, secrets, déploiement) |
| `specs/SPEC-0000-bootstrap/spec.md`, `tests/acceptance/SPEC-0000.test.ts` | Critères et assertions du socle, puis statut `VALIDÉE` |
| `docs/factory/DOMAIN-SECURITY.md` | Les règles de sécurité du domaine |
| `docs/factory/RISK.md`, `.github/labeler.yml`, `.github/CODEOWNERS` | Les zones sensibles du domaine, dans les trois fichiers à la fois |
| `.claude/settings.json` | `enabledPlugins` et les connecteurs refusés dépendent du poste (voir `docs/factory/TOKENS.md`) |
| `package.json` | Le script `dev`, posé par SPEC-0000 |
| `tsconfig.json`, `tsconfig.test.json` | `jsx`, `lib` et `types` selon le type d'application (voir « Options ») |
| `vitest.config.ts`, `.github/workflows/ci.yml` | Environnement de test ; points d'entrée exclus de la couverture et de la mutation ; services de CI |
| `.env.example` | À créer : variables attendues, avec des clés factices `test-key` ou `key-<nom>` (convention de `.gitleaks.toml`) |
| `docs/factory/WORKFLOW.md` | La roadmap d'autonomie (proposition à ajuster) ; la phase de départ est fixée par `--phase` |

## Réglages GitHub

Les étiquettes doivent exister avant la première PR (`gh pr edit --add-label` échoue sinon) :

```bash
gh label create "risk:high" --color d73a4a --description "Zone à risque élevé : revue humaine obligatoire"
gh label create "risk:medium" --color fbca04 --description "Risque moyen : revue humaine allégée"
gh label create "risk:low" --color 0e8a16 --description "Risque faible"
gh label create "review:full" --color 8f1a8f --description "Relecteur sur Opus : auth, migrations, config, docker-compose.yml"
gh label create "contract" --color 5319e7 --description "Tests d'acceptation / spec contrat"
gh label create "contract-change" --color b60205 --description "Modification d'un test de contrat : validation humaine requise"
```

- Fusion : n'autoriser que le squash-merge, avec suppression automatique des branches.
- Si le plan GitHub le permet : protection de `main` avec les checks `gates`, `security`, `pr-title`, `review-trace` requis et « Require review from Code Owners ». Sur le plan Free d'un dépôt privé, ces règles n'existent pas : `/land` et le hook `pre-push` tiennent lieu de barrières.
- `contract-change` et `node scripts/review-gate.mjs waive` sont réservés à l'humain.
- Livraison (si l'ADR-0001 en prévoit une) : crée l'environnement `production` (Settings → Environments) avec toi en relecteur obligatoire et `main` comme seule branche de déploiement, et range-y les secrets de livraison. Le workflow `release` (lancé à la main : Actions → release → Run workflow) refuse un commit de `main` dont `gates` n'est pas vert, puis lance `pnpm release`. Variable facultative : `RELEASE_RUNNER` (défaut `ubuntu-latest` ; une application iOS demande macOS).
- Tests sur cible réelle (si le projet a un script `test:e2e`) : ajoute les checks `e2e` aux checks requis.

## Options

**Ressource de données par workspace.** Des agents travaillent en parallèle : chacun a besoin de sa propre ressource de données, créée au setup du workspace et supprimée à son archivage. Le mécanisme est une décision de l'ADR-0001 (section Implications) : Postgres local en Docker (ci-dessous, le seul que les scripts de la factory savent créer), branche d'une base hébergée (ex. Neon), instance locale d'un service (ex. Supabase), ou aucune ressource. Pour tout mécanisme autre que Docker, le projet fournit un script exécutable `scripts/workspace-data.sh`, appelé s'il existe par le setup (`setup`) et par l'archivage (`archive`) Conductor, avec les variables `WORKSPACE_NAME` et `PROJECT_NAME` (identifiants en minuscules et underscores). `setup` crée la ressource (ex. une branche de base hébergée) et ajoute ses variables à `.env.local` sans l'écraser ; `archive` la supprime (son code de retour est ignoré). Les deux sont idempotents. Ce script est écrit par SPEC-0000 d'après l'ADR-0001 : ne code aucun fournisseur en dur dans les scripts de la factory.

Dans un même workspace, les fichiers de test tournent en parallèle sur la même ressource, et Stryker relance les tests en parallèle à chaque mutant. SPEC-0000 fixe comment les tests s'isolent (transaction annulée par test, schéma par processus de test, ou `fileParallelism: false`) et règle `concurrency` de `stryker.config.json` en conséquence. Un outil qui tient un fichier central (ex. un journal de migrations) recrée un fichier partagé entre tâches : choisis une version ou une option qui l'évite, sinon inscris le fichier dans `docs/factory/HOTSPOTS.md` et range les tâches qui le touchent dans des groupes différents.

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
- Tailwind est imposé par la factory pour toute interface (NativeWind pour React Native) ; il est consigné dans l'ADR-0001, et SPEC-0000 le pose.
- `docs/factory/RISK.md`, `.github/labeler.yml`, `docs/factory/DOMAIN-SECURITY.md` : les zones et règles par défaut visent une API.

**Plusieurs applications ou runtimes dans le même dépôt** (ex. API et interface web, API et application mobile, bibliothèque et sa CLI). Deux dispositions, à choisir dans l'ADR-0001 (ligne « Disposition du dépôt ») :

- *Un seul paquet*, chaque feature verticale ayant un point d'entrée par runtime (ex. `src/features/<feature>/server.ts` et `client.tsx`). Un registre généré par runtime, pour que le code serveur n'entre jamais dans le bundle client : `"gen": "node scripts/gen-features.mjs --entry server.ts --out features.server.gen.ts && node scripts/gen-features.mjs --entry client.tsx --out features.client.gen.ts"`. Les tests de chaque runtime choisissent leur environnement (ex. `projects` de Vitest, ou commentaire `// @vitest-environment jsdom` en tête de fichier).
- *Un paquet par application* (`web/`, `mobile/`, `apps/api/`) et un `pnpm-workspace.yaml` : enchaîne `pnpm --filter <paquet> <script>` dans `gen`, `typecheck` et `test:coverage`, et ajoute les paquets à `include` de `tsconfig.json` et de la couverture. Les zones de risque par défaut sont écrites en `**/` et valent déjà dans chaque paquet ; l'étape de mutation de la CI mute aussi `**/src/**` : un paquet que Vitest ne teste pas depuis la racine doit en être exclu, sinon ses mutants comptent comme non couverts.

Dans les deux cas : le contrat d'une spec qui touche plusieurs runtimes se répartit en fichiers suffixés (`SPEC-XXXX.api.test.ts`, `SPEC-XXXX.ui.test.tsx`), SPEC-0000 a un point de santé par application, et le point d'entrée de chaque application est classé en `risk:medium` dans `labeler.yml`.

**Tests sur cible réelle.** Ce que Vitest ne peut pas reproduire (navigateur réel, simulateur ou appareil, paquet installé depuis `npm pack`, binaire de la CLI) se teste dans `tests/e2e/`, avec le lanceur choisi dans l'ADR-0001 (dépendance à justifier) et un script `test:e2e`. Ils tournent **en CI seulement**, dans le job `e2e`, qui ne fait rien tant que ce script n'existe pas : `pnpm verify` reste rapide et ne les lance pas. Runner et versions de Node : variables de dépôt `E2E_RUNNER` (défaut `ubuntu-latest`) et `E2E_NODE_VERSIONS` (tableau JSON, défaut `[22]`, ex. `[20, 22, 24]` pour une bibliothèque). Les services dont ils ont besoin (base, API démarrée) s'ajoutent au job. Le scénario de bout en bout qui doit absolument passer s'écrit dans la section « Parcours sur cible réelle » de la spec. Pour qu'un agent pilote un navigateur pendant une tâche d'interface, voir `docs/factory/TOKENS.md` (mesure 13). Le job `gates` lance aussi `pnpm run --if-present build`.

**Montage des features.** `scripts/gen-features.mjs` liste dans `src/features.gen.ts` les features qui exportent `feature` depuis `src/features/<feature>/index.ts` (ou `index.tsx`). Ce qu'est une `feature` (routes HTTP, écrans, commandes de CLI) est fixé par SPEC-0000. Une feature sans point d'entrée est ignorée : si le framework monte déjà les features lui-même (routage par fichiers), la liste générée reste vide. Options : `--entry <fichier>` et `--out <fichier>.gen.ts` (un registre par runtime, voir ci-dessus) ; `--reexport` génère des `export * from` au lieu de la liste, pour la surface publique d'une bibliothèque (`src/index.ts` contient alors `export * from "./features.gen";` et n'est plus édité par les tâches). Pour un autre mode de montage, adapte le script et son test en gardant la règle : aucun registre édité à la main.

## Adopter la factory dans un projet existant

Copie `.claude/`, `.conductor/`, `.github/`, `.mcp.json`, `.gitleaks.toml`, `lefthook.yml`, `commitlint.config.js`, `scripts/`, `tests/unit/`, `docs/factory/`, `docs/adr/_template.md`, `specs/_template/` et `CLAUDE.md`. Reprends de `package.json` les scripts `gen`, `typecheck`, `lint`, `test:coverage`, `verify`, `verify:quiet`, `tokens`, `prepare` et les dépendances de développement, et de `.gitignore` les entrées `.pr-summary.md`, `.factory/`, `.context/`. Crée `tests/acceptance/`, `tests/holdout/` et un `tsconfig.test.json` qui les inclut, et reprends de `vitest.config.ts` l'exclusion de `tests/holdout` (variable `HOLDOUT`). Les scripts supposent `origin/main` comme base (`BASE_REF` pour en changer) et `pnpm verify` comme commande de vérification.

## Limites connues

- Les scénarios cachés sont retirés du workspace, pas de l'historique git : la barrière arrête l'accident (une recherche, un `pnpm test`), pas un agent qui irait les chercher. Deux règles `deny` de `.claude/settings.json` ferment les chemins les plus directs.
- Le relecteur au niveau `full` change de modèle, pas de famille de modèles : les erreurs communes à tous les modèles d'un même éditeur ne sont pas couvertes.
- Outillage lié à TypeScript, pnpm, Biome et Vitest. Un autre lanceur peut jouer une partie du contrat et des scénarios cachés (`factory.contractRunners`, voir « Options ») ; la couverture et la mutation livrées restent celles de Vitest et Stryker. Les scripts de la factory (`scripts/*.mjs`) n'ont besoin que de Node et de git ; pour une autre stack, il faut réécrire `pnpm verify`, la CI et le hook Biome de `.claude/settings.json`.
- Le rapport de tokens lit les transcripts locaux de Claude Code (`~/.claude/projects/`) : il dépend de leur format et du nom du dossier du dépôt.
- Les baux reposent sur les variables `CONDUCTOR_ROOT_PATH` et `CONDUCTOR_WORKSPACE_PATH` : hors Conductor, ils se replient sur le dossier courant et ne protègent plus rien entre deux clones.
- La règle `Read(.env.*)` de `.claude/settings.json` couvre aussi `.env.example` : un agent ne peut ni le lire ni l'écrire avec ses outils de fichiers. Remplace-la par `Read(.env.local)` si tu veux que les tâches le tiennent à jour.
- Documentation, commandes et messages des scripts sont en français.
