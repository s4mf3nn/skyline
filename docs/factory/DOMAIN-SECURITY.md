# Sécurité propre au domaine

Tenu hors de `CLAUDE.md` pour alléger le contexte de base. **À lire avant toute tâche qui touche une entrée utilisateur, une écriture exposée (route, formulaire, commande) ou une zone à risque élevé**, et par le subagent `reviewer` sur ces diffs.

Chaque règle doit pouvoir être contrôlée sur un diff, et dit ce qui la vérifie : un test (de contrat de préférence), un lint, un script ou, en dernier recours, le relecteur.

## Règles communes

| Règle | Vérifiée par |
|---|---|
| Toute écriture exposée (route, formulaire, commande) passe par l'authentification et l'autorisation, vérifiées là où la donnée est stockée et pas seulement dans l'interface | Test de contrat du refus (sans session, rôle insuffisant, ressource d'un autre utilisateur) |
| Aucun secret dans ce qui est livré à un client (bundle web, application mobile, paquet publié) | gitleaks, relecteur |
| Les messages d'erreur ne révèlent ni détail interne ni donnée d'un autre utilisateur | Test de contrat sur le format d'erreur, relecteur |
| Aucune donnée personnelle (email, coordonnées, contenu saisi, en-tête d'authentification, cookie) n'est envoyée au suivi des erreurs ni écrite dans les logs | Test de contrat sur le faux du suivi des erreurs (SPEC-0001), relecteur |

## Règles par défaut selon le type d'application

<!-- `/init-project` garde les blocs qui s'appliquent au projet et supprime les autres. -->

| Concerne | Règle | Vérifiée par |
|---|---|---|
| API | Toute route d'écriture passe par la limitation de débit | Test de contrat (réponse au-delà du seuil) |
| API | Toute entrée est validée à la frontière, avant tout traitement | Test de contrat sur une entrée invalide, relecteur |
| Web ou mobile | Les jetons de session vivent dans un stockage sûr (cookie `HttpOnly`, trousseau du système), jamais en clair | Relecteur, test du client |
| Web ou mobile | Un deep link ou un paramètre d'URL est validé comme une entrée utilisateur | Test |
| Authentification par lien ou par code | Lien ou code à usage unique, expiration courte, limitation de débit par destinataire et par adresse, même réponse que le compte existe ou non | Test de contrat (réutilisation, expiration, réponse identique) |
| Fichiers envoyés par les utilisateurs | Taille maximale et type réel (signature du contenu, pas l'extension) vérifiés côté serveur ; nom de stockage généré ; accès privé par défaut, lecture par URL signée à durée courte ; suppression effective | Test de contrat (fichier trop gros, type falsifié, accès sans droit) |
| Données personnelles | Une donnée personnelle n'est montrée à un autre utilisateur que dans la forme que la spec décrit (ex. distance approximative plutôt que position) | Test de contrat sur la réponse vue par un autre utilisateur |
| CLI | Aucun secret en argument ni dans les logs | Relecteur |
| Bibliothèque | Le paquet publié ne contient que les fichiers déclarés (`files` de `package.json`), sans secret ni fichier de test | Test sur la sortie de `npm pack` (cible réelle) |

## Règles du domaine

<!-- 3 à 6 règles propres au produit, reprises de `docs/PRODUCT.md` (données personnelles) et de `docs/DOMAIN.md`.
Exemples (service de raccourcissement d'URL) : seuls `http` et `https` sont acceptés comme URL cible ; les identifiants
publics sont générés aléatoirement. -->

| Règle | Vérifiée par |
|---|---|
| <règle du domaine> | <test, lint, script ou relecteur> |

Les zones correspondantes sont classées **risque élevé** : voir `docs/factory/RISK.md`. Résume ces règles en une phrase dans `CLAUDE.md` (section « Sécurité propre au domaine »).
