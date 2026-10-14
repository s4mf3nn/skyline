# SPEC-0010 : Dérives réelles (livrées des compagnies)

Statut : BROUILLON
Risque estimé : élevé (crée `assets/tails/`, zone sensible de `docs/factory/RISK.md` : revue `full`, pas d'auto-merge ; images de tiers soumises à une autorisation consignée ; poids du bundle)
Dépend de : SPEC-0002, SPEC-0005, SPEC-0006 (cette spec reste `BROUILLON` tant que SPEC-0005 n'est pas écrite : les `testID` de Ciel sont posés ici, comme dans SPEC-0009, et SPEC-0005 les reprend)
Tests de contrat : `tests/acceptance/SPEC-0010.test.ts` (Vitest), `tests/acceptance/SPEC-0010.native.test.tsx` (Jest) ; instantané des images : `tests/acceptance/SPEC-0010.liveries.json`
Scénarios cachés : `tests/holdout/SPEC-0010.test.ts` et `tests/holdout/SPEC-0010.native.test.tsx` (ne pas les décrire ici)

## Objectif
Quand l'observateur regarde un avion d'une compagnie dont l'image est autorisée, Ciel et la carte de Prochains passages montrent la livrée réelle de cette compagnie à la place de la dérive générique SVG. Pour toute autre compagnie, rien ne change : dérive générique, couleurs du thème, aucune image inventée (INV8). Les images sont embarquées dans l'application, aucune n'est chargée depuis le réseau.

## Autorisation consignée
Règle de `docs/factory/DOMAIN-SECURITY.md` : aucune image n'entre dans `assets/tails/` sans autorisation consignée dans la spec qui l'ajoute.

- **Source des images** : Inflight Feed (<https://inflightfeed.com/airlines/>), collectées par le dépôt local `airlines-scraper` du propriétaire (`package/data/airlines.json`, version 2). Les conditions d'utilisation du site interdisent par défaut la copie et l'affichage public ; l'usage ici repose sur l'accord écrit ci-dessous.
- **Accord** : accord écrit obtenu par le propriétaire, déclaré le 2026-10-14 (suite à la déclaration du 2026-10-13 de l'ADR-0001, qui précise « `rights.json` à `cleared` »). Le document est archivé hors dépôt par le propriétaire ; la spec n'en reprend ni le donneur ni le texte. La mention `personal-use` de `airlines-scraper/LICENSES.md` est antérieure à cet accord : le propriétaire la met à jour de son côté.
- **Périmètre déclaré** : livrées (images `images.livery`), usage dans une application publiée (TestFlight, test interne Google Play, puis stores). Les logos (`images.logo`) ne sont **pas** couverts par cette spec : aucun logo n'entre dans `assets/tails/`.
- **Compagnies** : les 133 compagnies de `tests/acceptance/SPEC-0010.liveries.json`. Les 137 livrées du catalogue moins 4 dont l'image est octet pour octet celle d'une autre compagnie (TUI Fly Belgium `JAF` et TUI Airways `TOM` ; Virgin Atlantic `VIR` et Virgin Australia `VOZ`) : afficher la livrée d'une autre compagnie serait inventer une image (INV8). Ces quatre compagnies gardent la dérive générique.
- **Notice de crédit** (texte fourni, exposé par `LIVERY_CREDIT`, affiché dans l'app par le propriétaire, voir « Hors périmètre ») : « Images des compagnies : Inflight Feed (inflightfeed.com) ; livrées © leurs compagnies. Utilisées pour identifier les vols, sans affiliation. »
- **Modification interdite** : les fichiers sont copiés tels quels (octets identiques, SHA-256 de l'instantané), ni recadrés, ni recompressés, ni retouchés.

## Acteurs et rôles
Aucun rôle (aucune action exposée ; l'observateur ne fait que regarder).

## Critères d'acceptation
L'instantané `tests/acceptance/SPEC-0010.liveries.json` fait foi : pour chaque compagnie, son code OACI principal (`Airline.code` de SPEC-0002), le nom du fichier, sa taille et son SHA-256. La partie pure vit dans `src/shared/airlines/index.ts` (jouée sous Vitest, sans import de React Native) ; la résolution de l'image et son composant dans `src/shared/airlines/livery.tsx`.

Partie pure (Vitest, `tests/acceptance/SPEC-0010.test.ts`) :

- **CA1** : `LIVERY_CODES` est la liste des codes qui ont une livrée : exactement les 133 codes de l'instantané, sans doublon, chacun étant le `code` d'une entrée de `AIRLINES`. Ni `JAF`, `TOM`, `VIR`, `VOZ` ni le code d'`UNKNOWN_AIRLINE` n'y figurent. Les huit compagnies du handoff (`IBE`, `AFR`, `EZY`, `DLH`, `KLM`, `RYR`, `VLG`, `TAP`) y figurent.
- **CA2** : `hasLivery(airline)` vaut `true` si et seulement si `airline.code` est dans `LIVERY_CODES`. `resolveAirline("AFR1506")`, `resolveAirline("EZY4617")` : `true`. `resolveAirline("VIR3")`, une compagnie de la table sans livrée, `UNKNOWN_AIRLINE`, `resolveAirline(null)` et `resolveAirline("ZZZ123")` : `false` (INV8).
- **CA3** : `assets/tails/` contient exactement les 133 fichiers de l'instantané (même nom `<code>.<png|webp>`), aucun autre fichier ni sous-dossier, et chaque fichier a la taille et le SHA-256 de l'instantané (copie à l'identique, aucune image d'une compagnie exclue ni aucun logo).
- **CA4** : `LIVERY_CREDIT` vaut exactement le texte de la notice de crédit ci-dessus.

Partie écran (Jest, `tests/acceptance/SPEC-0010.native.test.tsx`, écrans montés par `createApp` avec les faux de `src/shared/`) :

- **CA5** : `getLiverySource(airline)` (`src/shared/airlines/livery.tsx`) rend une source d'image pour chacun des 133 codes de `LIVERY_CODES`, deux sources distinctes pour deux codes distincts, et `null` pour toute autre compagnie, `UNKNOWN_AIRLINE` comprise.
- **CA6** : (carte de passage à venir) pour un avion dont la compagnie a une livrée, la carte `passage-card-<hex>` contient un élément `passage-livery-<hex>` dont la `source` est `getLiverySource(airline)` et dont l'`accessibilityLabel` est « Livrée <nom de la compagnie> » ; la dérive générique `passage-tail-<hex>` n'est pas rendue.
- **CA7** : (carte « En ce moment ») la carte du survol en cours suit la même règle que CA6, avec les mêmes `testID`.
- **CA8** : (Ciel) quand Ciel montre un avion dont la compagnie a une livrée, l'élément `ciel-livery` porte la source et l'`accessibilityLabel` de CA6 et la dérive générique `ciel-tail` n'est pas rendue.
- **CA9** : (repli, INV8) pour un avion sans indicatif, d'indicatif inconnu, de compagnie de la table sans livrée ou de compagnie exclue (`VIR`), aucun élément `*-livery` n'est rendu et la dérive générique de la compagnie est rendue (`passage-tail-<hex>`, `ciel-tail`) avec sa palette, exactement comme avant cette spec.
- **CA10** : (thème inchangé) avec une livrée, le fond de la carte reste `theme.bg` de la compagnie et ses textes gardent `theme.big` et `theme.small` (SPEC-0002, INV5) : l'image ne modifie aucune couleur.
- **CA11** : (suit l'avion) quand un rafraîchissement change l'avion montré (autre compagnie au même `hex`, ou autre avion en survol), la livrée affichée est celle de la nouvelle compagnie, ou la dérive générique si elle n'en a pas ; aucune livrée de l'avion précédent ne reste affichée.
- **CA12** : (hors réseau) afficher des livrées n'émet aucune requête (`fetch` jamais appelé par le rendu, aucune préparation d'image distante), n'envoie rien au suivi des erreurs et n'écrit rien dans les logs : les images sont des ressources de l'application.

## Cas limites
- Compagnie à plusieurs codes OACI (`airline.icao`) : l'image est indexée par le code principal (`Airline.code`) ; un indicatif qui résout vers la compagnie, quel que soit son préfixe, donne la même livrée.
- Compagnie de la table sans livrée dans l'instantané (8 sur les 145 du catalogue, plus les 4 exclues) : dérive générique, jamais un repli vers l'image d'une autre compagnie.
- Image de format `webp` (2 fichiers) ou `png` : même composant, aucun traitement par format.
- Avion retenu par Ciel (INV9) : il garde ses dernières valeurs affichées, livrée comprise ; c'est la règle de présence de SPEC-0005, non rejouée ici.
- Image qui ne peut pas être décodée : l'élément image n'est pas remplacé en cours de route par une autre ; le repli est le comportement du composant d'image (non testé, ressource embarquée).
- Indicatif qui change entre deux instantanés pour le même avion : la livrée suit la compagnie résolue (CA11).
- Un test de rendu ne charge jamais une image qui n'est pas dans `assets/tails/` (CA3).

## Contrat d'interface
Ajouts à `src/shared/airlines/index.ts` (logique pure) :

```ts
LIVERY_CODES: readonly string[]          // codes OACI principaux avec livrée (133)
hasLivery(airline: Airline): boolean     // airline.code ∈ LIVERY_CODES
LIVERY_CREDIT: string                    // notice de crédit, texte exact ci-dessus
```

`src/shared/airlines/livery.tsx` (React Native, jamais importé par `index.ts`) :

```ts
getLiverySource(airline: Airline): ImageSourcePropType | null   // null sans livrée
AirlineLivery({ airline, width, height }: { airline: Airline; width: number; height: number }): ReactElement | null
```

`AirlineLivery` rend une `Image` (`resizeMode` `contain`) et rien quand la compagnie n'a pas de livrée. Les écrans choisissent : `AirlineLivery` s'il existe une source, `AirlineTail` (SPEC-0002) sinon. `testID` : `passage-livery-<hex>` (cartes), `ciel-livery` (Ciel) ; le `testID` de la dérive générique est `passage-tail-<hex>` (SPEC-0006) ou `ciel-tail`.

Fichiers : `assets/tails/<code>.<png|webp>`. La table des `require()` statiques que Metro exige est un fichier généré (`src/shared/airlines/liveries.gen.ts`, `pnpm gen`, jamais édité à la main) ; elle est dérivée du contenu de `assets/tails/`.

## Écrans
Pas de maquette : les maquettes viendront plus tard par amendement de cette spec (décision du propriétaire du 2026-10-14). En attendant, l'image occupe l'emplacement de la dérive générique de l'écran (Ciel, bas gauche des cartes), dans son cadre, avec `resizeMode` `contain`. Les livrées d'Inflight Feed sont des photos d'avion de profil au format paysage (environ 1000 × 768), alors que la dérive du handoff est un gabarit 300 × 440 en miroir : le rendu final n'est donc pas décidé ici. Les parcours sur cible réelle et la comparaison aux captures du handoff relèvent de l'amendement.
- **Ciel** : livrée (CA8) ou dérive générique (CA9).
- **Cartes de Prochains passages et carte « En ce moment »** : livrée (CA6, CA7) ou dérive générique (CA9).

## Hors périmètre
- Disposition, taille, recadrage et orientation de la livrée (maquettes à venir).
- Logos de compagnies (`images.logo`), compagnies absentes du catalogue, couleurs et pays des compagnies hors handoff (SPEC-0002).
- Texte, écran et emplacement des mentions légales dans l'app : réalisés par le propriétaire hors roadmap des agents (`docs/PRODUCT.md`, « Hors périmètre »). Un agent n'y touche que par le mode hors spec de la factory. Cette spec fournit seulement `LIVERY_CREDIT`.
- Mise à jour de `airlines-scraper/LICENSES.md` et archivage de l'accord (propriétaire).
- Chargement d'images à distance, mise en cache disque, images différentes par appareil ou par résolution.

## Contraintes
- **Critère de sortie** (`specs/ROADMAP.md`) : la tâche qui copie la première image dans `assets/tails/` n'est fusionnée qu'une fois les mentions du propriétaire (notice de crédit comprise) présentes dans l'application. La PR l'indique et le propriétaire le coche.
- Poids : les 133 images pèsent environ 7,9 Mo, ajoutés au bundle ; la PR le déclare. Pas de compression (copie à l'identique).
- Aucune dépendance nouvelle (`Image` de React Native, ADR-0001).
- `src/shared/airlines/index.ts` reste sans import de React Native et sans effet de bord au chargement.
- Zone sensible `**/assets/tails/` : `review:full`, revue humaine.

## Questions ouvertes
- Maquettes de la livrée (cadre, miroir ou non, taille) : attendues pour l'amendement ; aucun code d'affichage final avant.
- Exclusion des quatre compagnies à image dupliquée (TUI Fly Belgium, TUI Airways, Virgin Atlantic, Virgin Australia) : décision proposée par la spec, à confirmer par le propriétaire.
- Texte de la notice de crédit : le texte proposé couvre les livrées seules ; si l'accord impose une autre formulation, la remplacer à l'identique.
