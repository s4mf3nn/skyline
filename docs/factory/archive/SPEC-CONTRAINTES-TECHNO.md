# SPEC-FACTORY : Contraintes technologiques déclarées à l'initialisation

Statut : VALIDÉE
Risque estimé : moyen (outillage ; modifie `/init-project`, l'ADR-0001 et les règles de relecture)
Portée : hors spec produit (scope `factory`, voir `docs/factory/WORKFLOW.md`). Ce document n'a donc ni test de contrat ni scénario caché : la validation est humaine, puis `/ship` en mode hors spec.

## Objectif

Au démarrage d'un projet, l'utilisateur peut déclarer les technologies qu'il **impose** (ex. Hono sur Cloudflare Workers, Neon serverless, Supabase, React, Next.js, React Native). Ces contraintes sont consignées au même endroit, respectées par tous les agents, et vérifiées à la relecture. Le boilerplate reste **agnostique** : il ne contient aucun preset de stack, aucune liste fermée de technologies, et ne suppose pas Node comme runtime applicatif.

## Principes

1. **Pas de catalogue.** Une technologie n'a pas besoin d'être « connue » du boilerplate. Ce que l'utilisateur écrit est la source de vérité ; ce qu'on en déduit (compatibilité, impacts) est établi par l'agent à partir de la documentation, via Context7 (`docs/factory/CONTEXT7.md`), et soumis à validation.
2. **Une seule source de vérité : l'ADR-0001.** Pas de second fichier de configuration à synchroniser.
3. **Trois statuts**, pas deux : *imposée* (l'utilisateur l'exige), *choisie* (proposée par l'agent, validée), *à décider*.
4. **Socle et application sont distincts.** Node 22, pnpm, Vitest et Biome sont la *chaîne d'outils* de la factory (scripts, tests, lint). Le *runtime de l'application* (Node, workerd de Cloudflare, Bun, navigateur, Hermes pour React Native...) est une décision de projet, jamais un acquis.
5. **Tailwind est la seule technologie imposée par la factory**, et seulement pour une application avec interface (voir CA6).

## Critères d'acceptation

### Collecte (`/init-project`)

- **CA1** : `/init-project` pose la question des technologies imposées **avant** celles du type d'application, de la base de données et du choix de stack. La question est libre (texte), avec des exemples dans l'énoncé mais **sans liste fermée** ; la réponse « aucune, tu proposes » est possible.
- **CA2** : pour chaque contrainte, l'agent note son **rôle** parmi : runtime applicatif, framework serveur, framework d'interface, style, base de données ou hébergement de données, authentification, déploiement, autre. Si le rôle est ambigu, il le demande.
- **CA3** : les réponses aux questions suivantes (type d'application, base de données) sont **déduites ou précisées** par les contraintes, pas redemandées. Exemple : « Hono sur Workers » implique une API ; « Neon » implique Postgres hébergé. L'agent annonce chaque déduction dans le récapitulatif et l'utilisateur peut la corriger.
- **CA4** : l'agent détecte une **incompatibilité** entre deux contraintes ou avec le socle (ex. pilote Postgres TCP sur Workers) et la soumet à l'utilisateur avec les options, au lieu de la contourner en silence ou de choisir à sa place.

### Consignation (ADR-0001)

- **CA5** : `docs/adr/0001-stack.md` contient un tableau `Technologie | Rôle | Statut | Raison | Source de la doc`. Les contraintes y ont le statut `imposée`. Le statut `à décider` remplace les `<à compléter>` actuels. La section « Imposé par la factory » est reformulée selon le principe 4 : le runtime applicatif n'y figure plus.
- **CA6** : si le projet a une interface (web ou mobile), Tailwind figure dans le tableau avec le statut `imposée` et la raison « exigence de la factory », même si l'utilisateur ne l'a pas citée. Pour React Native, l'agent propose la variante compatible (ex. NativeWind) et la consigne comme `choisie` ; il vérifie son existence et sa version dans la documentation avant de la proposer.
- **CA7** : l'ADR contient une section **« Implications »** rédigée par l'agent et validée, qui répond à : runtime et conséquences (API disponibles, pilotes de base de données utilisables) ; stratégie de test, adaptée au runtime si ce n'est pas Node (comment le contrat et les scénarios cachés s'exécutent sans processus externe, et quel lanceur est ajouté) ; commande `dev` ; ressources de données par workspace (CA10) ; secrets et variables d'environnement ; déploiement.
- **CA8** : modifier ou retirer une contrainte `imposée` exige une nouvelle ADR qui remplace la précédente (statut `remplacée par ADR-XXXX`). Aucun agent ne le fait de lui-même.

### Application par les agents

- **CA9** : la règle 7 de `CLAUDE.md` précise que les technologies `imposées` et `choisies` de l'ADR-0001 sont pré-autorisées comme dépendances. Toute **autre** dépendance reste à justifier dans le résumé de PR. La règle 2 (périmètre) est inchangée.
- **CA10** : la section « Options » du guide du boilerplate remplace « Postgres, une base par workspace » par une règle générale de **ressource de données par workspace**. Elle décrit le besoin (isolation entre agents en parallèle, création au setup, suppression à l'archivage) et laisse l'ADR choisir le mécanisme : Postgres local en Docker (actuel, conservé comme exemple), branche de base hébergée, instance locale d'un service, ou rien. Aucun mécanisme particulier n'est codé en dur dans les scripts de ce document.
- **CA11** : le subagent `reviewer` reçoit comme critère de relecture : toute dépendance, import ou configuration qui contredit une ligne `imposée` de l'ADR est **Bloquant** (ex. une route Express dans un projet imposant Hono, un style hors Tailwind sur une interface). Le `planner` lit le tableau avant de découper, et ne crée pas de tâche qui le contredit.
- **CA12** : à l'initialisation, l'agent amorce `docs/factory/libs-cache.md` pour chaque technologie `imposée` (version épinglée, source nommée, date), en une entrée courte par API structurante, conformément à `docs/factory/CONTEXT7.md`. Si Context7 est indisponible, il le dit et ne remplit rien.

### Sécurité et risque

- **CA13** : pour chaque contrainte qui introduit des secrets, de l'authentification ou un accès aux données (ex. Supabase Auth, clés Neon, jetons Cloudflare), l'agent propose les zones correspondantes pour `docs/factory/DOMAIN-SECURITY.md`, `docs/factory/RISK.md`, `.github/labeler.yml` et `.github/CODEOWNERS`, avec le diff montré avant écriture (comme l'étape 6 actuelle de `/init-project`).

## Cas limites

- L'utilisateur impose une technologie que l'agent ne connaît pas ou ne trouve pas dans Context7 : elle est consignée telle quelle, le champ « Source de la doc » indique `introuvable`, et le cache n'est pas amorcé. Pas de blocage.
- Deux contraintes de même rôle (ex. deux frameworks serveur) : à confirmer, sauf justification explicite (ex. un framework par application dans un dépôt à plusieurs applications).
- Contrainte donnée en cours de projet (le projet est déjà initialisé) : on passe par une nouvelle ADR (CA8), pas par `/init-project`, qui refuse un dépôt déjà initialisé.
- Version non précisée : l'agent épingle la dernière version stable et l'écrit dans l'ADR.
- L'utilisateur répond « à décider plus tard » : le statut `à décider` est conservé ; la première spec qui a besoin du choix doit d'abord le trancher par ADR.
- Plusieurs applications dans le dépôt : le tableau a une colonne ou un sous-tableau par application ; Tailwind s'applique à chaque application avec interface.

## Contrat d'interface

Fichiers modifiés ou créés :

| Fichier | Changement |
|---|---|
| `.claude/commands/init-project.md` | Nouvelle question « technologies imposées » en tête (CA1 à CA4), étape « Implications » (CA7), étape cache (CA12), étape sécurité étendue (CA13) |
| `docs/adr/0001-stack.md` | Tableau des technologies, section Implications, formulation du socle (CA5 à CA7) |
| `docs/adr/_template.md` | Statut `remplacée par` documenté (CA8) |
| `CLAUDE.md` | Règle 7 (CA9) |
| guide du boilerplate (`README.md`, devenant `docs/factory/BOILERPLATE.md`) | Section « Options » (CA10), « Application web ou mobile » : Tailwind (CA6) |
| `.claude/agents/reviewer.md`, `.claude/agents/planner.md` | Lecture du tableau, critère Bloquant (CA11) |

Aucun script n'est ajouté. `scripts/init-factory.mjs` n'est pas modifié : il remplace des jetons et fixe la phase, la collecte des contraintes reste dans `/init-project`.

## Hors périmètre

- Un catalogue ou des presets de stacks, ou la génération du code d'amorçage de la stack (c'est SPEC-0000 du projet).
- Un contrôle automatique des dépendances par script. La contrainte est vérifiée à la relecture (CA11). Un `stack-gate` mécanique pourra venir ensuite si des dérives se produisent (à mesurer via `/retro`).
- L'installation ou la configuration réelle de Tailwind, Hono, Neon, etc.
- La migration d'un projet déjà initialisé.

## Contraintes

- Langue : texte des fichiers en français, identifiants et noms de technologies tels quels.
- Aucune nouvelle dépendance.
- `/init-project` reste utilisable en une session : au plus un envoi groupé supplémentaire de questions.
- Les contraintes `imposées` ne sont jamais déduites par l'agent : seule l'utilisateur les pose (Tailwind, CA6, est la seule exception, et elle est écrite ici).

## Décisions (ex-questions ouvertes)

1. **Tailwind sur React Native** : NativeWind, au statut `choisie`.
2. **API ou CLI** : Tailwind n'est pas imposé (interfaces seulement).
3. **Version de Tailwind** : dernière version stable à l'initialisation, vérifiée dans Context7.
4. **Runtime applicatif autre que Node** : l'ADR doit prévoir des tests adaptés à ce runtime (ex. Hono : tests via `app.request()`, ou pool de tests du runtime cible si les API spécifiques l'exigent). Le lanceur ajouté est une dépendance à justifier, et `pnpm verify` doit l'enchaîner. Le test de contrat et les scénarios cachés doivent s'exécuter dans ce cadre (CA7).
5. **Ressource de données par workspace** : point d'extension (`scripts/workspace-data.sh`, appelé s'il existe au setup et à l'archivage) prévu, **dans une PR séparée** (PR 3), à rappeler à l'utilisateur une fois les PR 1 et 2 terminées.
6. **Ce document** est conservé dans `docs/factory/` comme trace de décision.

## Découpage proposé

1. PR 1 : CA1 à CA9, CA11 (collecte, ADR, règles, relecteur).
2. PR 2 : CA10, CA12, CA13 (ressource de données par workspace, cache, sécurité).
3. PR 3 (décision 5, **à rappeler à l'utilisateur après les PR 1 et 2**) : point d'extension du setup et de l'archivage Conductor.
