# Skyline - Cahier des charges v0

Oct 13, 2026 · @Sam Fenn

Ce document reprend le cahier des charges complet de Skyline, affiné par les choix de la v0. Les sections 1 à 6 décrivent la v0 à coder maintenant ; les sections 7 à 15 décrivent le produit cible et la façon dont la v0 s'y inscrit. La spec complète du 11 octobre reste disponible telle quelle dans son propre document.

## 1. Objectif et périmètre

La v0 réduit Skyline à deux écrans, l'avion qui passe au-dessus de toi et les prochains avions qui vont passer, pour valider le cœur de l'expérience avant d'y remettre la collection, les alertes et les widgets décrits dans la spec complète.

**Référence de design.** Le dossier `design_handoff_skyline_ciel_passages/` fait foi : son `README.md` donne les mesures, couleurs, typographies et interactions, les captures du dossier `screenshots/` montrent le rendu attendu, et `Skyline Prototype.dc.html` avec `data.js` contiennent la logique de référence (`fit()`, `mix()`, comptes à rebours, calcul des directions). Ces fichiers HTML servent de référence uniquement : ils sont recréés en React Native, jamais embarqués dans l'app. Aucune valeur de design du README ne change sans accord.

**Ce qui reste dans la v0.**

- L'écran **Ciel** : l'avion au-dessus de l'utilisateur, en plein écran.
- L'écran **Prochains passages** : un carrousel vertical des 10 prochains avions qui vont passer, précédé de l'avion en cours s'il y en a un.

**Ce qui sort de la v0.** Hangar et collection, fiche avion, recherche, carte, alertes, widgets, réglages, onboarding, cartes à collectionner, mode AR et toutes les autres vues. Ce code n'est pas supprimé : il est retiré de la navigation et placé derrière un flag `FEATURES` (ou déplacé dans un dossier `legacy/`) pour pouvoir le réactiver. Les dépendances qui ne servent plus qu'à ces écrans sont retirées, mais seulement après validation de leur liste.

**Avant de coder.** La software factory lit le README en entier, regarde les captures, explore le code existant (navigation, écrans, source ADS-B, localisation, polices, thème), puis présente un plan court de ce qu'elle garde, supprime et crée, avant toute modification.

## 2. Navigation et écrans

Les deux écrans sont posés côte à côte et on passe de l'un à l'autre par un simple glissement horizontal, sans barre d'onglets ni menu.

**Navigation.** Pager horizontal à deux pages, avec `react-native-pager-view` ou `react-native-reanimated` et `react-native-gesture-handler`. Un indicateur à deux traits, décrit dans le README, montre la page active. L'app s'ouvre sur Ciel.

**Écran Ciel.** L'avion qui survole l'utilisateur, en plein écran. Le fond prend la couleur primaire de la compagnie, tout le texte sa couleur secondaire (corrigée par la règle de contraste, section 3), et la dérive de la compagnie apparaît selon la composition du README. La direction de l'avion est donnée en point cardinal avec une flèche qui tourne avec le téléphone.

**Écran Prochains passages.** Un carrousel vertical de cartes de 650 pt de haut, calées une par une, où l'on aperçoit le bas de la carte précédente et le haut de la suivante.

- Première carte : « En ce moment » si un avion survole l'utilisateur, sinon directement le premier passage à venir.
- Puis les 10 prochains passages, triés par heure de passage, chacun avec son compte à rebours et sa direction d'arrivée.
- Implémentation : `FlatList` avec `snapToInterval={662}` (650 pt de carte et 12 pt d'espacement), `decelerationRate="fast"`, `disableIntervalMomentum` et un padding haut de 100 pt.
- Comptes à rebours : un tick par seconde, en chiffres tabulaires, sans re-rendre toute la liste (un timer par carte visible ou une valeur partagée Reanimated). À 00:00, la carte bascule en « En ce moment ».

## 3. Règles visuelles

Tout l'écran prend les couleurs de la compagnie, et c'est une règle de contraste unique, reprise à l'identique du prototype, qui garantit que le texte reste lisible quelle que soit la compagnie.

**Couleur.** Le module `theme/airlineColors.ts` reproduit exactement `fit()` et `mix()` de `data.js`. `fit()` ajuste la couleur secondaire jusqu'à atteindre un contraste de 3:1 pour les grands textes et 4,5:1 pour les petits textes sur le fond primaire. Le module est pur et testé unitairement.

**Table des compagnies.** Une entrée par compagnie : code, nom, pays, couleur primaire, couleur secondaire, codes IATA et OACI, image de dérive facultative. Les couleurs sont reprises de `data.js`.

**Dérives.**

- Seules des images dont la licence autorise le stockage et l'intégration dans l'app sont utilisées, par exemple Soaring Symbols (licence MIT), avec la notice de licence dans les crédits.
- Le package local `airlines-scraper` peut alimenter les codes IATA et OACI. Ses images ne sont intégrées que si leur source l'autorise : ce n'est pas le cas d'Inflight Feed, dont les conditions d'utilisation interdisent la copie, la modification et l'affichage public.
- Les dérives Iberia et Air France du prototype contiennent des logos : elles ne sont pas intégrées sans accord explicite.
- En l'absence d'image autorisée, une dérive générique en SVG (`react-native-svg`), en miroir et orientée vers la gauche, colorée avec la primaire et la secondaire de la compagnie.

**Typographie.** Archivo uniquement, chargée via `expo-font` depuis Google Fonts, avec les variantes condensées les plus proches des largeurs du README. Chiffres tabulaires (`fontVariant: ['tabular-nums']`) pour tous les comptes à rebours.

**Textes.** En français, sans emoji, sans logos de compagnies réelles. Une mention dans l'app précise que les noms et couleurs des compagnies servent uniquement à identifier les vols, sans affiliation.

## 4. Données et calculs

La source ADS-B existante est conservée telle quelle ; la v0 ajoute seulement deux calculs, l'avion au-dessus et la prévision des prochains passages, rafraîchis toutes les 10 secondes.

| Paramètre | Valeur par défaut | Rôle |
| --- | --- | --- |
| Seuil « au-dessus » | 4 km | Distance au sol maximale pour qu'un avion soit affiché sur l'écran Ciel |
| Rayon de prévision | 80 km | Zone dans laquelle on cherche les avions susceptibles de passer |
| Nombre de passages | 10 | Cartes affichées après « En ce moment » |
| Fenêtre « En ce moment » | ±5 km | Portion de trajectoire autour du point le plus proche pendant laquelle la carte reste « En ce moment » |
| Rafraîchissement | 10 s | Nouvelle récupération des données et recalcul |

**Avion au-dessus.** Le plus proche de l'utilisateur parmi ceux sous le seuil de 4 km. S'il n'y en a aucun, l'écran Ciel affiche l'état « aucun avion au-dessus ».

**Prochains passages.** Pour chaque avion du rayon de 80 km :

1. Extrapoler la trajectoire en ligne droite à partir de la position, de la vitesse sol et du cap.
2. Calculer le point de la trajectoire le plus proche de l'utilisateur, la distance à ce point et l'heure à laquelle l'avion l'atteindra.
3. Écarter les avions dont le point le plus proche est déjà derrière eux ou au-delà du seuil de 4 km.
4. Calculer le gisement d'arrivée, c'est-à-dire la direction depuis laquelle l'avion arrivera vu de l'utilisateur.
5. Trier par heure de passage et garder les 10 premiers.

La fenêtre « En ce moment » convertit les ±5 km autour du point le plus proche en durée d'après la vitesse de l'avion : la carte reste « En ce moment » pendant tout ce temps, puis disparaît.

**Direction.** Huit points cardinaux (N, NE, E, SE, S, SO, O, NO) calculés à partir du gisement. La flèche tourne avec le téléphone : son angle vaut le gisement de l'avion moins le cap du téléphone, obtenu par `expo-location` avec `watchHeadingAsync`.

**Limite connue.** L'extrapolation en ligne droite est fausse pour les avions qui virent ou qui sont en approche d'un aéroport ; c'est acceptable en v0, et les prévisions se corrigent d'elles-mêmes à chaque rafraîchissement.

## 5. États d'interface

Chaque état reste sobre et dans le même langage visuel que le reste (Archivo, aplats, aucune illustration ajoutée), avec un fond neutre quand aucune compagnie n'est affichée.

| État | Écran concerné | Comportement attendu |
| --- | --- | --- |
| Chargement | Les deux | Premier affichage avant les données ; pas d'écran blanc, pas de spinner système |
| Aucun avion au-dessus | Ciel | Message court et, si possible, le délai avant le prochain passage prévu |
| Aucun passage prévu | Prochains passages | Message court ; le carrousel reste vide sans carte factice |
| Localisation refusée | Les deux | Explication en une phrase et bouton vers les réglages du téléphone |
| Hors ligne | Les deux | Dernières données affichées avec leur heure, puis message si elles ont plus de quelques minutes |

Les textes exacts de ces états sont à proposer par la software factory et à valider avant intégration.

## 6. Plan de livraison et tests

Le travail avance en six petites étapes vérifiables, chacune lancée sur simulateur iPhone 15 ou 16 (393 × 852 pt) et comparée aux captures du handoff, avec un compte rendu des écarts avant de passer à la suivante.

- [ ] **Étape 1 : thème et table des compagnies.** Module `theme/airlineColors.ts` avec `fit()` et `mix()`, table des compagnies, tests unitaires.
- [ ] **Étape 2 : navigation à deux pages.** Pager horizontal et indicateur à deux traits, écrans vides.
- [ ] **Étape 3 : écran Ciel sur données fictives.** Couleurs, typographie, dérive générique, flèche de direction.
- [ ] **Étape 4 : carrousel Prochains passages sur données fictives.** Cartes de 650 pt, calage, comptes à rebours, bascule en « En ce moment ».
- [ ] **Étape 5 : branchement des vraies données.** Source ADS-B existante, avion au-dessus, extrapolation des passages, rafraîchissement, états.
- [ ] **Étape 6 : nettoyage.** Écrans hors v0 derrière le flag `FEATURES` ou dans `legacy/`, liste des dépendances à retirer soumise avant suppression.

**Tests unitaires obligatoires.** `fit()` (seuils 3:1 et 4,5:1, couleurs limites), `mix()`, le calcul des huit points cardinaux et de l'angle de la flèche, l'extrapolation des passages (avion qui s'approche, qui s'éloigne, qui passe à côté, vitesse nulle).

**Critères d'acceptation de la v0.**

- Le rendu des deux écrans correspond aux captures du handoff, écarts signalés et validés.
- Le carrousel se cale carte par carte sans saut, et les comptes à rebours tournent sans faire ramer le défilement.
- La flèche suit la rotation du téléphone en temps réel.
- Un avion qui passe effectivement au-dessus apparaît dans « En ce moment » au bon moment, à quelques secondes près.
- Aucun écran hors v0 n'est accessible, mais tous restent réactivables par le flag.
- Aucune image de dérive sans licence compatible n'est embarquée.

## 7. Vision affinée

Skyline est une app iOS et Android en Expo qui dit en une seconde quel avion passe au-dessus de toi et lesquels vont passer ensuite. Elle reprend l'idée du cadre Avioframe mais vit sur le téléphone, avec ce qu'un cadre ne sait pas faire : prévoir, prévenir et collectionner.

**Ce que la v0 a tranché.**

- **Le cœur du produit, ce sont deux moments** : « qui est au-dessus de moi maintenant » (écran Ciel) et « qui va passer, quand et d'où » (Prochains passages). La prévision des passages, qui n'était qu'un détail de l'état « ciel vide » dans la spec initiale, devient une fonction centrale.
- **La direction artistique retenue est la piste « Dérive »** : tout l'écran prend la couleur primaire de la compagnie et le texte sa couleur secondaire, avec une dérive comme seul élément graphique. Les directions Profil 60 et Poster ne sont plus la vue d'ouverture ; elles deviennent des vues optionnelles pour plus tard.
- **Une seule famille typographique, Archivo**, au lieu du trio Archivo, IBM Plex Mono et Inter.
- **Une navigation par glissement entre écrans pleins**, sans barre d'onglets, tant que l'app compte peu d'écrans.

**Le risque produit, inchangé.** Une app qu'il faut ouvrir retombe sur le terrain de Flightradar24. Skyline doit gagner sur ce que Flightradar fait mal : la prévision lisible (« dans 3 min, au nord-est »), l'information qui vient à toi (alertes, widgets, Live Activity), le plaisir visuel et la collection. La v0 teste les deux premiers points sur l'écran ; les suivants arrivent avec le MVP.

**Cible.** Curieux et passionnés d'aviation, riverains d'aéroports et de couloirs aériens, familles avec enfants, voyageurs qui attendent un proche.

**Proposition de valeur.** « Lève les yeux, Skyline t'a déjà dit qui c'est, et qui sera le suivant. »

**Hors périmètre durable.** Le matériel, le site vitrine, le checkout et le multi-devises.

## 8. Feuille de route

Chaque version ajoute une seule couche de valeur et doit être validée à l'usage avant la suivante : on ne construit les alertes et la collection que si l'écran Ciel et les prévisions donnent envie d'ouvrir l'app.

| Version | Ce qu'elle apporte | Question qu'elle doit trancher |
| --- | --- | --- |
| v0 | Écran Ciel et Prochains passages, données ADS-B existantes, aucun backend nouveau | Le rendu « Dérive » et la prévision des passages donnent-ils envie d'ouvrir l'app plusieurs fois par jour ? |
| MVP | Backend de scène et de surveillance, alertes intelligentes, widgets, lieux enregistrés, fiche avion, hangar et collection, mode ambiance | L'information qui vient à toi fait-elle revenir les utilisateurs sans qu'ils pensent à ouvrir l'app ? |
| V2 | Live Activity, mode AR « Lève les yeux », suivre un vol, carte des destinations, partage en story, journal du ciel, vues supplémentaires | Quelles features créent du bouche-à-oreille ? |
| V3 | Vues Cockpit et Enfants, raccourcis vocaux, amis et classement, modèle premium | Y a-t-il une base assez engagée pour monétiser ? |

**Règle de passage.** Une version n'est lancée que si la précédente est utilisée quotidiennement par Sam et quelques testeurs pendant au moins deux semaines.

## 9. Architecture cible

La v0 garde la source ADS-B existante et calcule les prévisions dans l'app ; à partir du MVP, un backend léger reprend ces calculs, met en cache et surveille les zones des utilisateurs, seule façon fiable d'envoyer des alertes quand l'app est fermée.

| Brique | Source | Rôle | Version |
| --- | --- | --- | --- |
| Positions live | [adsb.lol](https://adsb.lol) (licence ODbL) ou source ADS-B existante | Aéronefs autour d'un point : position, altitude, vitesse, cap, taux vertical | v0 |
| Fiche avion et route | adsbdb.com | Immatriculation, type exact, compagnie, départ et arrivée | MVP |
| Codes compagnies | Package local `airlines-scraper` (codes IATA et OACI) et table `data.js` | Nom, pays, couleurs primaire et secondaire | v0 |
| Dérives | Sources à licence compatible uniquement (par exemple Soaring Symbols, MIT), sinon dérive générique SVG | Image de la compagnie sur l'écran Ciel et les cartes | v0 |
| Géocodage | OpenStreetMap / Nominatim | Adresse des lieux enregistrés | MVP |
| Météo | METAR par code OACI | Visibilité à l'œil nu | MVP |
| Photos d'avions | Planespotters.net, crédit photographe | Photo réelle sur la fiche | MVP |

**Endpoints du backend (MVP).**

- `GET /scene?lat=&lon=&radius=` : avions enrichis triés par distance, avec direction et phase de vol.
- `GET /passages?lat=&lon=&radius=80` : les prochains passages calculés côté serveur, avec heure, gisement d'arrivée et fenêtre « En ce moment ». Il reprend exactement l'algorithme de la v0 (section 4), qui sert de référence et de jeu de tests.
- `GET /aircraft/:hex`, `GET /flight?q=` : fiche et recherche.
- `POST /places`, `POST /alerts`, `POST /devices` : lieux, règles d'alerte, jetons Expo Push.
- `GET /me/hangar`, `POST /me/sightings` : collection synchronisée.
- Worker de surveillance toutes les 30 à 60 s pour les alertes.

**Comptes et données personnelles.** Utilisable sans compte (identifiant anonyme d'appareil) ; compte demandé seulement pour la synchro ou le classement. Base Postgres, par exemple Supabase. Position arrondie à environ 100 m dès qu'elle est stockée, attribution ODbL et OSM dans l'écran À propos.

**Mentions légales.** Les noms, couleurs et dérives des compagnies servent uniquement à identifier les vols affichés ; une mention de non-affiliation figure dans l'écran À propos et sur les stores, avec les notices de licence des sources d'images.

## 10. Écrans et navigation cible

La navigation par glissement de la v0 reste la colonne vertébrale : Ciel au centre, Prochains passages à droite, et les écrans du MVP viennent s'y greffer sans réintroduire de barre d'onglets tant que c'est possible.

| Écran | Contenu | Accès | Version |
| --- | --- | --- | --- |
| Ciel | Avion au-dessus, plein écran aux couleurs de la compagnie, direction et flèche boussole | Page d'ouverture du pager | v0 |
| Prochains passages | Carrousel « En ce moment » puis 10 prochains passages avec compte à rebours | Glissement vers la droite | v0 |
| Fiche avion | Compagnie, vol, route avec mini-carte, type, immatriculation, altitude, vitesse, phase, photo créditée, « Ajouter au hangar », « Suivre ce vol », partage | Tap sur Ciel ou sur une carte de passage, en bottom sheet | MVP |
| Hangar | Collection en cartes, rareté, badges, progression | Glissement vers la gauche depuis Ciel | MVP |
| Alertes | Règles actives, création guidée, historique | Depuis Réglages ou depuis la fiche avion | MVP |
| Réglages | Lieux enregistrés, rayon, seuils, unités, langue, mode ambiance, compte, À propos et mentions légales | Bouton discret sur Ciel | MVP |
| Carte | Avions animés, rayon, filtres | Depuis Prochains passages | MVP |
| Onboarding | Promesse, permission de localisation, premier avion ; notifications demandées seulement à la première alerte | Premier lancement | MVP |
| Mode ambiance | Ciel plein écran sans interface, écran maintenu allumé, rotation optionnelle des vues | Réglages | MVP |

**Décision à prendre au MVP.** Si le pager dépasse trois pages (Hangar, Ciel, Passages), il faudra choisir entre garder le glissement avec un indicateur plus riche ou revenir à une barre d'onglets ; à trancher après les tests de la v0.

## 11. Vues du ciel et features par version

La vue « Dérive » de la v0 devient la vue par défaut de l'app ; les autres vues imaginées dans la spec initiale ne reviennent qu'en option, une fois le cœur validé.

**Vues du ciel.**

| Vue | Description | Version |
| --- | --- | --- |
| Dérive (par défaut) | Fond couleur primaire de la compagnie, texte couleur secondaire, dérive seule, route et direction | v0 |
| Profil 60 | Avion de profil minimaliste façon affiche des années 60, pour le mode ambiance | MVP, optionnelle |
| Radar | Vue de dessus, cercles en km, rotation avec la boussole du téléphone | MVP |
| Tableau | Tableau de départs façon aéroport avec animation split-flap, alimenté par les prochains passages | MVP |
| Poster, Duo | Illustration de l'avion et cartouche ; deux avions côte à côte | V2 |
| Piste, Carte de route | Avions au sol près d'un aéroport ; trajectoire complète | V2 |
| Cockpit, Enfants | Instruments animés ; version ludique simplifiée | V3 |

**Features.**

| Feature | Description | Version |
| --- | --- | --- |
| Avion au-dessus | Le plus proche sous un seuil réglable (4 km par défaut) | v0 |
| Prochains passages | Extrapolation des trajectoires dans 80 km, 10 prochains passages, compte à rebours, gisement d'arrivée | v0 |
| Flèche boussole | Direction de l'avion relative à l'orientation du téléphone | v0 |
| Alertes intelligentes | Avion à moins de X km, type précis (A380, 747), compagnie, rare, jamais vu ; heures silencieuses et plafond quotidien. Nouvelle règle rendue possible par la v0 : « prévenir N minutes avant un passage » | MVP |
| Widgets | Petit : prochain passage et compte à rebours ; moyen : vue Dérive ; écran verrouillé | MVP |
| Collection et rareté | Chaque avion identifié devient une carte, rareté selon la fréquence locale, badges, séries | MVP |
| Visible à l'œil nu | Altitude, distance, jour ou nuit et METAR | MVP |
| Lieux multiples | Maison, travail, « Ici » | MVP |
| Mode ambiance | Téléphone ou tablette sur chargeur devient un cadre live | MVP |
| Live Activity | « Survol dans 3 min » sur l'écran verrouillé, alimentée par la prévision de la v0 | V2 |
| Mode AR « Lève les yeux » | Étiquettes accrochées aux avions dans la caméra | V2 |
| Suivre un vol, partage, journal du ciel, carte des destinations | Usages émotionnels, acquisition et ré-engagement | V2 |
| Raccourcis vocaux, amis et classement, premium | Accès sans écran, viralité, monétisation | V3 |

## 12. Logique live et contraintes mobiles

La v0 fait tout en premier plan dans l'app ; tout ce qui doit fonctionner app fermée (alertes, widgets, Live Activity) passera côté serveur au MVP, car iOS et Android limitent fortement le travail en arrière-plan.

1. **Scène.** Aéronefs du rayon, au sol écartés, distance, direction et phase calculées, tri par distance (v0 dans l'app, MVP sur le serveur).
2. **Avion au-dessus.** Le plus proche sous le seuil, avec une hystérésis à prévoir au MVP pour éviter de sauter d'un avion à l'autre quand deux sont à distance égale.
3. **Prochains passages.** Extrapolation en ligne droite, point le plus proche, heure, gisement, fenêtre « En ce moment » de ±5 km (section 4). Amélioration possible au MVP : tenir compte du taux de virage ou de la route connue pour les avions en approche.
4. **Rafraîchissement.** Toutes les 10 s en premier plan, pause automatique en arrière-plan, comptes à rebours locaux à la seconde entre deux rafraîchissements.
5. **Localisation.** Permission « pendant l'utilisation » uniquement ; au MVP, les lieux enregistrés suffisent aux alertes, sans localisation en arrière-plan.
6. **Orientation.** Cap du téléphone via `watchHeadingAsync`, utilisé par la flèche de la v0, puis par le Radar et le mode AR.
7. **Alertes app fermée (MVP).** Worker serveur, envoi Expo Push, déduplication par avion et par règle, plafond quotidien, heures silencieuses.
8. **Widgets (MVP).** Timeline iOS rafraîchie environ toutes les 15 min, complétée par des push silencieux quand un passage intéressant approche ; le compte à rebours du widget utilise le minuteur natif du système plutôt qu'un rafraîchissement.
9. **Hangar (MVP).** Un avion y entre quand il a été affiché sur Ciel, ouvert en fiche ou ajouté à la main ; stockage local SQLite, synchro si compte.
10. **Hors ligne.** Dernières données affichées avec leur heure, collection consultable sans réseau.
11. **Unités et langue.** Métrique en v0, impérial et anglais au MVP.

## 13. Stack technique

Le projet reste entièrement en Expo avec un development build ; la v0 n'utilise qu'une petite partie de la stack, le reste arrive avec les versions suivantes.

| Besoin | Choix | Version |
| --- | --- | --- |
| Socle | Expo SDK récent, TypeScript, EAS Build et EAS Update, development build | v0 |
| Navigation | Pager horizontal : `react-native-pager-view`, ou Reanimated avec Gesture Handler | v0 |
| Listes | `FlatList` avec calage (`snapToInterval`) pour le carrousel | v0 |
| Rendu | `react-native-svg` pour la dérive générique ; Skia envisageable pour Radar et animations riches | v0, puis MVP |
| Polices | Archivo via `expo-font` | v0 |
| Localisation et cap | `expo-location` (position et `watchHeadingAsync`) | v0 |
| Données | Source ADS-B existante en v0 ; TanStack Query pour le polling et le cache au MVP | v0, puis MVP |
| Stockage local | `expo-sqlite` pour le hangar, MMKV pour les réglages | MVP |
| Notifications | `expo-notifications` et Expo Push Service | MVP |
| Widgets et Live Activity iOS | `expo-widgets` (stable depuis le SDK 56) | MVP, puis V2 |
| Widgets Android | `react-native-android-widget` | MVP |
| Mode ambiance | `expo-keep-awake`, `expo-brightness` | MVP |
| Caméra AR | `expo-camera` et `expo-sensors` | V2 |
| Partage | `react-native-view-shot`, `expo-sharing` | V2 |
| Backend | Node (Fastify ou Hono) ou Supabase Edge Functions, Postgres, Redis, worker planifié | MVP |
| Qualité | Jest, React Native Testing Library, Maestro pour les parcours | v0 pour les tests unitaires |

Les versions sont à revérifier au démarrage de chaque version, l'écosystème Expo évoluant vite.

## 14. Design system affiné

Le système visuel se simplifie autour d'une seule idée : chaque écran qui montre un avion prend les couleurs de sa compagnie, et tout le reste de l'app reste neutre pour ne pas lui faire concurrence.

- **Couleurs de compagnie.** Fond en couleur primaire, texte en couleur secondaire, corrigée par `fit()` pour atteindre 3:1 sur les grands textes et 4,5:1 sur les petits. `mix()` sert aux nuances intermédiaires (traits, textes secondaires, indicateurs). Les valeurs viennent de la table compagnies issue de `data.js` et la bibliothèque des dérives sert de complément pour les compagnies absentes.
- **Couleurs neutres.** Pour les écrans sans compagnie (chargement, états vides, réglages) : un fond crème et une encre sombre, avec leur équivalent de nuit ; valeurs exactes à reprendre du README du handoff.
- **Typographie.** Archivo uniquement, en jouant sur la graisse et les variantes condensées pour hiérarchiser ; chiffres tabulaires pour les comptes à rebours, les altitudes et les distances. IBM Plex Mono, Inter et Jost sortent du système.
- **Dérives.** Image de compagnie quand sa licence le permet, sinon dérive générique SVG en miroir, orientée vers la gauche, aux couleurs de la compagnie. Aucun logo de compagnie sans source autorisée.
- **Mise en page.** Mesures, marges et tailles de texte selon le README ; cartes de passage de 650 pt calées tous les 662 pt ; indicateur de page à deux traits.
- **Mouvement.** Glissement entre pages, calage net des cartes, bascule d'une carte en « En ce moment » à 00:00, flèche qui suit le téléphone sans à-coups. Le changement d'avion sur Ciel, avec la couleur de fond qui glisse d'une compagnie à l'autre, est le moment signature de l'app.
- **Composants du MVP.** Bottom sheet de fiche avion, cartes de collection, chips de filtre et cellules de réglages reprennent la même typographie et les mêmes neutres ; ils seront dessinés dans Claude Design à partir de ce système.
- **Nom et icône.** « Skyline » reste un nom de travail à vérifier sur les stores ; l'icône reprendra une dérive générique sur fond coloré, sans compagnie réelle.

## 15. Backlog après la v0 et points de vigilance

Une fois la v0 validée, le MVP se livre en quatre lots qui transforment les calculs de l'app en service capable de te prévenir, puis ajoutent la collection.

**Lot 1 : backend de scène et de passages.**

- [ ] Clients ADS-B et adsbdb, cache Redis avec TTL différenciés.
- [ ] Endpoints `/scene` et `/passages`, ce dernier reprenant l'algorithme et les tests de la v0.
- [ ] Endpoints `/aircraft/:hex`, `/flight`, `/places`, `/devices`, identifiant anonyme d'appareil.

* Critère : pour un point proche de CDG, `/passages` renvoie 10 passages cohérents avec ceux calculés par l'app v0, en moins de 800 ms cache chaud.

**Lot 2 : fiche avion, lieux et hangar.**

- [ ] Fiche avion en bottom sheet depuis Ciel et Passages, photo créditée.
- [ ] Lieux enregistrés (Maison, Travail) en plus de « Ici ».
- [ ] Hangar local SQLite, cartes avec rareté, badges, série de jours ; compte optionnel et synchro.

* Critère : un avion vu hors ligne apparaît dans le hangar et se synchronise au retour du réseau.

**Lot 3 : alertes et widgets.**

- [ ] Création guidée d'alertes, dont « prévenir N minutes avant un passage », heures silencieuses, plafond quotidien.
- [ ] Worker serveur et Expo Push, deep link vers la fiche avion.
- [ ] Widgets iOS (petit, moyen, écran verrouillé) et Android.

* Critère : notification reçue au moins 2 minutes avant le passage prévu, app fermée, sans doublon.

**Lot 4 : vues et confort.**

- [ ] Vues Radar et Tableau, Profil 60 en option.
- [ ] Mode ambiance, onboarding, réglages complets, unités impériales et anglais.

**V2 et V3.** Repris de la feuille de route (section 8), sans changement de périmètre par rapport à la spec initiale.

**Points de vigilance.**

- Les API ouvertes n'offrent aucune garantie de disponibilité ni de complétude ; prévoir un repli propre quand la compagnie, le type ou la route sont inconnus.
- L'extrapolation en ligne droite se trompe pour les avions qui virent ; afficher les comptes à rebours comme des estimations et les corriger à chaque rafraîchissement.
- Licences : attribution ODbL et OSM obligatoire, images de dérive uniquement depuis des sources à licence compatible, mention de non-affiliation aux compagnies.
- Textes de permission clairs pour la localisation et, plus tard, la caméra.
- Budget de notifications serré pour ne pas faire désinstaller l'app.
