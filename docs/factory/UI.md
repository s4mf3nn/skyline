# Interface

<!-- Rempli par SPEC-0000 pour une application avec interface (web ou mobile), supprimé par `/init-project` sinon.
Lu par l'agent qui code un écran et par le `reviewer` sur tout diff `.tsx`. Il fixe ce qui doit être identique d'un
écran à l'autre ; les maquettes de chaque spec (`specs/SPEC-XXXX-*/maquettes/`) fixent la disposition. Rester court. -->

## Tokens de style
<!-- Couleurs, typographie, espacements, rayons : noms des tokens Tailwind (ou NativeWind) et leur rôle. Pas de
valeur en dur dans un écran. -->

## Composants de base
<!-- Chemin et rôle de chaque composant partagé (bouton, champ, carte, liste, modale, en-tête). Un écran les réutilise ;
un nouveau composant partagé passe par une tâche dont le périmètre contient ce dossier. -->

## États standard
<!-- Rendu commun des états de la section « Écrans » des specs : chargement, vide, erreur (message et action de
reprise), accès refusé. Un écran les réutilise au lieu de les redessiner. -->

## Accessibilité
<!-- Règles vérifiables sur un diff, par exemple : chaque contrôle a un nom accessible ; les tests sélectionnent par
rôle et par nom, pas par classe ; contraste des tokens de couleur ; cible tactile minimale ; focus visible. -->

## Tests d'interface
<!-- Environnement (ex. jsdom), bibliothèque de rendu, faux des API du navigateur ou de l'appareil (géolocalisation,
caméra, stockage), ce qui part en `tests/e2e/` (gestes, installation, permissions réelles). -->
