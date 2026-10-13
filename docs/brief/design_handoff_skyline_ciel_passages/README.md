# Handoff : Skyline — Ciel + Prochains passages

## Overview
Skyline est une app mobile **Expo / React Native** qui montre en temps réel l'avion qui survole l'utilisateur. Ce lot couvre les deux seuls écrans validés :
1. **Ciel** — l'avion actuellement au-dessus de l'utilisateur, plein écran aux couleurs de la compagnie.
2. **Prochains passages** — carrousel vertical de cartes géantes (1 carte « En ce moment » si un avion survole + les 10 prochains passages), défilement carte par carte façon Instagram/Reels.

Navigation : swipe horizontal entre les deux pages (Ciel à gauche, Passages à droite). Aucun autre écran, pas de barre d'onglets.

## About the Design Files
Les fichiers de ce dossier sont des **références de design en HTML** (prototype montrant l'apparence et le comportement attendus), **pas du code de production**. La tâche est de **recréer ces écrans dans l'app Expo React Native** avec ses patterns (React Native `View`/`Text`, `react-native-reanimated`, `react-native-gesture-handler`, `FlatList`/`FlashList` avec `pagingEnabled`/`snapToInterval`, `expo-font`, `expo-location`, `expo-sensors` pour la boussole).

Ouvrir `Skyline Prototype.dc.html` dans un navigateur pour voir le prototype (nécessite `support.js`, `data.js`, `StatusBar.dc.html`, `Fin.dc.html` dans le même dossier). La logique (calculs de couleurs, compte à rebours, données d'exemple) est dans le `<script data-dc-script>` en bas du fichier et dans `data.js`.

## Fidelity
**High-fidelity.** Couleurs, typographie, tailles et positions sont finales. Recréer au pixel près sur une base iPhone **393 × 852 pt**. Les positions sont données en absolu dans la maquette ; en RN, utiliser des positions absolues équivalentes ou flex, mais respecter les valeurs.

---

## Règle de couleur (centrale)
- **Fond = couleur primaire de la compagnie**, **texte = couleur secondaire de la compagnie**.
- Le texte est corrigé automatiquement pour le contraste (fonction `fit()` dans `data.js`) :
  - `big` (gros chiffres, ≥ 24 pt) : contraste mini **3:1** contre le fond.
  - `small` (libellés, petit texte) : contraste mini **4,5:1**.
  - Algorithme : si le ratio WCAG est insuffisant, mélanger la couleur secondaire vers blanc ou vers noir par pas de 2 % (max 60 %) jusqu'à atteindre le seuil ; à défaut, crème `#F4F1EA` ou encre `#1D1D1B`, selon le meilleur contraste.
- **Mode nuit** : fond = primaire mélangé à 40 % de noir (`mix(bg, '#000', 0.4)`), puis même règle de contraste.
- `track` (fond de barre de progression) = `mix(bg, small, 0.3)`.

Données compagnies (dans `data.js`, objet `A`) :

| Code | Compagnie | Pays | Primaire | Secondaire |
|---|---|---|---|---|
| ib | Iberia | Espagne | `#C8102E` | `#F6C344` |
| af | Air France | France | `#0B1F4B` | `#F4F1EA` |
| u2 | easyJet | Royaume-Uni | `#FF6600` | `#FFFFFF` |
| lh | Lufthansa | Allemagne | `#0A1D3D` | `#F9B000` |
| kl | KLM | Pays-Bas | `#00A1DE` | `#003145` |
| fr | Ryanair | Irlande | `#073590` | `#F1C933` |
| vy | Vueling | Espagne | `#FFCC00` | `#3C3C3B` |
| tp | TAP Air Portugal | Portugal | `#1E6F4A` | `#F4F1EA` |
| xx | Inconnue / privé | — | `#1D1D1B` | `#F2E8D5` |

Dans l'app, ces couleurs viendront d'une table compagnie (code OACI/IATA → primaire/secondaire/image de dérive).

## Typographie
- Police unique : **Archivo** (Google Fonts, axe variable `wdth` 62–125 et `wght` 400–900). En RN, charger les instances nécessaires avec `expo-font` ; si la largeur variable n'est pas disponible, utiliser **Archivo Narrow / Archivo Condensed ExtraBold** au plus proche de `font-stretch: 62–72 %`.
- Chiffres : `font-variant-numeric: tabular-nums` (RN : `fontVariant: ['tabular-nums']`) pour les comptes à rebours.
- Styles récurrents :
  - **Libellé** : 13 pt, poids 700, couleur `small` (sur le Ciel : couleur `big` à 70 % d'opacité).
  - **Valeur géante** : poids 800, largeur 62–70 %, interligne 0,84–0,95, interlettrage −0,03 à −0,045 em.

---

## Écran 1 — Ciel
Fond plein écran couleur `bg` de la compagnie survolant l'utilisateur. Texte `big`. Tap sur l'écran (dans le prototype) : passer à la compagnie suivante, pour la démo uniquement.

| Élément | Position (pt) | Style |
|---|---|---|
| Barre d'état iOS | haut | couleur `small` |
| Codes aéroport empilés « CDG / MAD » | left 16, top 70 | 140 pt, 800, stretch 72 %, line-height 0,84, letter-spacing −0,04 em |
| Villes « Paris → Madrid » | left 24, top 316 | 22 pt, 700, stretch 85 %, une seule ligne |
| Heures départ / arrivée | left 24, right 24, top 360 ; justifiées aux deux bords | 22 pt, 700, stretch 85 % |
| Barre de progression du vol | sous les heures, +8 pt | hauteur 6, rayon 3, fond `track`, remplissage `big` = % du vol ; **pas de repère rond** |
| Colonne d'infos (alignée à droite) | right 24, top 448, espacement 10 | 6 blocs libellé + valeur : **Vitesse, Altitude, Cap, Compagnie, Vol, Appareil**. Libellé 13 pt / 700 / opacité 0,7 ; valeur 40 pt / 800 / stretch 70 % / line-height 0,95, une seule ligne |
| Image de dérive | collée en bas à gauche, left −260, bottom 0, boîte 521 × 400, `contain`, ancrée en bas à gauche, **dérive orientée vers la gauche** ; sous la colonne d'infos | image réelle de la compagnie si disponible, sinon dérive générique dessinée (`Fin.dc.html`, miroir horizontal, 272 × 399 à left −60) |
| Indicateur d'accueil | bas, 134 × 5, rayon 3 | couleur `small` |

Valeurs d'exemple (Iberia) : IB3457, CDG → MAD, Paris → Madrid, 13:05 → 15:10, progression 18 %, vitesse 780, altitude 7 850, cap SSO, A320neo. Les valeurs s'affichent sans unités sur le Ciel.

## Écran 2 — Prochains passages
Fond de page `#0C0C0C`. **Pas de titre** : la liste occupe tout l'écran.

### Carrousel
- Liste verticale ; **chaque carte mesure 650 pt de haut**, largeur écran − 24 (marges 12), rayon 36, espacement 12 (pas de 662).
- `padding-top` 100, `padding-bottom` 200 ; magnétisme de défilement : **une carte à la fois**, début de carte aligné à 100 pt du haut (`scroll-snap-stop: always`).
- Il reste environ 90 pt de la carte précédente visibles en haut, sous la barre d'état, et environ 90 pt de la suivante en bas.
- RN : `FlatList` avec `snapToInterval={662}`, `decelerationRate="fast"`, `disableIntervalMomentum`, `contentInset`/`contentContainerStyle` paddingTop 100.
- Ordre : la carte **« En ce moment »** (si un avion survole), puis les **10 prochains passages** par heure croissante.
- Chaque carte : fond `bg` de sa compagnie, texte `big` / `small` selon la règle de couleur.

### Carte « prochain passage »
**Haut gauche** (left 18, right 22, top 22, colonne, espacement 10) :
1. Compte à rebours `MM:SS` (« 02:14 ») — 150 pt, 800, stretch 64 %, line-height 0,86, chiffres tabulaires. Se met à jour chaque seconde.
2. Ligne répartie sur toute la largeur (`space-between`), **sans séparateur** :
   - « Passe à » (libellé) / **13:42** — 48 pt, 800, une seule ligne
   - « Regardez » (libellé) / **SO** + flèche — 48 pt, 800. La direction est notée en 8 points cardinaux (N, NE, E, SE, S, SO, O, NO). Flèche pleine de 36 pt, couleur du texte, qui pointe vers le gisement d'arrivée de l'avion.

**Bas droite** (right 22, bottom 22, aligné à droite, espacement 10) :
1. Codes aéroport **empilés** « CDG / MAD » — 64 pt, 800, stretch 64 %, line-height 0,86, letter-spacing −0,04 em, alignés à droite.
2. Villes « Paris → Madrid » — 13 pt, 700, `small`, une seule ligne.
3. Trois colonnes alignées à droite, espacement 14 : **Compagnie / Vol / Appareil**. Libellé 11 pt / 700 / `small` ; valeur 15 pt / 800, une seule ligne.

**Bas gauche** : image de dérive, left −160, bottom 0, boîte 330 × 253, `contain`, ancrée en bas à gauche. Sinon dérive générique, 170 × 249 à left −40, en miroir.

### Carte « En ce moment » (survol en cours)
Même structure, fond de la compagnie qui survole. **Haut gauche** :
1. Libellé « Au-dessus de vous ».
2. « EN CE / MOMENT » sur deux lignes — 104 pt, 800, stretch 64 %, letter-spacing −0,045 em.
3. Jauge de visibilité : hauteur 8, rayon 4, fond `track`, remplissage `big` = temps écoulé / durée de visibilité. Dessous : « Visible encore » et le temps restant `MM:SS` (13 pt / 700 / `small`), aux deux bords.
4. Trois valeurs réparties sur toute la largeur, **sans séparateurs** : **Altitude** (7 850), **Vitesse** (780), **Direction** (SSO + flèche). Libellé 13 pt ; valeur 48 pt / 800, une seule ligne. Ici, la direction est celle vers laquelle l'avion **repart** (son cap).

Bas droite et dérive : identiques aux cartes de passage.

## Navigation et interactions
- **Pages** : bande horizontale de 2 × 393 pt. Glisser à gauche : Passages ; à droite : Ciel. Seuil de 60 pt ; au-delà des bords, résistance ×0,3. Transition `transform` de 380 ms, courbe `cubic-bezier(.2,.8,.2,1)`. Le geste est verrouillé sur un axe après 8 pt de mouvement.
- **Indicateur de page** : 2 traits en haut, top 50, centrés, espacement 5. Trait actif 18 × 4, inactif 6 × 4 à 40 % d'opacité, transition de largeur 300 ms. Couleur `small` de la compagnie sur le Ciel, `#F4F1EA` sur les Passages.
- **Comptes à rebours** : un tick par seconde. À 00:00, la carte devrait devenir « En ce moment » (à implémenter).
- **Boussole** : dans la maquette, nord en haut. **Dans l'app, la flèche doit tourner avec le téléphone** : orientation = gisement de l'avion − cap du téléphone (`expo-location` `watchHeadingAsync` ou `expo-sensors` Magnetometer).

## Données et état
- **Position de l'utilisateur** : `expo-location`.
- **Avions** : API ADS-B (position, altitude, vitesse sol, cap, indicatif, immatriculation, type), plus une API de routes pour l'origine, la destination et les horaires.
- **Avion au-dessus** : distance au sol sous un seuil (par exemple 3 à 5 km) et le plus proche.
- **Prochains passages** : extrapoler la trajectoire des avions dans un rayon d'environ 80 km (position + vitesse + cap), calculer le point de passage au plus près de l'utilisateur, l'heure estimée et le gisement d'arrivée ; garder les 10 premiers. Rafraîchir toutes les 10 s environ.
- **Fenêtre de visibilité** (carte « En ce moment ») : à calculer d'après la vitesse et une distance de visibilité, par exemple ±5 km autour du point le plus proche.
- **État de l'interface** : page (0/1), index de la carte, heure courante (tick 1 s), nuit/jour (selon l'heure solaire locale).

## Design tokens
- Fond de la page Passages : `#0C0C0C` ; encre crème `#F4F1EA`.
- Rayons : téléphone 52, carte 36, barre 3 ou 4.
- Pas du carrousel : carte 650 + espacement 12 = 662 ; padding haut 100.
- Fonctions `mix(a, b, t)`, `ratio()`, `fit(fg, bg, target)` dans `data.js`, à reprendre telles quelles.

## Assets
- **Images de dérive** : pour Iberia et Air France, le prototype charge des images externes fournies par le client (adresses dans `data.js`, objet `IMG`). **Elles contiennent des logos réels** : vérifier les droits, et mettre les fichiers en local dans `assets/tails/<code>.png`, dérive orientée vers la gauche, fond transparent.
- **Dérive générique** (`Fin.dc.html`) : SVG paramétrable (couleur de base, deux bandes, disque) pour les compagnies sans image.
- **Polices** : Google Fonts uniquement.

## Files
- `Skyline Prototype.dc.html` — prototype interactif (Ciel + Passages).
- `data.js` — compagnies, couleurs, données d'exemple, fonctions de contraste.
- `StatusBar.dc.html` — barre d'état iOS (référence visuelle uniquement).
- `Fin.dc.html` — dérive générique en SVG.
- `support.js` — moteur d'affichage du prototype (à ne pas porter).
- `screenshots/` — captures @2x (786 × 1704) :
  - `01-ciel-iberia.png`, `02-ciel-air-france.png` — écran Ciel, deux compagnies
  - `03-passages-en-ce-moment.png` — carte de survol en cours
  - `04-passages-prochain.png`, `05-passages-suivant.png` — cartes de passage (carte précédente visible en haut)
