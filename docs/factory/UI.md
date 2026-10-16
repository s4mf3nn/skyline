# Interface

Lu par l'agent qui code un écran et par le `reviewer` sur tout diff `.tsx`. Il fixe ce qui doit être identique d'un
écran à l'autre ; les maquettes de chaque spec (`specs/SPEC-XXXX-*/maquettes/`) fixent la disposition.

## Tokens de style
Définis dans `tailwind.config.cjs` (NativeWind 4, Tailwind 3.4). Pas de valeur en dur dans un écran : un nouveau token
du handoff s'ajoute au fichier de configuration et à cette liste.

| Token | Rôle |
|---|---|
| `ground` (`#0C0C0C`) | fond des écrans |
| `ink` (`#F4F1EA`) | texte et éléments principaux |
| `font-archivo` | police unique (Archivo, instance Bold embarquée) |

Les couleurs de compagnie sont calculées à l'exécution et passées en `style` : c'est une donnée, pas un token.
Rayons, mesures et graisses condensées : ajoutés par la spec du thème.

## Composants de base
Un composant partagé vit dans `src/shared/` et est listé ici avec son rôle.
- `Pager` (`src/shared/pager/`) : deux écrans côte à côte, glissement horizontal et indicateur de page réglable (« Indicateur de page », valeur « Page 1 sur 2 »).

## États standard
Définis par SPEC-0008 dans `src/shared/states/` (textes dans `index.ts`, rendu dans `notice.tsx`), à réutiliser tels quels.
- `StateNoticeView` : chargement, localisation refusée (bouton « Ouvrir les réglages »), hors ligne, aucun passage prévu. Fond `ground`, texte `ink`, titre en gros corps, détail en corps courant.
- `StaleNoticeView` : ligne « Données de HH:MM : mise à jour impossible » après trois minutes sans réponse, en petit corps ; `color` permet à Ciel d'y mettre la couleur de la compagnie.

## Accessibilité
- Chaque contrôle interactif a un nom accessible (`accessibilityLabel`) et un rôle (`accessibilityRole`).
- Les tests sélectionnent par rôle et par nom, jamais par classe ni par `testID` quand un nom existe.
- Le contraste texte/fond respecte au moins 4,5:1 (`ink` sur `ground` : conforme).
- Cible tactile d'au moins 44 × 44 pt.

## Tests d'interface
Jest (`jest-expo`) et React Native Testing Library 14 jouent les tests de rendu ; Vitest garde la logique.
- Règle par extension : un `.tsx` de `src/` est du rendu, testé par un `*.native.test.tsx` placé à côté (`pnpm test:render`) ; un `.ts` est de la logique, testée par Vitest. Aucun calcul dans un `.tsx`.
- RNTL 14 : `await render(<App />)` est asynchrone ; les matchers (`toBeOnTheScreen`) sont actifs sans fichier de setup.
- Un écran lit ses services par `useServices()` : le test les fournit par `createApp({ services, features })` avec les faux de `src/shared/`.
- Sélection par rôle et par nom accessible (voir « Accessibilité »), jamais par classe.
