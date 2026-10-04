# CLAUDE.md : {{PROJECT_NAME}}

Ce fichier est lu par chaque agent au démarrage de chaque workspace Conductor. Il décrit le projet, les conventions et les règles de la software factory. Il doit rester court : les détails vivent dans `docs/`.

## Le projet

<!-- À compléter : deux ou trois phrases sur ce que fait le produit et pour qui. -->
Le type d'application (API, web, mobile, CLI…), la stack et leurs raisons sont décrits dans `docs/adr/0001-stack.md`.

## Commandes

- `pnpm dev` : lance l'application en local selon la stack (serveur, bundler, simulateur) ; si elle écoute sur un port, c'est `$PORT` (Conductor fournit `$CONDUCTOR_PORT`), puis `$PORT+1`... pour les serveurs suivants, jamais un port en dur
- `pnpm test` : tests unitaires et d'acceptation
- `pnpm verify` : typage, lint, tests avec couverture et contrôle de contrat. **Doit être vert avant de rendre la main.**
- `pnpm gen` : régénère les fichiers `*.gen.ts` (ne jamais les éditer à la main)
- `/roadmap`, `/new-spec`, `/plan`, `/implement`, `/fix`, `/review`, `/ship`, `/resolve`, `/land`, `/retro`, `/learn` : commandes de la factory (`.claude/commands/`)

## Règles de la factory (non négociables)

1. **On ne code jamais sans spec.** Toute tâche référence une spec `specs/SPEC-XXXX-*/spec.md` et une tâche de son `plan.md`. Si on te demande de coder sans spec, propose d'abord `/new-spec`. Un correctif de bug (`/fix`) référence la spec existante et une issue `bug`, sans tâche de plan : il rétablit ce que la spec dit déjà et apporte le test qui reproduit le bug ; si c'est la spec qui est fausse ou muette, on l'amende d'abord (`/new-spec`). Autre exception : une amélioration du boilerplate ou de l'outillage (`scripts/`, `.claude/`, `.github/`, `docs/factory/`, config) n'a pas de spec ; `/ship` la traite en mode hors spec (scope `factory`, voir `docs/factory/WORKFLOW.md`). Les autres règles (vérification, revue locale, pas de contournement) restent applicables.
2. **Périmètre déclaré.** Chaque tâche liste les chemins qu'elle a le droit de modifier. Si tu dois toucher un fichier hors périmètre, tu t'arrêtes et tu le signales au lieu de le faire.
3. **Bail.** Au démarrage d'une tâche, pose un bail sur ton périmètre avec `node scripts/lease.mjs acquire <TASK_ID> <chemins...>`. Si l'acquisition échoue, un autre agent travaille sur ces fichiers : tu t'arrêtes et tu le signales.
4. **Tests de contrat immuables.** Les fichiers `tests/acceptance/*.test.ts` sont écrits et validés par l'humain dans la PR de spec. Tu as seulement le droit de retirer `.skip` sur le `describe` de ta spec. Toute autre modification est bloquée par la CI (`scripts/check-contract.mjs`). Les scénarios cachés (`tests/holdout/`) sont retirés de ton workspace par `/implement` : tu ne les lis pas, tu ne les modifies pas et tu ne cherches pas à les obtenir autrement.
5. **Condition de sortie.** Tu ne rends la main que lorsque `pnpm verify` est vert, que la revue locale (`/review`, subagent `reviewer`, ou `spec-reviewer` pour une PR de spec) est `OK` sur le dernier état du code, et que tu as rédigé le résumé de PR au format de `.github/pull_request_template.md`. Le hook `pre-push` refuse un push sans revue à jour.
6. **Petit et jetable.** Si la tâche dépasse ton contexte ou que tu tournes en rond, arrête-toi et propose un redécoupage plutôt que de forcer.
7. **Pas de nouvelle dépendance** sans la mentionner explicitement dans le résumé de PR avec sa justification. Une technologie `imposée` ou `choisie` du tableau de `docs/adr/0001-stack.md` est pré-autorisée : la justification est « ADR-0001 ». Une technologie `imposée` ne se remplace jamais sans nouvelle ADR.
8. **Pas de contournement des contrôles.** Jamais de `--no-verify`, jamais de `node scripts/review-gate.mjs waive` (réservé à l'humain). Si le relecteur n'est pas `OK` après 3 passages, tu t'arrêtes et tu proposes un redécoupage.

## Conventions de code

<!-- À ajuster après l'ADR-0001 : garder ce qui s'applique à la stack retenue. -->
- TypeScript strict, pas de `any`, pas de `// @ts-ignore`, pas de désactivation de règle Biome.
- Organisation **par feature** : `src/features/<feature>/` avec son point d'entrée `index.ts` et les tests à côté (`*.test.ts`, `*.test.tsx`). Le découpage interne d'une feature dépend du type d'application et est fixé par l'ADR-0001 (ex. API : `{routes,service,repo,schema}.ts` ; web ou mobile : `{screens,components,hooks,service}` ; CLI : `{command,service}.ts`).
- **Frontières entre features** : une feature n'importe que ses propres fichiers, `src/shared/` et le point d'entrée public (`index.ts`) d'une autre feature, jamais l'un de ses fichiers internes. `scripts/pre-review.mjs check` le contrôle ; ce qui doit être partagé monte dans `src/shared/` ou dans l'`index.ts` de la feature qui le possède.
- **Aucun registre central édité à la main.** Chaque feature exporte `feature` depuis son `index.ts` ; `src/features.gen.ts` est généré par `pnpm gen`. C'est ce qui évite les conflits entre agents.
- Validation des entrées à la frontière (requête HTTP, formulaire, deep link, argument de CLI, message), jamais plus loin.
- Ce que les tests ne peuvent pas appeler pour de vrai (service tiers, API du navigateur ou de l'appareil, horloge, réseau) passe par une interface avec un faux, injecté par les tests (voir le guide, « Services tiers, horloge et faux »).
- Erreurs métier typées (`src/shared/errors.ts`), jamais de `throw new Error("...")` brut dans un point d'entrée (route, écran, commande).
- Si le projet a une persistance : migrations préfixées par timestamp, une migration par tâche au maximum.
- **Langues** : commentaires en français ; messages d'erreur, codes d'erreur (`NOT_FOUND`), identifiants (variables, fonctions, types), noms de tests (`describe` / `it`) et messages de log en anglais. Commits et titre de PR : type et scope Conventional Commits inchangés, description en français. Sorties CLI des scripts : en français. Ces règles valent pour le code nouveau ou modifié ; le code existant n'est pas réécrit pour elles.
- **Lisibilité humaine d'abord** : fonctions courtes qui font une seule chose, noms explicites, abstractions simples. Pas d'astuce, pas de code « malin » (chaînes d'opérateurs denses, métaprogrammation, génériques complexes, one-liners obscurs), pas d'abstraction anticipée : on factorise à partir de la troisième répétition. Les commentaires expliquent le *pourquoi*, pas le *comment*. En cas de doute entre court et clair, choisis clair.
- Commits et titre de PR en Conventional Commits avec la spec en scope : `feat(spec-0001): <description>` (`fix(spec-0001): <description>` pour un correctif de bug).

## Sécurité propre au domaine

<!-- À compléter : une phrase qui résume les règles et nomme les zones qui déclenchent la lecture du détail. -->
Détail et zones à risque élevé : `docs/factory/DOMAIN-SECURITY.md` (à lire avant toute tâche sur une entrée utilisateur, une écriture exposée (route, formulaire, commande) ou une zone à risque élevé) et `docs/factory/RISK.md`.

## Contexte à charger

Ne lis que ce dont la tâche a besoin : ce fichier, la spec, le plan, les fichiers de ton périmètre, et au besoin `docs/adr/` et `docs/DOMAIN.md` (vocabulaire, invariants, cycles de vie).

## Documentation des bibliothèques (Context7)

Avant d'écrire ou de relire du code qui utilise une API de bibliothèque, applique `docs/factory/CONTEXT7.md` : cache `docs/factory/libs-cache.md` d'abord, code existant ensuite, Context7 (version épinglée) seulement pour ce qui est nouveau. Pas de Context7 pour la logique métier. Liste les bibliothèques consultées (et `(cache)` le cas échéant) dans le résumé de PR ; si Context7 est indisponible, dis-le dans le résumé.

## Sobriété en tokens

Règles courtes ; détail et raisons dans `docs/factory/TOKENS.md`.

- Pour une tâche, lis `node scripts/split-plan.mjs task <SPEC-XXXX> <T#>` et pas `plan.md` ni `spec.md` en entier.
- Pendant la boucle de développement, lance les tests et le typage ciblés ; `pnpm verify:quiet` seulement avant de commiter.
- Fais les lectures et commandes indépendantes en parallèle, et ne relis pas un fichier que tu viens d'éditer.

## Règles apprises

Les règles issues de la boucle d'amélioration sont consignées dans `docs/factory/LEARNINGS.md`. Lis la section « Règles actives » avant de coder.
