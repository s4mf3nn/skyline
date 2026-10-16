# SPEC-0009 : Routes de vol et type d'appareil

Statut : BROUILLON
Risque estimé : élevé (crée `src/shared/routes/`, zone sensible de `docs/factory/RISK.md` : revue `full`, pas d'auto-merge ; réponse externe à valider, indicatif et adresse hexadécimale entrant dans le chemin de l'URL ; second hôte sortant, `api.adsbdb.com`)
Dépend de : SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007
Tests de contrat : `tests/acceptance/SPEC-0009.test.ts` (Vitest), `tests/acceptance/SPEC-0009.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0009.test.ts` et `tests/holdout/SPEC-0009.native.test.tsx` (ne pas les décrire ici)

## Objectif
Quand l'observateur regarde un avion, il sait d'où il vient et où il va : les codes et les villes d'origine et de destination apparaissent sur Ciel et sur les cartes de Prochains passages, avec le type d'appareil. Ciel montre en plus l'heure d'arrivée estimée et la progression du vol, calculées sur l'appareil (ADR-0003, option 1) et libellées comme des estimations. Quand la route ou le type est inconnu, l'écran reste exactement ce qu'il était : rien n'est inventé et l'avion s'affiche sans attendre.

## Acteurs et rôles
Aucun rôle (module sans action exposée). L'observateur n'a pas de compte ; il n'agit sur rien dans cette spec.

## Critères d'acceptation
Le client vit dans `src/shared/routes/` : `adsbdb.ts` (jamais importé par `index.ts`, comme `adsblol.ts` pour la source ADS-B) ; l'interface, le faux, le cache de session, les estimations et les formats dans `src/shared/routes/index.ts` ; le crochet de lecture et les composants dans `src/shared/routes/hooks.ts` et `block.tsx`. Les tests chargent `adsbdb.ts` par son chemin. Heures et durées s'entendent en millisecondes. Tolérances : distances ±0,5 km, heures estimées ±1 s, progression ±0,001.

Client adsbdb.com (Vitest, `tests/acceptance/SPEC-0009.test.ts`, avec un faux de `fetch` injecté) :

- **CA1** : (ADR-0002, INV7) `normalizeCallsign(callsign)` rend l'indicatif sans blancs de début ni de fin (`String.prototype.trim`), en majuscules, s'il respecte `^[A-Z0-9]{2,8}$`, sinon `null` (`" afr1015 "` donne `AFR1015` ; `null`, `""`, `"A"`, neuf caractères, `AF R1`, `AFR1015/..`, `AFR1015?x=1`, `AFR%2F1`, `ÀFR1` et tout caractère de contrôle donnent `null`). `buildCallsignUrl(callsign)` rend `https://api.adsbdb.com/v0/callsign/<indicatif normalisé>` ou `null` quand l'indicatif est refusé : l'hôte et le chemin sont fixes, jamais construits à partir d'une donnée reçue.
- **CA2** : `buildAircraftUrl(hex)` rend `https://api.adsbdb.com/v0/aircraft/<hex en minuscules>` si `hex` (sans blancs de début ni de fin) est formé de six chiffres hexadécimaux, sinon `null` (`"3944ED"` donne `…/3944ed` ; `"39 44ED"`, `"~3944ed"`, `"3944ed/x"`, `"3944e"`, `"3944edd"` donnent `null`).
- **CA3** : `createAdsbdbRouteSource({ fetch })` rend une `RouteSource` dont `fetchRoute(callsign)` appelle `fetch` **une seule fois**, en `GET`, sur l'URL de CA1, avec un `AbortSignal`, sans corps, sans paramètre de requête et avec pour seul en-tête `Accept` (INV7 : la position de l'observateur n'est nulle part dans la requête). Un indicatif refusé par CA1 rend `null` **sans appeler** `fetch`.
- **CA4** : une réponse `{"response":{"flightroute":{…}}}` donne un `FlightRoute` : `origin` et `destination` portent chacun `iata` (`iata_code`, 3 caractères `[A-Z0-9]`, sinon `null`), `city` (`municipality` rognée, `null` si vide ou si ce n'est pas une chaîne), `latitude` et `longitude` (nombres finis dans [-90, 90] et [-180, 180], sinon `null`). Un champ absent ou invalide vaut `null` sans rejeter la route (INV6). Un `origin` ou un `destination` absent ou qui n'est pas un objet donne un aéroport dont les quatre champs valent `null`. Les champs superflus (compagnie, pays, élévation…) sont ignorés.
- **CA5** : un indicatif inconnu de la base (corps `{"response":"unknown callsign"}`, statut 404 ou 200) rend `null` : c'est une réponse définitive, pas une erreur.
- **CA6** : (INV6) toute autre réponse fait rejeter `fetchRoute` avec `ROUTE_UNAVAILABLE` : rejet de `fetch`, statut hors 2xx autre que le 404 de CA5 (400, 429, 500…), corps qui n'est pas du JSON ou pas un objet, `response` ni objet ni chaîne `unknown callsign`, `flightroute` absent, `null` ou qui n'est pas un objet, ou requête sans réponse après `ROUTE_REQUEST_TIMEOUT_MS` (8 000 ms ; le signal est alors avorté, et le rejet a lieu même si `fetch` ignore le signal). Le message de l'erreur ne contient ni l'URL ni le corps reçu.
- **CA7** : `fetchAircraftType(hex)` appelle `fetch` une seule fois sur l'URL de CA2 (mêmes contraintes de requête que CA3) et rend `response.aircraft.type` rogné quand c'est une chaîne non vide de 40 caractères ou moins (`"A319 111"`) ; `null` quand le champ est absent, vide, trop long ou n'est pas une chaîne, et pour un appareil inconnu (`{"response":"unknown aircraft"}`, statut 404 ou 200). Un `hex` refusé par CA2 rend `null` sans appeler `fetch`. Les échecs de CA6 s'appliquent, avec `response` ni objet ni chaîne `unknown aircraft` et `aircraft` absent, `null` ou qui n'est pas un objet.

Cache de session (Vitest, même fichier, avec la source factice et l'horloge factice) :

- **CA8** : `createFlightLookup({ source, clock })` rend un `FlightLookup`. `route(callsign)` rend `{ status: "found", value }` ou `{ status: "unknown" }` (réponses définitives) ou `{ status: "unavailable" }` (la source a rejeté). Une réponse définitive est gardée : le même indicatif (avant ou après normalisation, `"afr1015"` et `"AFR1015 "`) n'appelle la source qu'**une fois** pour toute la session. Des appels simultanés pour un même indicatif partagent une seule requête. `aircraftType(hex)` suit les mêmes règles (clé : `hex` en minuscules ; `found` porte le type).
- **CA9** : une réponse `unavailable` n'est pas gardée mais bloque la source pendant `ROUTE_RETRY_AFTER_MS` (10 000 ms, mesurés sur l'horloge injectée) : un appel pendant ce délai rend `unavailable` sans appeler la source (`9_999` ms : aucun appel ; `10_000` ms : un appel) ; un appel qui réussit ensuite est gardé. Le délai est tenu par indicatif et par `hex` : l'échec d'un indicatif ne bloque pas les autres.
- **CA10** : un indicatif refusé par CA1 ou `null` rend `{ status: "unknown" }` et un `hex` refusé par CA2 aussi, sans appeler la source et sans rien garder.

Estimations et formats (Vitest, même fichier) :

- **CA11** : `estimateFlight({ route, position, groundSpeedKmh, nowMs })` (ADR-0003, option 1 ; `position` est celle de l'avion à `nowMs`) rend `{ progress, arrivalMs }`. `progress` = distance de l'origine à `position` divisée par la distance de l'origine à la destination (orthodromies), bornée à [0, 1] ; `arrivalMs` = `nowMs` + distance de `position` à la destination ÷ `groundSpeedKmh`, arrondi à la milliseconde. `progress` vaut `null` quand une coordonnée de l'origine ou de la destination manque ou que les deux aéroports sont à moins de 1 km l'un de l'autre ; `arrivalMs` vaut `null` quand la coordonnée de la destination manque ou que la vitesse est `null` ou ≤ 0. Chacun est calculé sans l'autre.
- **CA12** : `formatRouteCodes(route)` rend `{ origin, destination }` (les codes IATA) ou `null` quand l'un des deux manque ; `formatRouteCities(route)` rend `"<ville d'origine> → <ville de destination>"` (flèche U+2192, espaces ordinaires) ou `null` quand l'une des deux manque ; `formatEstimatedArrival(timestampMs, timeZone)` rend `~HH:MM` (tilde U+007E, heure locale sur 24 h, zéros de tête, secondes tronquées, fuseau IANA reçu : `1_800_000_000_000` donne `~09:00` en `Europe/Paris`, `~21:00` en `Pacific/Auckland`).

Écrans (Jest, `tests/acceptance/SPEC-0009.native.test.tsx`, joués par `createApp` avec les faux de `src/shared/`, le fichier de `feature` de Prochains passages et celui de Ciel, et un `FlightLookup` construit sur la source factice) :

- **CA13** : `AppServices.routes` est un champ facultatif (`FlightLookup`). Sans lui, aucune route ni aucun type n'est affiché, aucun élément `passage-route-<hex>` ni `ciel-route-*` n'est rendu, l'appareil vaut `—` et rien ne plante.
- **CA14** : une carte de Prochains passages dont l'avion a une route connue (`status: "found"`) affiche, dans l'élément `passage-route-<hex>`, les codes IATA empilés (origine puis destination) et la ligne des villes (CA12) ; la colonne Compagnie, Vol, Appareil montre le type d'appareil à la place de `—` quand il est connu. Les couleurs, la dérive et le reste de la carte sont ceux de SPEC-0006. La carte « En ce moment » montre le même bloc, et la même colonne.
- **CA15** : (repli) pour une route inconnue, un indicatif absent, une source indisponible ou une route pas encore reçue, la carte n'a aucun élément `passage-route-<hex>` et le reste de la carte est celui de SPEC-0006 ; un type inconnu laisse `—`. Une route dont les codes manquent n'affiche pas les codes, une route dont une ville manque n'affiche pas la ligne des villes : chaque ligne n'est montrée que complète.
- **CA16** : (Ciel) quand Ciel montre un avion (survol en cours), la route de cet avion est rendue sous les éléments `ciel-route-codes` (les deux codes, origine puis destination), `ciel-route-cities` (ligne des villes) et `ciel-route-times` : la ligne des heures montre `—` à gauche (`ciel-route-departure`, le départ n'est pas estimé) et l'arrivée estimée à droite (`ciel-route-arrival`, `formatEstimatedArrival` de `estimateFlight`, fuseau de l'appareil) ; la barre de progression est un élément de rôle `progressbar` nommé « Progression du vol » (`ciel-route-progress`), dont la valeur est exposée par `accessibilityValue = { min: 0, max: 100, now }` avec `now = round(100 × progress)`. Le type d'appareil remplace `—` dans la valeur Appareil de la colonne d'infos (`ciel-aircraft-type`).
- **CA17** : (Ciel, repli) route inconnue, absente ou pas encore reçue : aucun élément `ciel-route-*` n'est rendu ; type inconnu : `ciel-aircraft-type` vaut `—`. Route connue : les codes ne sont rendus que si les deux codes sont connus et la ligne des villes que si les deux villes le sont, chacune indépendamment de l'autre (CA12) ; la barre de progression n'est rendue que si `progress` n'est pas `null`, la ligne des heures (`ciel-route-times`, `ciel-route-departure`, `ciel-route-arrival`) que si `arrivalMs` n'est pas `null`, chacune indépendamment de l'autre (origine sans coordonnées : arrivée sans barre ; aucune coordonnée : ni l'une ni l'autre). Un survol en cours a toujours une vitesse (INV1) : l'arrivée n'est absente que faute de coordonnée de destination.
- **CA18** : (hors du cycle de 10 s) l'attente d'une réponse des routes ne retient pas l'affichage : avec une source qui ne répond pas encore, les cartes et Ciel sont rendus tout de suite avec leur repli, puis la route apparaît à la réponse, sans autre rafraîchissement de la scène.
- **CA19** : (reprise) quand la source des routes est indisponible à la première demande, le repli de CA15 s'affiche ; à la reprise de la source, le crochet redemande au premier rafraîchissement de la scène dont l'heure atteint `ROUTE_RETRY_AFTER_MS` après l'échec et la route apparaît ; avant, la source n'est pas rappelée. Une route définitive (trouvée ou inconnue) n'est plus jamais redemandée, même après plusieurs rafraîchissements.
- **CA20** : (une demande par avion affiché) pour une scène avec un survol et des passages, la source des routes reçoit une demande de route par indicatif et une demande de type par `hex`, une seule fois chacune, que l'avion soit montré par Ciel, par une carte ou par les deux ; jamais pour un avion que la scène ne montre pas (11e passage et suivants, hors rayon, sans survol ni passage) ; jamais de demande de route pour un avion sans indicatif.
- **CA21** : (INV7) un parcours complet (chargement, bascule, rafraîchissements, source indisponible puis rétablie) n'envoie rien au suivi des erreurs (`monitoring.events` reste vide), n'écrit rien dans les logs (`console.log`, `info`, `warn`, `error`), et les arguments reçus par la source des routes sont uniquement des indicatifs normalisés et des `hex` : aucune coordonnée, aucun cap du téléphone.

## Cas limites
- Indicatif à tiret, à espace interne, à plus de 8 caractères, ou avec un caractère de chemin : jamais envoyé (CA1) ; l'avion s'affiche sans route.
- Indicatif valide mais sans vol connu (privé, militaire) : `unknown`, gardé, jamais redemandé (CA8).
- Source indisponible, 429 ou panne d'adsbdb.com : repli, réessai au plus toutes les 10 s par avion (CA9, CA19), sans effet sur la scène ni sur la source ADS-B.
- Deux avions de même indicatif dans la scène : une seule demande (CA8), le même bloc sur les deux.
- Avion dont l'indicatif change entre deux instantanés : la route suit le nouvel indicatif ; l'ancienne reste en mémoire pour la session.
- Aéroport d'origine égal à l'aéroport de destination (vol local) ou distance < 1 km : progression `null`, codes et villes affichés (CA11).
- Avion qui a dépassé sa destination ou qui s'en écarte : progression bornée à 100 %, arrivée estimée calculée sur la distance restante (CA11).
- Avion retenu par Ciel (INV9) : il garde les dernières valeurs affichées, route comprise ; c'est la règle de présence de SPEC-0005, non rejouée ici.
- Aucune limite de taille du cache : borné par le nombre d'avions distincts vus pendant la session.
- Fuseau à décalage de 30 minutes : l'arrivée estimée est en heure locale de l'appareil (CA12).

## Contrat d'interface
`src/shared/routes/index.ts` (logique pure et faux ; seuls imports : `src/shared/scene/index.ts` pour la distance, `src/shared/clock/index.ts` et `src/shared/errors.ts`) :

```ts
interface Airport {
  iata: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
}
interface FlightRoute { origin: Airport; destination: Airport }

/** Source des routes (ADR-0002). `null` : réponse définitive « inconnu ». Rejette avec `ROUTE_UNAVAILABLE`. */
interface RouteSource {
  fetchRoute(callsign: string): Promise<FlightRoute | null>
  fetchAircraftType(hex: string): Promise<string | null>
}

type LookupResult<T> = { status: "found"; value: T } | { status: "unknown" } | { status: "unavailable" }
interface FlightLookup {
  route(callsign: string | null): Promise<LookupResult<FlightRoute>>
  aircraftType(hex: string): Promise<LookupResult<string>>
}

ROUTE_REQUEST_TIMEOUT_MS = 8_000; ROUTE_RETRY_AFTER_MS = 10_000

normalizeCallsign(callsign: string | null): string | null
createFlightLookup(input: { source: RouteSource; clock: Clock }): FlightLookup
estimateFlight(input: { route: FlightRoute; position: Position; groundSpeedKmh: number | null; nowMs: number }):
  { progress: number | null; arrivalMs: number | null }
formatRouteCodes(route: FlightRoute): { origin: string; destination: string } | null
formatRouteCities(route: FlightRoute): string | null
formatEstimatedArrival(timestampMs: number, timeZone: string): string

createFakeRouteSource(data?: {
  routes?: Record<string, FlightRoute | null>      // clé : indicatif normalisé ; `null` : inconnu
  aircraftTypes?: Record<string, string | null>    // clé : hex en minuscules
}): RouteSource & {
  readonly routeRequests: string[]                 // arguments reçus, dans l'ordre
  readonly typeRequests: string[]
  setUnavailable(unavailable: boolean): void       // rejette avec `ROUTE_UNAVAILABLE`
  holdResponses(): void                            // les réponses suivantes restent en attente…
  releaseResponses(): void                         // … jusqu'à cet appel
}
// Une clé absente de `routes` ou de `aircraftTypes` vaut « inconnu » (`null`). Chaque demande est enregistrée à
// l'appel ; l'état `unavailable` est lu au moment de la réponse (à la libération quand les réponses sont retenues).
```

`src/shared/routes/adsbdb.ts` : `buildCallsignUrl`, `buildAircraftUrl`, `createAdsbdbRouteSource({ fetch })`, `ROUTE_REQUEST_TIMEOUT_MS`, avec `fetch` de la forme `(url, { method: "GET", headers, signal }) => Promise<{ ok, status, json() }>`. Importé par `src/main.tsx` seulement, jamais par `index.ts`.

`src/shared/routes/hooks.ts` : `useFlightInfo(hex, callsign)` rend `{ route: FlightRoute | null; aircraftType: string | null }` ; il lit `useServices().routes` et `useScene()` (SPEC-0004) : il demande au montage et à chaque nouvel instantané tant que la réponse n'est pas définitive, et rend `null` pour tout ce qui n'est pas `found`. `src/shared/routes/block.tsx` : composants `RouteBlock` (cartes) et `SkyRouteBlock` (Ciel), qui lisent `useFlightInfo`.

`src/shared/errors.ts` : `ErrorCode` gagne `ROUTE_UNAVAILABLE`. `src/shared/services/index.tsx` : `AppServices.routes?: FlightLookup`. `src/main.tsx` construit `createFlightLookup({ source: createAdsbdbRouteSource({ fetch }), clock })` .

## Écrans
- **Prochains passages** : pas de maquette dédiée ; le handoff fait foi (`docs/brief/design_handoff_skyline_ciel_passages/README.md`, section « Écran 2 », bas droite : codes empilés 64 pt, villes 13 pt, colonne Compagnie, Vol, Appareil). États : bloc route présent (CA14) ou absent (CA15), type connu ou `—`. Aucune action.
- **Ciel** : pas de maquette dédiée ; le handoff fait foi (section « Écran 1 » : codes empilés 140 pt, villes 22 pt, heures 22 pt justifiées, barre de progression de 6 pt sans repère rond, valeur Appareil 40 pt). États : route complète (CA16) ou partielle ou absente (CA17). Écarts décidés par le propriétaire (2026-10-14) : l'heure de départ n'est pas estimée (`—` à sa place), l'heure d'arrivée est précédée de `~` ; le bloc route est masqué sans route. Les tailles, la position et les couleurs (`theme.big`, `theme.small`, `track`) ne sont pas testées : vérifiées par la capture sur cible réelle. `testID` : `ciel-route-codes`, `ciel-route-cities`, `ciel-route-times`, `ciel-route-departure`, `ciel-route-arrival`, `ciel-route-progress`, `ciel-aircraft-type` (SPEC-0005 les reprend ; elle ne les déplace pas).

## Parcours sur cible réelle
- Sur simulateur iPhone avec un avion réel au-dessus (adsb.lol puis adsbdb.com, réseau réel) : le bloc route apparaît sur Ciel et sur la carte en moins de quelques secondes sans retarder l'avion, et disparaît proprement pour un avion privé sans route. Vérifié à la main dans la PR de la dernière tâche (capture jointe) : ni le réseau réel ni la mise en page ne sont joués sous Jest.

## Hors périmètre
- Heures de départ, retards, statut du vol, horaires réels (option 3 de l'ADR-0003, au MVP, derrière le backend).
- Immatriculation, photo, constructeur, propriétaire de l'appareil (fiche avion, MVP) ; seul le champ `type` est lu.
- Images de dérive (SPEC-0010), états d'interface (SPEC-0008), présence de Ciel (SPEC-0005).
- Cache sur disque, préchargement des routes, relance avec délai croissant, détail d'une route (escales).
- Mentions légales et attribution des données d'adsbdb.com : réalisées par le propriétaire (voir « Contraintes »).
- Route déduite de la trajectoire quand la base ne la connaît pas.

## Contraintes
- La requête de routes ne porte que l'indicatif de l'avion (route) ou son adresse OACI `hex` (type) : jamais la position de l'observateur, jamais son cap (INV7) ; l'hôte `api.adsbdb.com` est une constante en `https`, jamais une donnée reçue ; l'indicatif et le `hex` sont validés par format avant d'entrer dans le chemin (CA1, CA2). Rien n'est loggé, ni envoyé au suivi des erreurs, ni écrit dans un message d'erreur.
- La réponse est validée à la frontière par **Zod 4** (déjà installé par SPEC-0007, ADR-0004) : les schémas vivent dans `src/shared/routes/`, jamais dans un écran. Aucune autre dépendance nouvelle.
- Les fonctions de normalisation, d'URL, d'estimation et de format sont pures (ni horloge directe, ni réseau) ; `fetch` et l'horloge sont injectés.
- Aucun calcul dans un `.tsx` (`docs/factory/UI.md`) : estimations, formats et choix d'affichage viennent de `src/shared/routes/index.ts`.
- Les estimations sont libellées comme telles (`~`) : jamais présentées comme des horaires réels (ADR-0003).
- Critère de sortie (propriétaire) : l'attribution éventuellement demandée par adsbdb.com est ajoutée aux mentions de l'application avant toute livraison aux testeurs ; elle n'est pas faite par les agents ni testée ici.
- La demande de route d'un avion n'est faite que s'il est affiché (CA20) ; le cycle de 10 s de la scène ne l'attend jamais (CA18).

## Décisions prises à la rédaction
Réponses du propriétaire (2026-10-14) : heure d'arrivée seule, préfixée de `~` ; type d'appareil inclus, par adsbdb `/v0/aircraft/{hex}` ; bloc route masqué quand la route est inconnue ; routes gardées pour la session, échec retenté au plus toutes les 10 s par avion. À confirmer à la relecture :
- La position de l'avion n'est pas dans `Passage` de SPEC-0004 : l'amendement ajoute `latitude` et `longitude` (position à `nowMs`, extrapolée en ligne droite comme `groundDistanceKm`) ; sans elle, ni la progression ni l'arrivée ne sont calculables. `estimateFlight` reçoit la position explicitement pour rester pure.
- Le type d'appareil affiché est le champ `type` d'adsbdb tel quel (`A319 111`), pas `icao_type` (`A319`) : plus proche du libellé du handoff (« A320neo »), rien n'est reformaté.
- Un indicatif ou un `hex` de format invalide donne « inconnu » (définitif, rien n'est envoyé), comme le veut l'ADR-0002.
- Les `testID` de Ciel (`ciel-route-*`, `ciel-aircraft-type`) sont posés ici car SPEC-0005 n'est pas écrite ; SPEC-0005 les reprend.
- `ROUTE_RETRY_AFTER_MS` est mesuré sur l'horloge injectée et la reprise attend un rafraîchissement de la scène : le réessai a donc lieu entre 10 s et 20 s après l'échec, pas à la seconde.
- `formatEstimatedArrival` est la troisième répétition du formatage `HH:MM` (après `formatLocalTime` de SPEC-0006 et `formatDataTime` de SPEC-0008) : la tâche le factorise dans `src/shared/` en gardant les exports existants (les contrats de SPEC-0006 et SPEC-0008 n'en changent pas).
- Départ « — » : une heure de départ estimée à rebours depuis la vitesse sol serait fausse (montée, attente au sol).
- Dépendances : SPEC-0004 s'entend telle qu'amendée (`Passage` porte la position de l'avion). La spec reste `BROUILLON` tant que les amendements de « Préalables avant `/plan` » ne sont pas fusionnés et que SPEC-0005 n'est pas écrite.

## Préalables avant `/plan`
Cette spec reste `BROUILLON` tant qu'ils ne sont pas fusionnés (même mécanisme que SPEC-0007 pour SPEC-0004) :
- Amendement de cadrage (`/roadmap`, PR de cadrage) : la requête d'un type d'appareil porte l'adresse `hex`, pas seulement l'indicatif. À amender : ADR-0002 (« La requête ne porte que l'indicatif »), `docs/DOMAIN.md` (INV7), `docs/PRODUCT.md` (« Données personnelles »), `docs/factory/DOMAIN-SECURITY.md` (ligne « La requête de routes de vol… ») et la note 2 de `specs/ROADMAP.md`. L'adresse `hex` identifie un avion, pas l'observateur : elle ne révèle pas sa position.
- Amendement de SPEC-0004 (`/new-spec SPEC-0004`) : `Passage` porte `latitude` et `longitude` de l'avion à `nowMs`.
- SPEC-0005 (à écrire) : reprend les `testID` de Ciel de cette spec et monte `SkyRouteBlock` et la valeur Appareil ; les tests Jest de Ciel de cette spec ne se jouent qu'une fois SPEC-0005 livrée.

## Questions ouvertes
Aucune.
