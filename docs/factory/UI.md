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
Aucun à ce stade. Un composant partagé vit dans `src/shared/` et est listé ici avec son rôle.

## États standard
Aucun à ce stade. Chargement, vide et erreur sont définis par la première spec qui les affiche, puis réutilisés.

## Accessibilité
- Chaque contrôle interactif a un nom accessible (`accessibilityLabel`) et un rôle (`accessibilityRole`).
- Les tests sélectionnent par rôle et par nom, jamais par classe ni par `testID` quand un nom existe.
- Le contraste texte/fond respecte au moins 4,5:1 (`ink` sur `ground` : conforme).
- Cible tactile d'au moins 44 × 44 pt.

## Tests d'interface
<!-- Rempli par T3 (Jest, jest-expo, RNTL). -->
