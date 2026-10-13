# SPEC-0003 : Pager à deux pages

Statut : BROUILLON
Risque estimé : moyen (code partagé `src/shared/`, modifie la fabrique `createApp` du socle ; aucune entrée utilisateur ni zone sensible)
Dépend de : SPEC-0000
Tests de contrat : `tests/acceptance/SPEC-0003.test.ts` (Vitest), `tests/acceptance/SPEC-0003.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0003.test.ts` et `tests/holdout/SPEC-0003.native.test.tsx` (ne pas les décrire ici)

## Objectif
L'observateur passe de Ciel à Prochains passages, et inversement, par un simple glissement horizontal, sans barre d'onglets ni menu. Un indicateur à deux traits montre la page active, et l'application s'ouvre sur Ciel. Les deux pages sont les deux premières features du registre généré, jamais une liste écrite à la main.

## Acteurs et rôles
Aucun rôle (un seul rôle, l'observateur, sans compte ; `docs/PRODUCT.md`).

## Critères d'acceptation
Le module vit dans `src/shared/pager/` : il est monté par `createApp` et lu par deux features (Ciel, Passages), il ne peut donc pas appartenir à l'une d'elles ni être une feature (décision du propriétaire du 2026-10-13). La logique est pure (`src/shared/pager/index.ts`), le rendu est un `.tsx` à côté.

Logique (Vitest) :
- **CA1** : `PAGER_METRICS` fixe les valeurs du handoff : seuil de 60 pt, résistance ×0,3, verrouillage d'axe à 8 pt, transition de page de 380 ms avec la courbe `cubic-bezier(.2, .8, .2, 1)`, transition de l'indicateur de 300 ms.
- **CA2** : `lockAxis(dx, dy)` rend `null` tant que le mouvement est inférieur à 8 pt sur les deux axes (`max(|dx|, |dy|) < 8`) ; dès 8 pt (inclus) il rend `"horizontal"` si `|dx| > |dy|`, sinon `"vertical"` (égalité comprise : le défilement vertical d'une page n'est jamais capté par le pager).
- **CA3** : `draggedOffset(page, dx)` rend le déplacement appliqué à la bande pendant un glissement de `dx` pt depuis `page` : `dx` tel quel vers une page qui existe, `dx × 0,3` au-delà des bords (glissement vers la droite depuis Ciel, vers la gauche depuis Passages).
- **CA4** : `settlePage(page, dx)` rend la page de repos au relâchement d'un glissement de `dx` pt (valeur brute, avant résistance) : depuis Ciel (page 0), `dx <= -60` rend 1 ; depuis Passages (page 1), `dx >= 60` rend 0 ; tout autre cas rend `page`. Seule la distance compte, jamais la vitesse du geste.
- **CA5** : `indicatorTraits(page)` rend les deux traits de l'indicateur : celui de la page active mesure 18 × 4 à pleine opacité, l'autre 6 × 4 à 40 % d'opacité.
- **CA6** : `selectPages(features)` rend les deux features de plus petit `order`, triées par `order` croissant (à `order` égal, dans l'ordre de la liste reçue), ou toutes celles qu'il y a s'il y en a moins de deux. Il ne modifie pas la liste reçue.

Rendu (Jest, par `createApp`) :
- **CA7** : avec au moins deux features, l'application rend le pager : les écrans des deux premières features (CA6) sont montés dans la bande, de gauche à droite par `order` croissant, quel que soit l'ordre du registre ; l'application s'ouvre sur la première page (Ciel). Une troisième feature n'est pas montée.
- **CA8** : avec une seule feature, l'application rend son écran seul, sans pager ni indicateur ; sans feature, l'écran d'accueil « Skyline » (SPEC-0000 CA1 et CA3 inchangés).
- **CA9** : le pager est un élément réglable (`accessibilityRole="adjustable"`) de nom « Pages » dont la valeur accessible est « Page 1 sur 2 » ou « Page 2 sur 2 ». Ses actions d'accessibilité `increment` et `decrement` passent à la page suivante ou précédente ; sur la dernière page `increment`, sur la première `decrement`, ne changent rien.
- **CA10** : l'indicateur est un élément de nom « Indicateur de page » avec deux traits (`testID` `pager-indicator-trait-0` et `pager-indicator-trait-1`, éléments sans nom propre) ; leur couleur de fond est l'accent de la page active. L'accent d'une page est la couleur crème `#F4F1EA`, ou celle que la page déclare par `usePagerAccent(color)` (l'écran Ciel y passera le `small` de la compagnie, SPEC-0005). Le trait de la page active prend l'accent de cette page, y compris quand la page change de couleur pendant qu'elle est affichée ; `usePagerAccent(null)` revient au crème ; hors pager (une seule feature), le hook est sans effet et ne lève pas.

## Cas limites
- Glissement vers l'extérieur depuis la première ou la dernière page : résistance ×0,3, retour à la page d'origine au relâchement quelle que soit la distance (CA3, CA4).
- Glissement de 59,9 pt : la page ne change pas ; de 60 pt pile : elle change (CA4).
- Glissement oblique : verrouillé sur l'axe dominant à 8 pt (CA2) ; une fois verrouillé, l'axe ne change plus jusqu'au relâchement (règle du handoff, jouée par le rendu, hors contrat).
- Glissement lent ou rapide de même distance : même résultat (pas de seuil de vitesse).
- Registre vide, ou une seule feature : jamais de pager (CA8).
- Registre de plus de deux features : les features d'`order` plus grand sont ignorées sans erreur (CA6, CA7) ; l'extension du pager au MVP est tranchée par un nouveau cadrage (`docs/brief/cahier-des-charges-v0.md`, section 10).
- Deux features de même `order` : ordre du registre (CA6).
- Page courante : état en mémoire seulement, jamais persisté ; l'application s'ouvre toujours sur Ciel. Un retour au premier plan garde la page affichée.
- Les deux écrans restent montés pendant toute la session : changer de page ne les démonte pas (leur état et leurs comptes à rebours continuent).

## Contrat d'interface
Point d'entrée : `src/shared/pager/index.ts` (logique pure ; le seul import non natif autorisé est `react`, pour le hook d'accent).

```ts
type PageIndex = 0 | 1                        // 0 = Ciel, 1 = Prochains passages
interface PagerMetrics {
  swipeThresholdPt: number                    // 60
  edgeResistance: number                      // 0.3
  axisLockPt: number                          // 8
  transitionMs: number                        // 380
  easing: readonly [number, number, number, number]   // [0.2, 0.8, 0.2, 1]
  indicatorTransitionMs: number               // 300
}
interface IndicatorTrait { width: number; height: number; opacity: number }

PAGER_METRICS: PagerMetrics
lockAxis(dx: number, dy: number): "horizontal" | "vertical" | null
draggedOffset(page: PageIndex, dx: number): number
settlePage(page: PageIndex, dx: number): PageIndex
indicatorTraits(page: PageIndex): readonly [IndicatorTrait, IndicatorTrait]
selectPages(features: readonly Feature[]): readonly Feature[]    // `Feature` de src/shared/feature.ts
usePagerAccent(color: string | null): void    // hook React, appelé par l'écran d'une page ; `#RRGGBB`
```

`createApp` (src/app.tsx) garde sa signature (SPEC-0000). Il monte `Pager` (`src/shared/pager/pager.tsx`, dessiné avec `react-native-reanimated` et `react-native-gesture-handler`, ADR-0001) sur `selectPages(features ?? registry)` à la place de `pickScreen` : zéro feature, l'écran d'accueil ; une feature, son écran seul ; deux, le pager. Le pager lit les features qu'il reçoit : le registre généré est la seule source de pages. `pickScreen` et son test sont retirés s'ils ne servent plus (hors contrat : ce sont des fichiers de `src/`).

## Écrans
Pas de maquette dédiée (décision du propriétaire du 2026-10-13) : le handoff fait foi (`docs/brief/design_handoff_skyline_ciel_passages/README.md`, section « Navigation et interactions », et captures 02 à 05). Le pager n'a pas d'écran propre, il porte les deux pages.
- **Bande de pages** : 2 × la largeur de l'écran (393 pt dans le handoff), transition `transform` de 380 ms, courbe `cubic-bezier(.2, .8, .2, 1)`. Glisser vers la gauche : Passages ; vers la droite : Ciel. Aucun état de chargement, vide ou d'erreur : ceux des pages relèvent de leurs specs.
- **Indicateur de page** : deux traits en haut, `top` 50, centrés, espacement 5. Trait actif 18 × 4, inactif 6 × 4 à 40 % d'opacité, transition de largeur de 300 ms. Couleur : `small` de la compagnie sur Ciel, crème `#F4F1EA` sur Passages (CA10). Sans nom propre pour les traits ; l'ensemble porte le nom « Indicateur de page » et la valeur de page.
- **Actions** : glissement horizontal (seuil, résistance et verrouillage d'axe : CA2 à CA4) ; actions d'accessibilité `increment` et `decrement` (CA9). Aucune autre action, pas de bouton.

## Parcours sur cible réelle
- Sur simulateur iPhone, le glissement à la main change de page avec la transition du handoff, résiste au bord et laisse le défilement vertical de la page à la page. Vérifié à la main dans la PR de la dernière tâche (capture jointe) : le geste lui-même (Gesture Handler) n'est pas joué sous Jest, pas de test automatisé sur simulateur en v0.

## Hors périmètre
- Contenu des pages : écrans Ciel (SPEC-0005) et Prochains passages (SPEC-0006) ; une page de test suffit ici.
- Transition de couleur d'une compagnie à l'autre sur Ciel ; déclarer l'accent de la compagnie par `usePagerAccent` (SPEC-0005).
- Troisième page, barre d'onglets, liens profonds par page, mode nuit.
- Geste de lancer (vitesse) : seule la distance compte, comme dans le handoff.
- Persistance de la page entre deux lancements.

## Contraintes
- Aucune dépendance nouvelle : Reanimated et Gesture Handler sont dans l'ADR-0001 (« Pager horizontal à deux pages »). Le geste et l'animation tournent sur le fil d'interface (worklets) ; les calculs de seuil et de résistance appellent les fonctions pures du module, jamais une copie.
- Le pager se rend sous `jest-expo` : le réglage de test de Reanimated et de Gesture Handler (`jest.config.cjs`, fichier de mise en place) fait partie de la tâche.
- Aucun calcul dans un `.tsx` (règle par extension de `docs/factory/UI.md`) ; pas de valeur de couleur ou de mesure en dur hors de `PAGER_METRICS` et des tokens de style.
- Chaque contrôle interactif a un nom accessible (`docs/factory/UI.md`) : l'indicateur et le pager en ont un (CA9, CA10).

## Questions ouvertes
Décisions de rédaction à confirmer à la lecture de la PR (le handoff ne les tranche pas) :
- « Après 8 pt » et « seuil de 60 pt » s'entendent bornes incluses (`>= 8`, `>= 60`) ; à égalité d'axe (`|dx| = |dy|`), le geste est vertical (CA2).
- Les deux écrans restent montés en permanence (bande de 2 × la largeur) : les comptes à rebours de Passages tournent aussi quand Ciel est affiché.
- Au-delà de deux features, les suivantes sont ignorées en silence plutôt que refusées.
