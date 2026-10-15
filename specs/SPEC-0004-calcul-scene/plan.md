# Plan SPEC-0004
Statut : PRÊT

Plan v2 : il ne couvre que l'amendement pour SPEC-0007 (spec, « Amendement (SPEC-0007) »). Le premier plan (T1 à T4 : géométrie, acquisition, calcul, crochet) et l'amendement SPEC-0005 (magasin partagé `store.ts`, `provider.tsx`) sont fusionnés ; leur texte reste dans l'historique git de ce fichier. La numérotation reprend à T5 pour ne pas réutiliser les identifiants de baux et de revues déjà posés.

Constats :
- Seul code manquant : `onBackground` dans `src/shared/lifecycle/` (interface, faux, `app-state.ts`). Les `describe` des deux contrats sont déjà actifs ; restent les deux `it.skip` « CA11 » de `tests/acceptance/SPEC-0004.test.ts` (lignes 510 à 540).
- La clause « ne rafraîchit pas de lui-même » n'a plus de test de contrat. Le test interne `controller.test.ts` « never refreshes by itself every 10 s » reste vrai tant que SPEC-0007 n'a pas posé le minuteur : il est hors de cette tâche et sera réécrit par SPEC-0007, avec le minuteur et la pause dans `controller.ts`.
- `scripts/check-contract.mjs` (dans `pnpm verify` et en CI) ne tolère que le retrait de `describe.skip(` : le retrait de `it.skip(` y est vu comme une modification du contrat, d'où le préalable de T5.

## Groupe 1 (parallèle)
### T5 : AppLifecycle.onBackground et activation des tests CA11
- Périmètre : src/shared/lifecycle/index.ts, src/shared/lifecycle/fake.ts, src/shared/lifecycle/app-state.ts, src/shared/lifecycle/lifecycle.test.ts, tests/acceptance/SPEC-0004.test.ts
- Dépend de : aucune
- Risque : moyen (code partagé `**/shared/`, lu par le crochet de la scène ; une erreur de transition d'`AppState` couperait ou doublerait le rafraîchissement de SPEC-0007)
- Critères de la spec couverts : CA11
- Définition de fini : `pnpm verify` vert. `lifecycle.test.ts` couvre, pour le faux : rien avant `enterBackground`, plusieurs listeners, désabonnement, `enterForeground` n'appelle aucun listener d'arrière-plan et inversement ; pour `app-state.ts` (même `vi.mock("react-native")` qu'aujourd'hui) : listener appelé sur `active → background` et `active → inactive`, pas sur `background → background`, `inactive → background` ni `background → active`, `remove()` au désabonnement ; les tests `onForeground` existants restent verts. **Les deux `it.skip` « CA11 » de `tests/acceptance/SPEC-0004.test.ts` deviennent `it(`** : c'est la seule modification permise du fichier ; tout le contrat SPEC-0004 passe. Préalable : `scripts/check-contract.mjs` (lancé aussi par `pnpm verify`) accepte le retrait de `it.skip(` grâce à une PR `factory` fusionnée avant `/implement` ; sinon la tâche s'arrête et le signale, sans toucher au script (hors périmètre). Aucun changement de `controller.ts`, `services/index.tsx` ni `main.tsx` : `AppServices.lifecycle` et `createAppStateLifecycle()` sont déjà branchés. Bibliothèque : `react-native 0.86.3` (`AppState`), entrée existante de `docs/factory/libs-cache.md`.
- Conception :
  ```diff
   src/shared/lifecycle
  ~├── index.ts          # MODIFIÉ : AppLifecycle + onBackground
  ~├── fake.ts           # MODIFIÉ : second ensemble de listeners, enterBackground()
  ~├── app-state.ts      # MODIFIÉ : onBackground sur la transition active → inactive | background
  ~└── lifecycle.test.ts # MODIFIÉ : cas du faux et d'AppState pour l'arrière-plan
   tests/acceptance
  ~└── SPEC-0004.test.ts # MODIFIÉ : deux it.skip → it (rien d'autre)
  ```
  ```ts
  interface AppLifecycle {
    onForeground(listener: () => void): () => void
    onBackground(listener: () => void): () => void
  }
  createFakeLifecycle(): AppLifecycle & { enterForeground(): void; enterBackground(): void }
  createAppStateLifecycle(): AppLifecycle   // un abonnement AppState par listener, état précédent gardé
  ```
  ```diff
   main.tsx → createAppStateLifecycle()
     onForeground(l) → AppState.addEventListener("change") ; previous ∈ {inactive, background} et next = active → l()
  +  onBackground(l) → AppState.addEventListener("change") ; previous = active et next ∈ {inactive, background} → l()
   (SPEC-0007) createSceneController → lifecycle?.onBackground(pause)   # consommateur futur, hors de cette tâche
  ```
  Ordre de construction :
  1. `onBackground` dans l'interface et le faux, `it.skip` retirés en local : les deux tests CA11 du contrat Vitest passent ; `pnpm typecheck` vert (le contrôleur ne l'appelle pas encore).
  2. `app-state.ts` : transition vers l'arrière-plan, sur le même motif que `onForeground` (fonction de transition partagée seulement si elle reste plus lisible que deux conditions). Vérifié par `lifecycle.test.ts`, puis sur simulateur : passage en arrière-plan, un appel par passage (journal temporaire non commité).
  3. `pnpm verify` complet, contrats SPEC-0000, SPEC-0003, SPEC-0004 et SPEC-0005 verts.
  Scénarios de changement :
  - Pause et reprise du rafraîchissement (SPEC-0007) : `src/shared/scene/controller.ts` et son test seulement ; `lifecycle/` inchangé.
  - L'état `inactive` (centre de contrôle, appel entrant) ne doit plus compter comme arrière-plan : `app-state.ts` seul (les deux conditions de transition).
  - Second événement de cycle de vie (mémoire basse, par exemple) : une méthode de plus dans `index.ts`, `fake.ts`, `app-state.ts`. Trois fichiers du même service, accepté : c'est une capacité nouvelle, pas une règle dispersée.
