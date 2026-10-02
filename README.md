# Boilerplate de software factory IA

Socle réutilisable pour développer un projet avec des agents Claude Code en parallèle (workspaces Conductor), sous contrôle humain. Il ne contient aucun code applicatif : seulement le processus, ses garde-fous et l'outillage TypeScript qui les fait tenir.

Extrait d'un projet réel (service de raccourcissement d'URL), dont il reprend les scripts et leurs tests tels quels.

## Le principe

L'humain décide du **quoi** (spec et tests de contrat) et arbitre les fusions. Les agents font le **comment**, chacun dans un workspace isolé, sur un périmètre de fichiers déclaré. Tout ce qu'un script peut vérifier est vérifié par un script, pas par une consigne.

```
/new-spec ──► PR de spec ──► /plan ──► PR de plan ──► /implement T1 ┐
 (humain relit et fusionne)   (humain relit et fusionne)  /implement T2 ├─► /review ─► /ship ─► CI ─► /land
                                                          /implement T3 ┘   (boucle ≤ 3)        (humain arbitre)
                                        vendredi : /retro ─► /learn ─► règle durable
```

Le cycle complet est décrit dans `docs/factory/WORKFLOW.md`, et chaque concept (bail, périmètre, test de contrat, verdict, patch-id…) est défini dans `docs/factory/LEXIQUE.md`.

## Ce que contient la factory

| Mécanisme | Ce qu'il garantit | Fichiers |
|---|---|---|
| Spec contrat | Pas de code sans spec ; critères numérotés `CA#` | `specs/_template/spec.md`, `/new-spec` |
| Tests de contrat immuables | Un agent ne peut que retirer `.skip` ; le reste demande le label `contract-change` | `tests/acceptance/`, `scripts/check-contract.mjs` |
| Scénarios cachés | L'implémentation satisfait l'intention, pas seulement les tests qu'elle voit : parcours écrits avec la spec, retirés du workspace du producteur, joués en CI | `tests/holdout/`, `scripts/holdout.mjs`, `/new-spec`, `/implement` |
| Relecture de spec | Critères testables et tests qui les vérifient, avant la lecture humaine | subagent `spec-reviewer`, `/new-spec`, `/review` |
| Plan en tâches | 3 à 5 tâches par spec, groupes parallèles, périmètre en chemins | subagent `planner`, `/plan`, `scripts/plan-gate.mjs`, `scripts/split-plan.mjs` |
| Baux de périmètre | Deux workspaces ne modifient jamais les mêmes chemins | `scripts/lease.mjs` (état dans `.factory/` du dépôt principal, hors git) |
| Suivi visuel | Une issue par spec et par tâche, statut dérivé des PR, Kanban via GitHub Project | `scripts/board.mjs`, `.github/workflows/board.yml`, `docs/factory/BOARD.md` |
| Aucun registre central | Ajouter une feature ne touche aucun fichier partagé | `scripts/gen-routes.mjs` (`pnpm gen`) |
| Vérification unique | Typage, lint, tests, couverture 80 %, contrat en une commande | `pnpm verify`, `pnpm verify:quiet` |
| Revue adversariale locale | Relecteur à contexte vierge, sur un autre modèle que le producteur en risque élevé ; verdict lié au `patch-id` du diff ; push refusé sans revue `OK` à jour | subagent `reviewer`, `/review`, `scripts/pre-review.mjs`, `scripts/review-gate.mjs`, `lefthook.yml` |
| Trace de revue en CI | Le corps de la PR porte un verdict qui correspond au diff | `.github/workflows/review-trace.yml` |
| Routage par risque | Étiquette `risk:*` selon les chemins ; niveau de revue et arbitrage humain en découlent | `.github/labeler.yml`, `.github/workflows/risk.yml`, `.github/CODEOWNERS`, `docs/factory/RISK.md` |
| Gates de CI | Titre de PR, typage, lint, tests, contrat, scénarios cachés, mutation sur les fichiers modifiés, gitleaks, Semgrep ; rejoués sur `main` après chaque fusion | `.github/workflows/ci.yml`, `scripts/security-scan.mjs` |
| Fusion sans merge queue | `main` verte, checks verts, confirmation humaine sur `risk:high` et `contract-change`, squash | `/land`, `/resolve`, subagent `conflict-resolver` |
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
2. Personnalise : `node scripts/init-factory.mjs <nom-du-projet> <propriétaire-github>`. Le script remplace les jetons, renomme le paquet, déplace ce guide dans `docs/factory/BOILERPLATE.md`, installe le README du projet et se supprime.
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
| `docs/adr/0001-stack.md` | Les choix laissés ouverts : framework, validation, persistance, interface |
| `specs/SPEC-0000-bootstrap/spec.md`, `tests/acceptance/SPEC-0000.test.ts` | Critères et assertions du socle, puis statut `VALIDÉE` |
| `docs/factory/DOMAIN-SECURITY.md` | Les règles de sécurité du domaine |
| `docs/factory/RISK.md`, `.github/labeler.yml`, `.github/CODEOWNERS` | Les zones sensibles du domaine, dans les trois fichiers à la fois |
| `.claude/settings.json` | `enabledPlugins` et les connecteurs refusés dépendent du poste (voir `docs/factory/TOKENS.md`) |
| `package.json` | Le script `dev`, posé par SPEC-0000 |
| `vitest.config.ts`, `.github/workflows/ci.yml` | Points d'entrée exclus de la couverture et de la mutation ; services de CI |
| `.env.example` | À créer : variables attendues, avec des clés factices `test-key` ou `key-<nom>` (convention de `.gitleaks.toml`) |
| `docs/factory/WORKFLOW.md` | La roadmap d'autonomie (proposition à ajuster) |

## Réglages GitHub

Les étiquettes doivent exister avant la première PR (`gh pr edit --add-label` échoue sinon) :

```bash
gh label create "risk:high" --color d73a4a --description "Zone à risque élevé : revue humaine obligatoire"
gh label create "risk:medium" --color fbca04 --description "Risque moyen : revue humaine allégée"
gh label create "risk:low" --color 0e8a16 --description "Risque faible"
gh label create "contract" --color 5319e7 --description "Tests d'acceptation / spec contrat"
gh label create "contract-change" --color b60205 --description "Modification d'un test de contrat : validation humaine requise"
```

- Fusion : n'autoriser que le squash-merge, avec suppression automatique des branches.
- Si le plan GitHub le permet : protection de `main` avec les checks `gates`, `security`, `pr-title`, `review-trace` requis et « Require review from Code Owners ». Sur le plan Free d'un dépôt privé, ces règles n'existent pas : `/land` et le hook `pre-push` tiennent lieu de barrières.
- `contract-change` et `node scripts/review-gate.mjs waive` sont réservés à l'humain.

## Options

**Postgres, une base par workspace.** Ajoute ce `docker-compose.yml` à la racine : le setup Conductor crée alors la base `<projet>_<workspace>`, écrit `DATABASE_URL` dans `.env.local`, et l'archivage la supprime. Décommente aussi le bloc `services` de `.github/workflows/ci.yml` et ajoute un script `db:migrate` (appelé s'il existe).

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

**Interface web dans le même dépôt.** Ajoute un paquet `web/` et un `pnpm-workspace.yaml`, enchaîne `pnpm --filter web <script>` dans `typecheck` et `test:coverage`, ajoute un build à la CI et classe `web/**` en `risk:medium` (chemins d'authentification et `index.html` en `risk:high`).

**Sans routes.** `scripts/gen-routes.mjs` suppose des features qui exportent `routes` depuis `src/features/<feature>/routes.ts`. Pour un autre mode de montage, adapte le script et son test en gardant la règle : aucun registre édité à la main.

## Adopter la factory dans un projet existant

Copie `.claude/`, `.conductor/`, `.github/`, `.mcp.json`, `.gitleaks.toml`, `lefthook.yml`, `commitlint.config.js`, `scripts/`, `tests/unit/`, `docs/factory/`, `docs/adr/_template.md`, `specs/_template/` et `CLAUDE.md`. Reprends de `package.json` les scripts `gen`, `typecheck`, `lint`, `test:coverage`, `verify`, `verify:quiet`, `tokens`, `prepare` et les dépendances de développement, et de `.gitignore` les entrées `.pr-summary.md`, `.factory/`, `.context/`. Crée `tests/acceptance/`, `tests/holdout/` et un `tsconfig.test.json` qui les inclut, et reprends de `vitest.config.ts` l'exclusion de `tests/holdout` (variable `HOLDOUT`). Les scripts supposent `origin/main` comme base (`BASE_REF` pour en changer) et `pnpm verify` comme commande de vérification.

## Limites connues

- Les scénarios cachés sont retirés du workspace, pas de l'historique git : la barrière arrête l'accident (une recherche, un `pnpm test`), pas un agent qui irait les chercher. Deux règles `deny` de `.claude/settings.json` ferment les chemins les plus directs.
- Le relecteur de risque élevé change de modèle, pas de famille de modèles : les erreurs communes à tous les modèles d'un même éditeur ne sont pas couvertes.
- Outillage lié à TypeScript, pnpm, Biome et Vitest. Les scripts de la factory (`scripts/*.mjs`) n'ont besoin que de Node et de git ; pour une autre stack, il faut réécrire `pnpm verify`, la CI et le hook Biome de `.claude/settings.json`.
- Le rapport de tokens lit les transcripts locaux de Claude Code (`~/.claude/projects/`) : il dépend de leur format et du nom du dossier du dépôt.
- Les baux reposent sur les variables `CONDUCTOR_ROOT_PATH` et `CONDUCTOR_WORKSPACE_PATH` : hors Conductor, ils se replient sur le dossier courant et ne protègent plus rien entre deux clones.
- La règle `Read(.env.*)` de `.claude/settings.json` couvre aussi `.env.example` : un agent ne peut ni le lire ni l'écrire avec ses outils de fichiers. Remplace-la par `Read(.env.local)` si tu veux que les tâches le tiennent à jour.
- Documentation, commandes et messages des scripts sont en français.
