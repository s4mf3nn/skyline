# Sécurité propre au domaine

Tenu hors de `CLAUDE.md` pour alléger le contexte de base. **À lire avant toute tâche qui touche une entrée utilisateur, une écriture exposée (route, formulaire, commande) ou une zone à risque élevé**, et par le subagent `reviewer` sur ces diffs.

Chaque règle doit pouvoir être contrôlée sur un diff, et dit ce qui la vérifie : un test (de contrat de préférence), un lint, un script ou, en dernier recours, le relecteur.

## Règles communes

| Règle | Vérifiée par |
|---|---|
| Toute écriture exposée (route, formulaire, commande) passe par l'authentification et l'autorisation, vérifiées là où la donnée est stockée et pas seulement dans l'interface | Test de contrat du refus (sans session, rôle insuffisant, ressource d'un autre utilisateur) |
| Aucun secret dans ce qui est livré à un client (bundle web, application mobile, paquet publié) | gitleaks, relecteur |
| Les messages d'erreur ne révèlent ni détail interne ni donnée d'un autre utilisateur | Test de contrat sur le format d'erreur, relecteur |
| Aucune donnée personnelle (email, coordonnées, contenu saisi, en-tête d'authentification, cookie, jeton porté par une URL de connexion ou d'accès) n'est envoyée au suivi des erreurs ni écrite dans les logs | Test de contrat sur le faux du suivi des erreurs (SPEC-0001), relecteur |

## Règles par défaut selon le type d'application

| Concerne | Règle | Vérifiée par |
|---|---|---|
| Mobile | Un deep link ou un paramètre d'URL est validé comme une entrée utilisateur | Test |
| Mobile | Toute réponse d'une source externe (ADS-B, routes de vol) est validée à la frontière, avant tout calcul ; une réponse invalide ou partielle donne un état d'interface prévu, jamais un plantage | Test de contrat avec le faux de la source |
| Données personnelles | Une donnée personnelle n'est montrée à un autre utilisateur que dans la forme que la spec décrit (ex. distance approximative plutôt que position) ; sans objet en v0 (aucun compte, aucun autre utilisateur), à reprendre au MVP | Test de contrat sur la réponse vue par un autre utilisateur |

## Règles du domaine

| Règle | Vérifiée par |
|---|---|
| La position de l'utilisateur ne quitte l'appareil que dans la requête à la source ADS-B (latitude, longitude, rayon) ; elle n'est ni stockée, ni loggée, ni envoyée au suivi des erreurs | Test de contrat sur les faux de la source ADS-B et du suivi des erreurs, relecteur |
| La position envoyée à adsb.lol est arrondie à 3 décimales (environ 100 m) ; le calcul local garde la position exacte | Test de contrat sur le faux de la source ADS-B |
| La requête de routes de vol (adsbdb.com) ne porte que l'indicatif de l'avion, jamais la position de l'observateur (INV7) | Test de contrat sur le faux de la source des routes |
| La permission de localisation demandée est « pendant l'utilisation » seulement ; jamais de localisation en arrière-plan | Relecteur sur `app.json` / `app.config.*`, test sur le faux de localisation |
| Les appels sortants ne visent que les hôtes nommés `api.adsb.lol` et `api.adsbdb.com` (ADR-0001, ADR-0002), en `https` ; l'hôte est une constante, jamais une donnée reçue ; un segment de chemin issu d'une donnée reçue (indicatif) est validé par format avant tout appel (`^[A-Z0-9]{2,8}$` après `trim` et majuscules) | Test avec le faux du réseau et un indicatif hostile, relecteur |
| Aucune image de compagnie (dérive, logo) n'entre dans `assets/tails/` sans autorisation consignée dans la spec qui l'ajoute et notice de crédit dans l'application ; sinon, dérive générique SVG | Relecteur, revue humaine (zone sensible) |
| Aucun secret sous le préfixe `EXPO_PUBLIC_` ni dans `app.json` / `app.config.*` : tout ce qui s'y trouve est livré dans le bundle | gitleaks, relecteur |
| Les mentions obligatoires figurent dans l'application : attribution ODbL, licence de la police, non-affiliation aux compagnies, crédits des images | Vérification du propriétaire avant release (voir `docs/PRODUCT.md`, « Hors périmètre ») |

Les zones correspondantes sont classées **risque élevé** : voir `docs/factory/RISK.md`. Résume ces règles en une phrase dans `CLAUDE.md` (section « Sécurité propre au domaine »).
