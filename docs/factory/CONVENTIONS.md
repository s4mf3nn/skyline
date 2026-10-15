# Conventions de code (détail)

Détail de la section « Conventions de code » de `CLAUDE.md`, lu à la demande : avant d'écrire du code dans `src/`, ou quand `pre-review.mjs check` signale une violation.

<!-- À ajuster après l'ADR-0001 : garder ce qui s'applique à la stack retenue. -->
- TypeScript strict, pas de `any`, pas de `// @ts-ignore` ni de `// @ts-expect-error`, pas de désactivation de règle Biome (`scripts/pre-review.mjs check` les refuse dans `src/`).
- Organisation **par feature** : `src/features/<feature>/` avec son point d'entrée `index.ts` et les tests à côté (`*.test.ts`, `*.test.tsx`). Le découpage interne d'une feature dépend du type d'application et est fixé par l'ADR-0001 (ex. API : `{routes,service,repo,schema}.ts` ; web ou mobile : `{screens,components,hooks,service}` ; CLI : `{command,service}.ts`).
- **Frontières entre features** : une feature n'importe que ses propres fichiers, `src/shared/` et le point d'entrée public (`index.ts`) d'une autre feature, jamais l'un de ses fichiers internes. `scripts/pre-review.mjs check` le contrôle ; ce qui doit être partagé monte dans `src/shared/` ou dans l'`index.ts` de la feature qui le possède.
- **Aucun registre central édité à la main.** Chaque feature exporte `feature` depuis son `index.ts` ; `src/features.gen.ts` est généré par `pnpm gen`. C'est ce qui évite les conflits entre agents.
- Validation des entrées à la frontière (requête HTTP, formulaire, deep link, argument de CLI, message), jamais plus loin.
- Ce que les tests ne peuvent pas appeler pour de vrai (service tiers, API du navigateur ou de l'appareil, horloge, réseau) passe par une interface avec un faux, injecté par les tests (voir le guide, « Services tiers, horloge et faux »).
- Erreurs métier typées (`src/shared/errors.ts`), jamais de `throw new Error("...")` brut dans une feature, ni d'horloge directe (`Date.now()`, `new Date()`) : `pre-review.mjs check` aussi.
- Si le projet a une persistance : migrations préfixées par timestamp, une migration par tâche au maximum.
- **Langues** : commentaires en français ; messages d'erreur, codes d'erreur (`NOT_FOUND`), identifiants (variables, fonctions, types), noms de tests (`describe` / `it`) et messages de log en anglais. Commits et titre de PR : type et scope Conventional Commits inchangés, description en français. Sorties CLI des scripts : en français. Ces règles valent pour le code nouveau ou modifié ; le code existant n'est pas réécrit pour elles.
- **Lisibilité humaine d'abord** : fonctions courtes qui font une seule chose, noms explicites, abstractions simples. Pas d'astuce, pas de code « malin » (chaînes d'opérateurs denses, métaprogrammation, génériques complexes, one-liners obscurs), pas d'abstraction anticipée : on factorise à partir de la troisième répétition. Les commentaires expliquent le *pourquoi*, pas le *comment*. En cas de doute entre court et clair, choisis clair.
- Commits et titre de PR en Conventional Commits avec la spec en scope : `feat(spec-0001): <description>` (`fix(spec-0001): <description>` pour un correctif de bug).

