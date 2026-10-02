---
description: Initialiser un nouveau projet à partir du boilerplate en te posant les questions utiles
argument-hint: [nom du projet, facultatif]
---

Initialise ce dépôt, créé depuis le boilerplate, pour un nouveau projet. Argument éventuel : $ARGUMENTS

Garde-fou : si `README.project.md` n'existe pas, le dépôt est déjà initialisé. Dis-le et arrête-toi. Cette commande n'a pas de spec : c'est de la mise en place de l'outillage (mode hors spec).

## 1. Poser les questions

Utilise `AskUserQuestion`, en un ou deux envois groupés, et en français. Ne suppose rien : propose des options, l'utilisateur peut toujours répondre autre chose.

1. **Nom du projet** (kebab-case, ex. `mon-projet`). Reprends l'argument s'il est fourni et valide, sinon propose le nom du dossier courant.
2. **Propriétaire GitHub** : utilisateur, organisation ou `org/equipe`. Propose la valeur de `gh api user -q .login` si `gh` répond.
3. **Phrase sur le produit** : une phrase, pour le README et l'ADR.
4. **Phase d'autonomie de départ** (voir `docs/factory/WORKFLOW.md`, « Roadmap d'autonomie »). Recommande la 1.
   - **1** : 2 agents en parallèle, tu fusionnes toutes les PR (`/land`).
   - **2** : 3 ou 4 agents en parallèle, lecture allégée hors `risk:high`.
   - **3** : 3 ou 4 agents, auto-merge des PR `risk:low`. Prérequis : scénarios cachés sur chaque spec et `gates` vert sur `main`. Même si elle est choisie, l'auto-merge reste désactivé (ligne commentée de `.github/workflows/risk.yml`) tant que tu ne l'actives pas toi-même ; dis-le.
5. **Type d'application** : API ou service, application web, application mobile, CLI ou bibliothèque. Plusieurs réponses sont possibles (ex. API et application mobile) : demande alors si elles vivent dans ce même dépôt.
6. **Base de données** : aucune, ou Postgres (une base par workspace Conductor). Ne pose pas la question si le type d'application l'exclut.
7. **Choix de stack** pour `docs/adr/0001-stack.md` : framework (HTTP, interface web ou mobile, CLI), validation des entrées, persistance, tests d'interface, découpage d'une feature. Propose des options adaptées aux réponses précédentes, ou « à décider plus tard » (le champ reste `<à compléter>`).
8. **Zones sensibles du domaine** (authentification, paiement, données personnelles...) : liste libre ou « aucune pour l'instant ».

Récapitule les réponses et demande confirmation avant d'écrire quoi que ce soit.

## 2. Appliquer

1. Lance : `node scripts/init-factory.mjs <nom> <propriétaire> --phase <1|2|3> --description '<phrase>'`. Mets la phrase entre **guillemets simples**, en remplaçant chaque `'` par `'\''` : entre guillemets doubles, le shell évaluerait les backticks, `$(...)` et `$VAR`. La phrase doit tenir sur une seule ligne. Le script remplace les jetons, fixe la phase, déplace le guide dans `docs/factory/BOILERPLATE.md`, et supprime cette commande ainsi que lui-même. S'il échoue, corrige l'entrée invalide avec l'utilisateur et relance.
2. **Postgres** : crée `docker-compose.yml` avec le bloc de `docs/factory/BOILERPLATE.md` (section « Options »), décommente le bloc `services` et `env` de `.github/workflows/ci.yml` (sans `API_KEYS` si le projet n'en a pas), et rappelle qu'un script `db:migrate` sera nécessaire.
3. **Application web ou mobile, ou plusieurs applications dans le dépôt** : n'ajoute rien. Signale ce que SPEC-0000 posera selon la section « Options » du guide : réglages de `tsconfig.json` et de `vitest.config.ts`, script `dev`, et pour plusieurs applications les paquets (ex. `web/`, `mobile/`) avec `pnpm-workspace.yaml`.
4. Complète `docs/adr/0001-stack.md` avec les réponses (contexte, type d'application, choix de stack, conséquences) : date du jour, statut `proposée`.
5. Complète dans `CLAUDE.md` la section « Le projet » en une ou deux phrases ; ne touche pas aux autres sections.
6. Si des zones sensibles ont été données, propose-les dans `docs/factory/DOMAIN-SECURITY.md`, `docs/factory/RISK.md`, `.github/labeler.yml` et `.github/CODEOWNERS` à la fois. Montre le diff avant d'écrire.
7. Ne remplis pas `specs/SPEC-0000-bootstrap/spec.md` ni son test de contrat à sa place : propose de le faire ensuite avec lui, dans ce même commit initial.

## 3. Finir

1. Lance `git status` et vérifie qu'il ne reste aucun `{{...}}` : `grep -rn "{{[A-Z_]*}}" CLAUDE.md README.md docs .github`.
2. Ne commite ni ne pousse sans demander. Si l'utilisateur accepte, `git add -A && git commit -m "chore(factory): bootstrap software factory"`. Le push sur `main` est une action sortante : confirme-le explicitement, et fais-le **avant** `pnpm install` (voir `docs/factory/BOILERPLATE.md`, étape 4).
3. Termine par la liste de ce qui reste à faire à la main : réglages GitHub (étiquettes, squash-merge, protection de `main`), `.env`, ajout du dépôt dans Conductor, puis `/new-spec` ou `/plan SPEC-0000`.
