# ADR-0003 : Horaires et progression du vol

Date : 2026-10-13
Statut : acceptée

## Contexte
L'écran Ciel du handoff affiche les heures de départ et d'arrivée (« 13:05 → 15:10 ») et une barre de progression du
vol (18 %). Ni adsb.lol ni adsbdb.com (ADR-0002) ne fournissent d'horaires. Le propriétaire demande une solution par
une API tierce (2026-10-13).

Contrainte décisive : les API d'horaires demandent toutes une clé. Une clé embarquée dans l'application est publique
(tout ce qui est sous `EXPO_PUBLIC_` est livré dans le bundle, `docs/factory/DOMAIN-SECURITY.md`). Une API à clé impose
donc un relais côté serveur qui la garde, alors que la v0 se veut « sans backend nouveau » (brief, section 8). Les
quotas gratuits sont aussi faibles face à quelques dizaines de vols distincts par jour et par testeur.

Options :
1. **Estimation locale, sans API** : progression = distance parcourue depuis l'origine / distance origine-destination
   (orthodromie, coordonnées fournies par adsbdb) ; heures estimées d'après la vitesse sol, affichées comme estimations.
   Aucun hôte, aucune clé ; fausse pour les attentes au sol et les trajectoires non directes.
2. **AeroDataBox** (via RapidAPI ou API.Market) : statut d'un vol par indicatif, heures prévues et révisées. Offre
   gratuite d'environ 600 unités par mois, puis à partir d'environ 5 $ par mois (comparatif geekflare 2026). Demande
   un relais pour la clé.
3. **FlightAware AeroAPI** : `GET /flights/{ident}` accepte un indicatif, renvoie heures prévues, estimées et réelles
   et `progress_percent`. Offre personnelle avec crédit mensuel gratuit, puis facturation à la requête. Données les
   plus fiables ; conditions d'usage à relire pour une app publiée. Demande un relais.
4. **Aviationstack** : 100 requêtes par mois gratuites, puis à partir d'environ 50 $ par mois. Recherche par numéro de
   vol IATA plutôt que par indicatif. Demande un relais.

Relais possible pour les options 2 à 4 : une fonction serverless minimale (Supabase Edge Function ou Cloudflare
Worker) qui garde la clé, met en cache par indicatif et par jour, et ne reçoit jamais la position de l'observateur.

## Décision
Option 1 en v0, retenue par le propriétaire le 2026-10-14 : heures et progression estimées, libellées comme telles.
Option 3 au MVP, derrière le backend prévu par le brief, qui gardera la clé sans créer d'infrastructure dédiée à la v0.

## Conséquences
- Option 1 : SPEC-0009 porte le calcul, pur et testé sous Vitest ; aucun nouvel hôte ni secret.
- Options 2 à 4 : un nouvel hôte sortant, un secret côté serveur (jamais sous `EXPO_PUBLIC_`), un relais à livrer et à
  surveiller, un coût mensuel, et une zone sensible de plus pour le client.
- Dans tous les cas, l'écran Ciel garde un repli quand les heures sont inconnues (route inconnue, vol hors base).
- Réouverture : si les horaires réels deviennent nécessaires dès la v0 pour valider H1, retenir l'option 3 avec un
  relais minimal demande une ADR de plus (hébergement, secret, coût) et un amendement de `docs/PRODUCT.md` (qui exclut
  tout backend en v0) et de la roadmap.
