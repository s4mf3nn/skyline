# Plan SPEC-0007
Statut : PRÊT
Questions : aucune

Constats partagés :
- **Préalable fait** : l'amendement de SPEC-0004 est sur main (`onBackground` dans `AppLifecycle`, `enterBackground()` dans le faux, implémentation `AppState` ; test « never refreshes by itself » retiré).
- **Interface figée** : celle du « Contrat d'interface » de la spec. Aucun nouveau code d'erreur : tout rejet est `new AppError("ADSB_UNAVAILABLE", "ADS-B source unavailable")`, message fixe sans coordonnée.
- **Isolation** : `src/shared/adsb/index.ts` n'importe jamais `adsblol.ts` ni les fichiers qui importent `zod` ; seul `src/main.tsx` les charge.
- **Contrats** : `tests/acceptance/SPEC-0007.test.ts` et `SPEC-0007.native.test.tsx` gardent leur `describe.skip` jusqu'à T3. Une tâche peut retirer un `.skip` en local pour vérifier ses critères, sans commiter ce retrait.
- **Zod 4.6.x** (Context7 `/colinhacks/zod/v4.6.5`, absent du cache) : la compilation rapide passe par `new Function` ; `z.config({ jitless: true })` la désactive. Fallback par champ : `.catch(null)`.

## Groupe 1 (parallèle)
### T1 : Lecture et recalage de la réponse adsb.lol (Zod)
- Périmètre : src/shared/adsb/adsblol-response.ts, src/shared/adsb/adsblol-response.test.ts, src/shared/adsb/position-age.ts, src/shared/adsb/position-age.test.ts, package.json, pnpm-lock.yaml, docs/adr/0004-validation-des-entrees.md, docs/adr/0001-stack.md, docs/factory/libs-cache.md
- Dépend de : aucune
- Risque : élevé (zone sensible `src/shared/adsb/`, réponse externe à valider (INV6), nouvelle dépendance)
- Critères de la spec couverts : CA2, CA3, CA4, CA5, CA6
- Définition de fini : `pnpm verify` vert ; `zod` épinglé en `4.6.x` exact dans `package.json` ; tests unitaires de chaque règle de CA2 à CA6 (conversion d'unités, `"ground"` écarté, `gs` nul gardé, `hex` `~…` écarté, champs invalides à `null`, `seen_pos` absent ou négatif à 0, enroulement de longitude, pôle avec déplacement écarté, corps non objet ou `ac` non tableau rejetés, `{ac: []}` vide) ; ADR-0004 à « acceptée » (Zod 4, `jitless`, compatibilité Hermes) et ligne « Validation des entrées » de l'ADR-0001 en `choisie`, renvoyant à l'ADR-0004 ; une entrée `zod 4.6.x` au cache. Contrats : `.skip` laissé. Interface figée ci-dessus.
- Conception :
  ```diff
   src/shared/adsb
  +├── adsblol-response.ts       # NOUVEAU : schémas Zod, corps → Aircraft[] (pur)
  +├── adsblol-response.test.ts
  +├── position-age.ts           # NOUVEAU : recalage par seen_pos (pur, sans Zod)
  +└── position-age.test.ts
  ~package.json                  # MODIFIÉ : zod 4.6.x
  ```
  ```ts
  // adsblol-response.ts : z.config({ jitless: true }) en tête de module
  parseAdsbLolBody(body: unknown): Aircraft[]   // lève AppError ADSB_UNAVAILABLE (CA6)
  // position-age.ts
  advanceBySeenPos(aircraft: Aircraft, seenPosS: number): Aircraft | null  // null = écarté (CA4)
  ```
  ```diff
   parseAdsbLolBody(body)
  +  responseSchema.safeParse(body)            # { ac: unknown[] }, sinon ADSB_UNAVAILABLE
  +  pour chaque entrée : entrySchema.safeParse(entry)  # hex /^[0-9a-f]{6}$/i, lat, lon obligatoires ; autres champs .catch(null)
  +    toAircraft(entry)                        # unités, "ground" → écarté, flight.trim() || null
  +    advanceBySeenPos(aircraft, seenPos)      # rayon 6371 km, cos(lat de départ)
  ```
  Ordre de construction :
  1. `parseAdsbLolBody` sur un avion complet → `Aircraft` converti, et rejets de CA6 ; vérifié par `adsblol-response.test.ts`.
  2. Champs invalides à `null`, entrées écartées (CA3, CA5) ; mêmes tests, cas par champ.
  3. `advanceBySeenPos` branché dans le parcours (CA4, bornes de latitude, enroulement) ; `position-age.test.ts` et un cas bout en bout dans `adsblol-response.test.ts`.
  Scénarios de changement :
  - Seuil d'âge de la position (hors périmètre aujourd'hui) : `position-age.ts` seul.
  - Repli sur `alt_geom` : `adsblol-response.ts` seul.
  - Validation des routes adsbdb (SPEC-0009) : son propre schéma ; `z.config` sera alors posé deux fois (accepté : pas d'abstraction avant la troisième source).

### T2 : Cadence de 10 s et pause en arrière-plan dans le contrôleur de scène
- Périmètre : src/shared/scene/controller.ts, src/shared/scene/controller.test.ts
- Dépend de : aucune
- Risque : moyen (logique partagée lue par les deux écrans ; minuteur, requêtes concurrentes et cycle de vie)
- Critères de la spec couverts : CA9, CA10, CA11, CA12, CA13, CA14, CA15
- Définition de fini : `pnpm verify` vert ; `controller.test.ts` couvre chaque critère avec le faux d'horloge et des minuteurs factices ; `tests/acceptance/SPEC-0007.native.test.tsx` et `SPEC-0004.*` passent en local (`.skip` de SPEC-0007 retiré sans commit) ; aucun log ni appel à `monitoring` ajouté. Signature de `useScene` et de `SceneController` inchangée.
- Conception :
  ```diff
   src/shared/scene
  ~├── controller.ts        # MODIFIÉ : échéances, requête en vol, pause/reprise
  ~└── controller.test.ts   # MODIFIÉ : cas CA9 à CA15
  ```
  ```ts
  export const REFRESH_INTERVAL_MS = 10_000
  // état interne ajouté : cadenceOriginMs, settledId (requête la plus récente terminée), paused
  ```
  ```diff
   createSceneController(services, onChange)
  -  setInterval(publish, TICK_MS)
  +  setInterval(tick, TICK_MS)
  +  tick(): publish(); si clock.now() atteint origine + k × 10 s, et settledId === requestId, et problem !== "denied" → refresh()
  +  lifecycle.onBackground?.(pause)        # clearInterval, paused = true
  ~  lifecycle.onForeground(resume)         # paused = false, origine = now, setInterval, acquire()
  ~  query(), acquire() : réponse ignorée si stopped, paused ou id !== requestId ; settledId = id
  ```
  Ordre de construction :
  1. Échéance de 10 s depuis la première requête (CA9) ; vérifiée par `controller.test.ts` puis le contrat natif CA9.
  2. Échéance sautée si la requête précédente n'a pas répondu, `refresh()` sans effet sur l'échéance (CA10, CA15).
  3. Pause et reprise, réponse en vol ignorée, permission refusée (CA11, CA13).
  4. Échecs et démontage : cadence maintenue, relecture de la position si aucune n'est connue (CA12, CA14).
  Scénarios de changement :
  - Autre cadence : `REFRESH_INTERVAL_MS` seul.
  - Relance avec délai croissant (hors périmètre) : `tick()` dans `controller.ts` seul.
  - Données périmées (SPEC-0008) : lit `snapshotAtMs`, aucun changement ici.

## Groupe 2 (après fusion du groupe 1)
### T3 : Client adsb.lol, choix de la source et activation des contrats
- Périmètre : src/shared/adsb/adsblol.ts, src/shared/adsb/adsblol.test.ts, src/shared/adsb/select.ts, src/shared/adsb/select.test.ts, src/main.tsx, tests/acceptance/SPEC-0007.test.ts, tests/acceptance/SPEC-0007.native.test.tsx
- Dépend de : T1, T2
- Risque : élevé (seul appel sortant qui porte la position (INV7) ; câblage de la source livrée dans `main.tsx`)
- Critères de la spec couverts : CA1, CA2, CA6, CA7, CA8
- Définition de fini : `pnpm verify` vert ; retrait des **deux** `describe.skip` de `tests/acceptance/SPEC-0007.test.ts` et `SPEC-0007.native.test.tsx` (seule modification permise), tous leurs tests verts ; `adsblol.test.ts` couvre l'arrondi (`-0`, zéros de fin), le rayon (6, 44, 250), le `clearTimeout` après réponse, chaque cause de rejet sans coordonnée dans le message ; `main.tsx` sans logique (le relecteur vérifie : démo seulement sous `__DEV__` et `EXPO_PUBLIC_ADSB_SOURCE=demo`). Interface figée ci-dessus.
- Conception :
  ```diff
   src/shared/adsb
  +├── adsblol.ts        # NOUVEAU : URL, fetch, délai, erreurs (contrat de la spec)
  +├── adsblol.test.ts
  +├── select.ts         # NOUVEAU : chooseAdsbSource
  +└── select.test.ts
  ~src/main.tsx          # MODIFIÉ : chooseAdsbSource({ isDev: __DEV__, requested: process.env.EXPO_PUBLIC_ADSB_SOURCE })
  ```
  ```diff
   fetchAircraft(query)
  +  buildAdsbLolUrl(query)                 # lève ADSB_UNAVAILABLE avant tout fetch (CA7)
  +  AbortController + setTimeout(8000)     # Promise.race : rejet même si fetch ignore le signal
  +  fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal })
  +  response.ok ? response.json() : rejet
  +  parseAdsbLolBody(body)                 # T1
  +  catch (toute cause) → AppError ADSB_UNAVAILABLE, message fixe ; finally clearTimeout
  ```
  Ordre de construction :
  1. `buildAdsbLolUrl` et `fetchAircraft` sur une réponse valide (CA1, CA2) ; vérifiés par le contrat Vitest en local.
  2. Rejets : statut, réseau, corps illisible, requête invalide, délai (CA6, CA7).
  3. `select.ts` et câblage de `main.tsx` (CA8), puis retrait des deux `.skip` ; `pnpm dev` sur simulateur montre de vrais avions.
  Scénarios de changement :
  - Autre source ADS-B : nouveau fichier client, `select.ts`, `main.tsx` (trois fichiers, accepté : le choix de la source est volontairement central).
  - Arrondi de la position changé (INV7) : `adsblol.ts` et `adsbQueryFor` de `scene/controller.ts` (règle doublée volontairement : CA1 et CA9 l'exigent chacun).
  - Plafond du rayon : `adsblol.ts` seul.
