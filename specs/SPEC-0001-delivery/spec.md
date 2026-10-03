# SPEC-0001 : Livraison, cible réelle et observabilité

Statut : BROUILLON
Risque estimé : élevé (livraison, secrets, retour arrière)
Dépend de : SPEC-0000
Tests de contrat : `tests/acceptance/SPEC-0001.test.ts`

## Objectif
Livrer le socle posé par SPEC-0000 sur la cible décrite dans `docs/adr/0001-stack.md` (ligne « Livraison »), revenir en arrière sans perte, et vérifier chaque application sur sa cible réelle en CI. Une erreur en production remonte à Sentry avec la version livrée, sans donnée personnelle. Après cette spec, chaque spec livrée peut partir en production par le workflow `release`.

## Critères d'acceptation
<!-- À adapter à l'ADR-0001, puis écrire les assertions dans tests/acceptance/SPEC-0001.test.ts.
CA1 à CA3 et CA6 se vérifient sur la cible (workflow `release` à blanc, job `e2e`) : leur preuve est le run de CI cité
dans la PR. Le contrat Vitest couvre ce qui se vérifie sans cible (CA4, CA5, avec le faux du suivi des erreurs). Sans
livraison (ex. bibliothèque interne), CA1, CA2 et CA6 sont sans objet ; pour une bibliothèque, CA4 à CA6 aussi : le dire ici. -->
- **CA1** : `pnpm release` livre chaque application sur la cible de l'ADR-0001, avec les secrets de l'environnement GitHub `production` (jamais en argument ni dans le dépôt). Son mode à blanc passe quand la cible en offre un.
- **CA2** : `pnpm release` applique les migrations avant de déployer le code, et chaque migration reste compatible avec la version précédente du code (ajout d'abord, retrait dans une livraison suivante). Le retour arrière de chaque application est la commande ou la procédure écrite dans l'ADR-0001, répétée une fois sur la cible ou un environnement de préproduction.
- **CA3** : `pnpm test:e2e` démarre chaque application et les services dont elle a besoin (base, API), puis vérifie sur la cible réelle le point de santé de chaque application (CA1 de SPEC-0000). Le job `e2e` de la CI les lance et passe.
- **CA4** : une erreur non gérée de chaque application (route, écran, tâche planifiée) est transmise au service « suivi des erreurs » avec la version (SHA du commit livré) et l'environnement ; l'utilisateur reçoit la réponse d'erreur habituelle. Vérifié par le contrat avec le faux du service.
- **CA5** : l'événement transmis ne contient aucune donnée personnelle : ni adresse email, ni coordonnées, ni contenu saisi par l'utilisateur, ni en-tête d'authentification ou cookie. La collecte automatique du SDK est désactivée et un filtre avant envoi retire ces champs. Vérifié par le contrat avec le faux du service.
- **CA6** : `pnpm release` envoie les sourcemaps de la version livrée à Sentry et la déclare (SHA du commit) ; aucune sourcemap n'est servie publiquement.

## Contrat d'interface
- Scripts de `package.json` : `release` (livraison, avec son mode à blanc s'il existe), `test:e2e` (cible réelle, CI seulement).
- Workflow `.github/workflows/release.yml` : variables d'environnement exposées depuis les secrets de `production`, une par ligne (dont le jeton d'envoi des sourcemaps).
- Service « suivi des erreurs » : interface dans `src/shared/monitoring/` (signaler une erreur avec son contexte), implémentation Sentry, faux qui garde les événements reçus pour les tests. La fabrique de chaque application le reçoit.
- Job `e2e` de `.github/workflows/ci.yml` : services nécessaires (base, application démarrée).

## Parcours sur cible réelle
- Chaque application démarre et répond à son point de santé.

## Hors périmètre
Toute fonctionnalité métier ; les parcours métier sur cible réelle, écrits par les specs qui les créent.

## Contraintes
Exécutée après SPEC-0000, en parallèle des premières specs métier : elle ne touche pas `src/features/`.

## Questions ouvertes
À vider avant de passer le statut à VALIDÉE.
