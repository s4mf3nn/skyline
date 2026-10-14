# SPEC-0007 : Données réelles adsb.lol

Statut : BROUILLON
Risque estimé : élevé (touche `src/shared/adsb/`, zone sensible : la position de l'observateur sort de l'appareil dans la requête ; ajoute une dépendance, Zod ; le minuteur de rafraîchissement vit dans le crochet de scène)
Dépend de : SPEC-0004, SPEC-0005, SPEC-0006 (SPEC-0004 telle qu'amendée : fournisseur commun de la scène, clause de non-rafraîchissement retirée, `onBackground`, voir « Décisions » ; la PR d'amendement est fusionnée avant `/plan SPEC-0007`, et cette spec reste `BROUILLON` tant qu'elle ne l'est pas)
Tests de contrat : `tests/acceptance/SPEC-0007.test.ts` (Vitest), `tests/acceptance/SPEC-0007.native.test.tsx` (Jest)
Scénarios cachés : `tests/holdout/SPEC-0007.test.ts` et `tests/holdout/SPEC-0007.native.test.tsx` (ne pas les décrire ici)

## Objectif
L'application montre de vrais avions : elle interroge adsb.lol autour de la position de l'observateur, convertit et valide la réponse, puis rafraîchit l'instantané toutes les 10 secondes tant qu'elle est au premier plan. Une réponse imparfaite ou une source en panne ne plante jamais l'application et ne dégrade pas ce qui est déjà affiché. Aucun écran ne change : Ciel et Prochains passages lisent la scène de SPEC-0004 comme avant.

## Acteurs et rôles
Aucun rôle (module sans action exposée). L'observateur n'a pas de compte ; il n'agit sur rien dans cette spec.

## Critères d'acceptation
Le client vit dans `src/shared/adsb/` (fichier `adsblol.ts`, jamais importé par `src/shared/adsb/index.ts`, comme `expo.ts` pour la localisation) ; le choix de la source dans `src/shared/adsb/select.ts`. Les tests chargent ces modules par leur chemin. Les valeurs numériques s'entendent aux tolérances suivantes : altitude ±1 m, vitesse ±0,1 km/h, position ±0,05 km.

Client adsb.lol (Vitest, `tests/acceptance/SPEC-0007.test.ts`, avec un faux de `fetch` injecté) :

- **CA1** : (INV7) `buildAdsbLolUrl(query)` rend `https://api.adsb.lol/v2/point/<lat>/<lon>/<rayon>` : l'hôte et le chemin sont fixes, latitude et longitude sont arrondies à 3 décimales et écrites sans zéros de fin, jamais en notation exponentielle ni `-0` (`45.764`, `4.836`, `45.5`, `0` pour `-0.0004`), le rayon est en milles nautiques, `radiusKm / 1,852` arrondi à l'entier supérieur et plafonné à 250 (80 km donne `44`, 10 km donne `6`, 1 000 km donne `250`). La requête ne porte rien d'autre : aucun paramètre, aucun corps, aucun en-tête contenant la position.
- **CA2** : `createAdsbLolSource({ fetch })` rend une `AdsbSource` dont `fetchAircraft(query)` appelle `fetch` **une seule fois**, en `GET`, sur l'URL de CA1, avec un `AbortSignal`, puis convertit chaque avion de `ac` en `Aircraft`, dans l'ordre de `ac` : `hex` en minuscules, `callsign` (`flight` sans blancs de début ni de fin, `null` s'il est vide ou absent), `latitude` (`lat`), `longitude` (`lon`), `altitudeM` (`alt_baro` en pieds × 0,3048), `groundSpeedKmh` (`gs` en nœuds × 1,852), `trackDeg` (`track`). Les champs superflus de la réponse sont ignorés.
- **CA3** : un avion au sol (`alt_baro` égal à `"ground"`) est écarté de la liste. Un avion à `gs` nul reste (c'est SPEC-0004 qui n'en tire aucun passage).
- **CA4** : (âge de la position) la position de chaque avion est ramenée à l'heure de la réponse : elle est avancée en ligne droite de `seen_pos` secondes, au cap et à la vitesse sol de l'avion. `seen_pos` absent, invalide ou négatif vaut 0 ; sans cap ou sans vitesse connus la position n'est pas modifiée. Aucun seuil d'âge : un avion n'est jamais écarté pour son âge. Le déplacement est calculé en approximation locale (rayon terrestre 6371 km, correction de longitude par le cosinus de la latitude de départ). La longitude recalée est ramenée dans [-180, 180] par enroulement ; l'avion est écarté si sa latitude de départ vaut ±90 et que son déplacement est non nul (vitesse > 0 et `seen_pos` > 0), ou si la latitude recalée sort de [-90, 90].
- **CA5** : (INV6) un champ absent ou invalide vaut `null` sans retirer l'avion : `flight` qui n'est pas une chaîne, `alt_baro` ni nombre fini ni `"ground"`, `gs` négatif ou non fini, `track` hors de [0, 360] ou non fini. Une entrée de `ac` qui n'est pas un objet est écartée, comme un avion dont le `hex` n'est pas formé de six chiffres hexadécimaux (adresses non OACI, préfixe `~` compris) ou dont `lat` ou `lon` n'est pas un nombre dans sa plage (latitude [-90, 90], longitude [-180, 180]) est écarté : sans identité ni position il ne peut pas être placé.
- **CA6** : (INV6) une réponse illisible fait rejeter `fetchAircraft` avec `ADSB_UNAVAILABLE` : corps qui n'est pas du JSON, qui n'est pas un objet, `ac` absent ou qui n'est pas un tableau. Une réponse `{"ac": []}` rend la liste vide.
- **CA7** : une erreur du réseau (rejet de `fetch`), un statut HTTP hors 2xx ou une requête sans réponse après `ADSB_REQUEST_TIMEOUT_MS` (8 000 ms ; le signal est alors avorté, et le rejet a lieu même si `fetch` ignore le signal) rejettent avec `ADSB_UNAVAILABLE`, jamais une autre erreur. Le message de l'erreur ne contient aucune coordonnée, quelle que soit la cause du rejet (réseau, statut, réponse illisible, délai, requête invalide). Une requête dont la latitude, la longitude ou le rayon est invalide (non fini, latitude hors de [-90, 90], longitude hors de [-180, 180], rayon ≤ 0) rejette avec `ADSB_UNAVAILABLE` **sans appeler** `fetch`.
- **CA8** : `chooseAdsbSource({ isDev, requested })` rend `"demo"` seulement si `isDev` est vrai et `requested` vaut exactement `"demo"` ; sinon `"real"` (y compris `requested` absent, `"DEMO"` ou `" demo"`). `src/main.tsx` le lit avec `__DEV__` et `EXPO_PUBLIC_ADSB_SOURCE`, et branche `createAdsbLolSource({ fetch })` pour `"real"`, la source de SPEC-0006 pour `"demo"` : ce câblage, sans logique, est hors contrat (module natif, comme `expo.ts`) et vérifié par le relecteur.

Rafraîchissement (Jest, `tests/acceptance/SPEC-0007.native.test.tsx`, sous `createApp` avec les faux de `src/shared/` et `jest.useFakeTimers()`) :

- **CA9** : une fois la scène prête, le crochet `useScene` interroge de nouveau la source à chaque `REFRESH_INTERVAL_MS` (10 s d'horloge, à partir de la première requête, ou du montage tant qu'aucune requête n'a pu partir), avec la dernière position lue arrondie à 3 décimales et le rayon de 80 km. Chaque réponse remplace l'instantané (`snapshotAtMs` = heure de la réponse) sans repasser par `loading`. La permission et la position ne sont pas relues.
- **CA10** : l'échéance de 10 s n'empile jamais deux requêtes : quand la requête précédente n'a pas répondu à l'échéance, cette échéance est sautée (pas de rattrapage) et la cadence reprend à l'échéance d'après.
- **CA11** : (INV9, cycle « Données affichées ») à l'entrée en arrière-plan (`lifecycle.enterBackground()`), plus aucun rafraîchissement ni recalcul de la scène chaque seconde ; la scène exposée ne change plus. Au retour au premier plan, il y a **une seule** requête (celle de SPEC-0004 CA15 : position relue, source interrogée), la scène est recalculée à l'heure courante, et la cadence de 10 s repart de ce retour. Une requête encore en vol au retour au premier plan n'empêche pas cette requête de retour (la position a pu changer) : sa réponse, plus ancienne, est ignorée (SPEC-0004, seule la plus récente est gardée). Une réponse qui arrive pendant la pause est ignorée. Sans service `lifecycle`, le rafraîchissement ne s'arrête jamais.
- **CA12** : une requête en échec (source indisponible ou erreur quelconque) n'interrompt pas la cadence : la dernière scène reste exposée et recalculée chaque seconde (SPEC-0004 CA17), la source est interrogée à l'échéance suivante, et la première réponse qui réussit remplace l'instantané. Sans instantané antérieur, `status` reste `unavailable` puis passe à `ready` à la première réponse qui réussit ; si aucune position n'a pu être lue (échec autre que `LOCATION_DENIED`), chaque échéance relit la permission et la position avant d'interroger la source. Rien n'est envoyé au suivi des erreurs et aucune coordonnée n'est loggée.
- **CA13** : permission refusée : aucune échéance n'interroge la source (SPEC-0004 CA14). Quand la permission est de nouveau accordée au retour au premier plan, la cadence reprend.
- **CA14** : au démontage, l'échéance est annulée : aucune requête après, aucune erreur loggée, y compris pour une requête encore en vol dont la réponse arrive après le démontage.
- **CA15** : `refresh()` envoie une requête tout de suite et n'avance ni ne décale l'échéance de 10 s : l'échéance suivante interroge la source à l'heure prévue. Appelé alors qu'une requête est en vol, il envoie sa requête quand même : la réponse la plus récente l'emporte (SPEC-0004).

## Cas limites
- Liste `ac` vide : `fetchAircraft` rend `[]`, la scène est vide.
- Même `hex` deux fois : les deux sont rendus (SPEC-0004 CA6 ne garde que la première occurrence).
- `flight` formé de blancs seulement : `callsign` vaut `null`.
- `seen_pos` très grand (avion vu il y a des minutes) : recalé comme les autres, sans seuil ; limite connue de la prévision en ligne droite.
- Position (arrondie) à l'équateur ou au méridien de Greenwich : écrite `0`, jamais `-0`.
- Réponse en retard d'une requête plus ancienne : seule la plus récente est gardée (SPEC-0004).
- Arrondi des coordonnées : au plus proche, `Math.round` sur la valeur ×1000 ; une valeur négative à égalité exacte n'est pas testée.
- Le délai d'attente de CA7 couvre l'attente de la réponse ; la lecture du corps n'est pas bornée à part (limite connue).
- Horloge de l'appareil décalée : sans effet sur le recalage, qui n'utilise que `seen_pos`.
- Réseau coupé puis rétabli : l'échéance suivante rétablit la scène (CA12).

## Contrat d'interface
`src/shared/adsb/adsblol.ts` :

```ts
const ADSB_REQUEST_TIMEOUT_MS = 8000

interface FetchResponse { ok: boolean; status: number; json(): Promise<unknown> }
type FetchLike = (url: string, init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }) => Promise<FetchResponse>

buildAdsbLolUrl(query: AdsbQuery): string               // lève ADSB_UNAVAILABLE si la requête est invalide
createAdsbLolSource(options: { fetch: FetchLike }): AdsbSource
```

`src/shared/adsb/select.ts` : `chooseAdsbSource(input: { isDev: boolean; requested: string | undefined }): "demo" | "real"`.

`src/shared/lifecycle/index.ts` (SPEC-0004, étendu) : `AppLifecycle` gagne `onBackground(listener: () => void): () => void` (appelé à chaque passage de l'app à `inactive` ou `background` depuis `active`, plus jamais après la fonction de désabonnement) ; `createFakeLifecycle()` gagne `enterBackground()`. L'implémentation `AppState` de React Native l'appelle comme `onForeground`.

`useScene` (SPEC-0004) garde sa signature ; `refresh()` reste disponible (CA15). `src/shared/errors.ts` n'a pas de nouveau code : `ADSB_UNAVAILABLE` couvre toute source inutilisable.

## Hors périmètre
- États d'interface, textes et délai de péremption des données (SPEC-0008).
- Route de vol, adsbdb.com, heures et progression (SPEC-0009).
- Écrans Ciel et Prochains passages : rien n'est dessiné.
- Mentions légales dont l'attribution ODbL : réalisées par le propriétaire (voir « Contraintes »).
- Seuil d'âge de la position, relance avec délai croissant, cache disque des réponses.
- Suivi de la position en continu.

## Contraintes
- La position ne sort de l'appareil que dans l'URL de la requête à `api.adsb.lol`, en `https`, arrondie à 3 décimales (INV7) ; l'hôte n'est jamais construit à partir d'une donnée reçue. Elle n'est ni loggée, ni envoyée au suivi des erreurs, ni écrite dans un message d'erreur. Le calcul local garde la position exacte.
- Validation à la frontière par **Zod 4** (`zod`, version épinglée à l'installation, `4.6.x`), décision de l'ADR-0004 : les schémas vivent dans `src/shared/adsb/`, jamais dans un écran. Aucune autre dépendance nouvelle. La tâche vérifie la compatibilité Hermes (pas de `eval` ni de `new Function` requis ; `jitless` sinon), passe l'ADR-0004 à « acceptée » et renvoie vers elle la ligne « Validation des entrées » de l'ADR-0001.
- Les fonctions de conversion, de recalage et de validation sont pures (ni horloge directe, ni réseau) ; `fetch` et le minuteur sont injectés ou fournis par le crochet.
- Le minuteur et la pause en arrière-plan vivent dans le crochet de scène de SPEC-0004 : cette spec lève la clause « ne rafraîchit pas de lui-même » de SPEC-0004 CA13 et le test `CA13 : never refreshes by itself every 10 seconds` (voir « Décisions »).
- Critère de sortie (propriétaire, `docs/PRODUCT.md`) : l'attribution ODbL d'adsb.lol est présente dans l'application avant toute livraison aux testeurs. Elle n'est pas faite par les agents et n'est pas testée ici ; le propriétaire la coche avant `pnpm release`.
- La source de démonstration n'est jamais branchée hors `__DEV__`, et seulement si `EXPO_PUBLIC_ADSB_SOURCE=demo` (CA8).

## Décisions prises à la rédaction
Réponses du propriétaire : Zod 4 ; recalage de la position par `seen_pos` sans seuil ; minuteur dans le crochet de scène ; source réelle par défaut en développement, démonstration par variable explicite. À confirmer à la relecture :
- Conflit avec SPEC-0004 : son CA13 et son test `never refreshes by itself every 10 seconds` disent le contraire de CA9. L'amendement de SPEC-0004 prévu par la roadmap (fournisseur commun de la scène) supprime cette clause et ce test, et ajoute `onBackground` à `AppLifecycle` ; il est fusionné avant `/plan SPEC-0007`.
- Adresses non OACI (`hex` préfixé `~`, TIS-B) écartées : elles ne respectent pas le contrat de `Aircraft.hex` et l'identité d'un avion n'est pas stable.
- `alt_baro` seul donne l'altitude : pas de repli sur `alt_geom` (rien n'est inventé).
- Rayon arrondi à l'entier de milles supérieur (l'API prend un entier, plafond 250).
- Un seul code d'erreur, `ADSB_UNAVAILABLE`, pour toute source inutilisable (réseau, statut, réponse illisible, requête invalide).
- Délai d'attente de 8 s, inférieur à la cadence de 10 s ; l'échéance sautée de CA10 couvre le cas limite.
- Réponse de l'API observée le 2026-10-14 : `{ac, msg, now, total}`, `alt_baro` en pieds ou `"ground"`, `gs` en nœuds, `flight` complété de blancs, `seen_pos` en secondes.

## Questions ouvertes
Aucune.
