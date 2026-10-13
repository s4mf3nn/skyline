# ADR-0002 : Source des routes de vol

Date : 2026-10-13
Statut : proposée

## Contexte
Le handoff affiche l'origine et la destination de chaque vol (codes « CDG / MAD », villes « Paris → Madrid ») sur Ciel
et sur les cartes de passage. adsb.lol ne fournit que les positions ; l'ADR-0001 laisse la source des routes
`à décider`, et le brief repousse adsbdb.com au MVP. La v0 n'a pas de backend : la source doit être appelable depuis
l'application, sans clé secrète.

Options examinées le 2026-10-13 :
1. **adsb.lol `POST /api/0/routeset`** : même hôte que la source ADS-B, sans clé, mais la requête porte la position de
   l'avion avec son indicatif. Essayée le 2026-10-13 avec des indicatifs réels en vol au-dessus de Paris : réponse
   HTTP 201 au corps vide. Inutilisable en l'état.
2. **adsbdb.com `GET /v0/callsign/{callsign}`** : sans clé, réponse JSON avec la compagnie (nom, codes IATA et OACI),
   l'origine et la destination (codes IATA et OACI, nom, ville `municipality`, pays, latitude, longitude). Vérifiée le
   2026-10-13 (`AFR1015` : Split → Paris-CDG). Second hôte sortant ; base communautaire, sans garantie de complétude.
3. **Pas de route en v0** : bloc des aéroports et des villes remplacé par un repli ; écart assumé avec le handoff.

## Décision
Option 2, retenue par le propriétaire le 2026-10-13 : les routes viennent d'adsbdb.com, `https://api.adsbdb.com`.
- La requête ne porte que l'indicatif de l'avion, jamais la position de l'observateur (INV7).
- Un indicatif est demandé au plus une fois par session de l'app : le résultat, route trouvée ou inconnue, est gardé en
  mémoire. Les routes sont demandées hors du cycle de 10 s, seulement pour les avions affichés.
- La réponse est validée à la frontière (INV6). Route absente, indicatif inconnu ou erreur réseau : repli « route
  inconnue », sans bloquer l'affichage de l'avion.
- La source passe par une interface avec un faux, injectée par les tests, dans `src/shared/routes/`.
- Les heures de départ et d'arrivée et la progression du vol ne viennent pas d'adsbdb : voir ADR-0003.

## Conséquences
- `api.adsbdb.com` rejoint adsb.lol dans la liste des hôtes sortants autorisés (`docs/factory/DOMAIN-SECURITY.md`).
- Nouvelle zone sensible à déclarer : `**/shared/routes/` (réponse externe à valider), par une PR `factory`.
- Les coordonnées des aéroports permettent d'estimer la progression du vol sans autre source (ADR-0003, option 1).
- Cette ADR remplace la ligne « Source des routes de vol » (`à décider`) de l'ADR-0001 une fois acceptée.
- adsbdb.com ne publie pas de garantie de disponibilité : un repli propre est obligatoire sur chaque écran.
