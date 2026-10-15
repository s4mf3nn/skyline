# CLAUDE.md : skyline

Ce fichier est lu par chaque agent au démarrage de chaque workspace Conductor. Il décrit le projet, les conventions et les règles de la software factory. Il doit rester court : les détails vivent dans `docs/`.

## Le projet

Skyline est une application mobile Expo (iOS et Android) qui dit en une seconde quel avion passe au-dessus de toi et lesquels vont passer ensuite. La v0 se limite à deux écrans, Ciel et Prochains passages, sans backend ni compte. Le cahier des charges et le handoff de design font foi : `docs/brief/` (les fichiers HTML y sont des références, jamais embarqués dans l'application).
Le type d'application (API, web, mobile, CLI…), la stack et leurs raisons sont décrits dans `docs/adr/0001-stack.md`.

## Commandes

- `pnpm dev` : lance l'application en local selon la stack (serveur, bundler, simulateur) ; si elle écoute sur un port, c'est `$PORT` (Conductor fournit `$CONDUCTOR_PORT`), puis `$PORT+1`... pour les serveurs suivants, jamais un port en dur
- `pnpm test` : tests unitaires et d'acceptation
- `pnpm verify` : typage, lint, tests avec couverture et contrôle de contrat. **Doit être vert avant de rendre la main.**
- `pnpm gen` : régénère les fichiers `*.gen.ts` (ne jamais les éditer à la main)
- `/roadmap`, `/new-spec`, `/plan`, `/implement`, `/fix`, `/review`, `/ship`, `/resolve`, `/land`, `/retro`, `/learn` : commandes de la factory (`.claude/commands/`)

## Règles de la factory (non négociables)

1. **On ne code jamais sans spec.** Toute tâche référence une spec `specs/SPEC-XXXX-*/spec.md` et une tâche de son `plan.md`. Sans spec, propose `/new-spec`. Un correctif de bug (`/fix`) référence la spec existante et une issue `bug`, sans tâche de plan, avec le test qui reproduit le bug ; si la spec est fausse ou muette, on l'amende d'abord. Exception : outillage du boilerplate (`scripts/`, `.claude/`, `.github/`, `docs/factory/`, config), traité par `/ship` en mode hors spec (scope `factory`, voir `docs/factory/WORKFLOW.md`) ; les autres règles restent applicables.
2. **Périmètre déclaré.** Chaque tâche liste les chemins qu'elle a le droit de modifier. Si tu dois toucher un fichier hors périmètre, tu t'arrêtes et tu le signales au lieu de le faire.
3. **Bail.** Au démarrage d'une tâche, pose un bail sur ton périmètre avec `node scripts/lease.mjs acquire <TASK_ID> <chemins...>`. Si l'acquisition échoue, un autre agent travaille sur ces fichiers : tu t'arrêtes et tu le signales.
4. **Tests de contrat immuables.** Les fichiers `tests/acceptance/*.test.ts` sont écrits et validés par l'humain dans la PR de spec. Tu as seulement le droit de retirer `.skip` sur le `describe` de ta spec. Toute autre modification est bloquée par la CI (`scripts/check-contract.mjs`). Les scénarios cachés (`tests/holdout/`) sont retirés de ton workspace par `/implement` : tu ne les lis pas, tu ne les modifies pas et tu ne cherches pas à les obtenir autrement.
5. **Condition de sortie.** Tu ne rends la main que lorsque `pnpm verify` est vert, que la revue locale (`/review`, subagent `reviewer`, ou `spec-reviewer` pour une PR de spec) est `OK` sur le dernier état du code, et que tu as rédigé le résumé de PR au format de `.github/pull_request_template.md`. Le hook `pre-push` refuse un push sans revue à jour.
6. **Petit et jetable.** Si la tâche dépasse ton contexte ou que tu tournes en rond, arrête-toi et propose un redécoupage plutôt que de forcer.
7. **Pas de nouvelle dépendance** sans la mentionner explicitement dans le résumé de PR avec sa justification. Une technologie `imposée` ou `choisie` du tableau de `docs/adr/0001-stack.md` est pré-autorisée : la justification est « ADR-0001 ». Une technologie `imposée` ne se remplace jamais sans nouvelle ADR.
8. **Pas de contournement des contrôles.** Jamais de `--no-verify`, jamais de `node scripts/review-gate.mjs waive` (réservé à l'humain). Si le relecteur n'est pas `OK` après 3 passages, tu t'arrêtes et tu proposes un redécoupage.

## Conventions de code

Détail et exemples : `docs/factory/CONVENTIONS.md` (à lire avant d'écrire du code dans `src/`). Les points que les contrôles par script refusent :

- TypeScript strict : pas de `any`, de `@ts-ignore`, de `@ts-expect-error` ni de désactivation de règle Biome dans `src/`.
- Organisation par feature (`src/features/<feature>/`, entrée `index.ts`, tests à côté) ; une feature n'importe que ses fichiers, `src/shared/` et l'`index.ts` d'une autre feature.
- Aucun registre central édité à la main : `src/features.gen.ts` vient de `pnpm gen`.
- Erreurs métier typées (`src/shared/errors.ts`), jamais de `throw new Error` brut, jamais d'horloge directe (`Date.now()`, `new Date()`) ; services tiers et API d'appareil derrière une interface avec un faux.
- Langues : commentaires en français ; identifiants, erreurs, noms de tests et logs en anglais ; commits et titre de PR en Conventional Commits avec la spec en scope (`feat(spec-0001): <description en français>`).
- Lisibilité d'abord : fonctions courtes, pas de code « malin », pas d'abstraction avant la troisième répétition.

## Sécurité propre au domaine

La position de l'utilisateur ne quitte l'appareil que pour interroger la source ADS-B, n'est jamais loggée ni envoyée au suivi des erreurs, et aucune image de compagnie n'est embarquée sans autorisation consignée : les zones `src/shared/location/`, `src/shared/adsb/`, `src/shared/monitoring/`, `assets/tails/` et les fichiers de livraison (`app.json`, `app.config.*`, `eas.json`) déclenchent la lecture du détail.
Détail et zones à risque élevé : `docs/factory/DOMAIN-SECURITY.md` (à lire avant toute tâche sur une entrée utilisateur, une écriture exposée (route, formulaire, commande) ou une zone à risque élevé) et `docs/factory/RISK.md`.

## Questions à l'humain

Dès qu'une réponse contient une ou plusieurs questions pour l'humain, pose-les avec l'outil de questions interactif (`AskUserQuestion` sous Claude Code), pas en texte libre : une question par entrée, 2 à 4 options concrètes avec ta recommandation en premier, 6 questions au plus par réponse (l'outil en prend 4 par appel : au-delà, enchaîne un second appel). L'humain garde toujours la réponse libre (« Other », ajoutée par l'outil) si aucune option ne convient : n'ajoute pas d'option « Autre » et ne force jamais un choix. Les réponses restent ainsi regroupées et retrouvables dans la conversation. Seule exception : une question purement rhétorique ou qui n'attend pas de réponse. Si l'outil n'existe pas dans l'outil d'agent utilisé, pose les questions en liste numérotée. Le hook `scripts/ask-questions.mjs` refuse une réponse finale qui pose une question en texte libre.

## Contexte à charger

Ne lis que ce dont la tâche a besoin : ce fichier, la spec, le plan, les fichiers de ton périmètre, et au besoin `docs/adr/` et `docs/DOMAIN.md` (vocabulaire, invariants, cycles de vie).

## Documentation des bibliothèques (Context7)

Avant d'écrire ou de relire du code qui utilise une API de bibliothèque, applique `docs/factory/CONTEXT7.md` : cache `docs/factory/libs-cache.md` d'abord, code existant ensuite, Context7 (version épinglée) seulement pour ce qui est nouveau. Pas de Context7 pour la logique métier. Liste les bibliothèques consultées (et `(cache)` le cas échéant) dans le résumé de PR ; si Context7 est indisponible, dis-le dans le résumé.

## Sobriété en tokens

Règles courtes ; détail et raisons dans `docs/factory/TOKENS.md`. Le coût vient du nombre de tours et du contexte relu à chaque tour.

- Pour une tâche, lis `node scripts/split-plan.mjs task <SPEC-XXXX> <T#>` et pas `plan.md` ni `spec.md` en entier. Pas de `cat` de `docs/DOMAIN.md`, `docs/PRODUCT.md`, `docs/adr/*` ni d'un fichier de plus de 150 lignes : `grep -n` puis `Read` avec `offset`/`limit`.
- Une commande par appel Bash : pas de chaîne `cmd && cat X && cat Y`, pas de `ls`/`cat` de rattrapage après un script. Lis ce dont tu as besoin, pas ce qui est à côté.
- `git diff --stat` d'abord, puis le diff des seuls fichiers utiles.
- Pendant la boucle de développement, lance les tests et le typage ciblés ; `pnpm verify:quiet` seulement avant de commiter.
- Fais les lectures et commandes indépendantes en parallèle (et les `Edit` indépendants dans un même tour) ; ne relis pas un fichier que tu viens d'éditer.
- Garde-fou : au-delà d'environ 25 tours sur une commande sans progrès, ou si le contexte dépasse ~120 k, arrête-toi et propose un redécoupage (règle 6). Entre deux commandes de la factory (`/implement` puis `/ship`, `/fix` puis `/ship`), `/clear` est recommandé : l'état utile est dans `.pr-summary.md` et `.context/`.

## Règles apprises

Les règles issues de la boucle d'amélioration sont consignées dans `docs/factory/LEARNINGS.md`. Lis la section « Règles actives » avant de coder.
