# SPEC-0001 : Livraison, cible réelle et observabilité

Statut : VALIDÉE
Risque estimé : élevé (livraison, secrets, retour arrière)
Dépend de : SPEC-0000
Tests de contrat : `tests/acceptance/SPEC-0001.test.ts` (Vitest), `tests/acceptance/SPEC-0001.native.test.tsx` (Jest)

## Objectif
Livrer le socle posé par SPEC-0000 par EAS (ligne « Livraison » de `docs/adr/0001-stack.md`) et revenir en arrière sans perte. Une erreur en production remonte à Sentry avec la version livrée, sans position ni autre donnée personnelle. Après cette spec, chaque spec livrée peut partir en production par le workflow `release`.

## Acteurs et rôles
Aucun rôle.

## Critères d'acceptation
CA1, CA2 et CA6 se vérifient sur la cible : leur preuve est le run du workflow `release` cité dans la PR. Le contrat couvre CA4 et CA5 avec le faux du suivi des erreurs.

- **CA1** : `pnpm release` construit le binaire iOS et Android (`eas build`, profil `production`), le soumet à la piste de test de chaque store (TestFlight, test interne de Google Play), puis publie la mise à jour EAS Update sur le canal `production`. Les secrets viennent de l'environnement GitHub `production` (`EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`), jamais d'un argument ni du dépôt. EAS n'offre pas de mode à blanc : la première livraison se fait avec le profil et le canal `preview`, sans soumission aux stores.
- **CA2** : le retour arrière est la republication de la mise à jour EAS précédente (`eas update:republish`), répétée une fois sur le canal `preview` ; la procédure est écrite dans `docs/factory/WORKFLOW.md`. Un binaire soumis ne se retire pas : il se corrige par une nouvelle livraison. Migrations : sans objet (aucune base).
- **CA3** : sans objet en v0. Il n'y a ni script `test:e2e` ni job `e2e` actif : la vérification sur simulateur est manuelle, par une capture jointe à chaque PR d'écran et comparée au handoff. L'automatisation (Maestro) est repoussée au MVP.
- **CA4** : une erreur non gérée dans un écran est transmise au service « suivi des erreurs » avec la version (SHA du commit livré) et l'environnement ; l'utilisateur voit l'écran d'erreur à la place de l'écran fautif, et l'application ne se ferme pas.
- **CA5** : l'événement transmis ne contient aucune donnée personnelle. Le contexte ne garde que les clés `release`, `environment`, `feature` et `screen` ; tout nombre décimal à trois décimales ou plus (une coordonnée) est remplacé par `[redacted]` dans le message de l'erreur. La collecte automatique du SDK reste désactivée (`sendDefaultPii` à `false`) et le même filtre s'applique avant envoi (`beforeSend`).
- **CA6** : `pnpm release` envoie les sourcemaps de la version livrée à Sentry et la déclare (SHA du commit) ; aucune sourcemap n'est servie publiquement.
- **CA7** : sans objet. L'application n'appelle aucune API du projet en v0 (ligne « Clients installés » de l'ADR-0001).

## Cas limites
- Sans DSN (tests, développement local) : le suivi est inactif, aucune requête ne part, l'écran d'erreur s'affiche quand même.
- Message d'erreur sans coordonnée : transmis tel quel.
- Clé de contexte inconnue : retirée, même si sa valeur semble anodine.
- Erreur levée pendant le rendu de l'écran d'erreur lui-même : hors périmètre, laissée au système.

## Contrat d'interface
- Script `release` de `package.json` : binaire et soumission, EAS Update sur le canal `production`, puis sourcemaps. Pas de script `test:e2e`.
- Workflow `.github/workflows/release.yml` : variables d'environnement exposées depuis les secrets de `production`, une par ligne (`EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`).
- Fabrique de l'application, étendue par ajout :

```ts
// src/app.tsx
createApp(options: {
  services: AppServices;
  features?: readonly Feature[];
  build?: { release: string; environment: string };   // absent : "dev" et "development"
}): ComponentType

// src/shared/monitoring
scrubContext(context: Record<string, string>): Record<string, string>   // ne garde que release, environment, feature, screen
scrubMessage(message: string): string                                   // masque les nombres à trois décimales ou plus
```

- L'erreur transmise au suivi est une erreur du même nom dont le message est passé par `scrubMessage` ; son contexte porte `release`, `environment` et `feature` (nom de la feature fautive), passés par `scrubContext`.
- Implémentation Sentry de `ErrorReporter` dans `src/shared/monitoring/` : `@sentry/react-native`, DSN lu dans `EXPO_PUBLIC_SENTRY_DSN`, inactive sans DSN.

## Écrans
- **Erreur** : pas de maquette. Fond neutre `#0C0C0C`, texte « Une erreur est survenue. » en encre crème `#F4F1EA`, police Archivo, sans illustration ni détail technique. Affiché à la place de l'écran fautif.

## Parcours sur cible réelle
- Le binaire de la première livraison `preview` s'installe sur un iPhone et affiche l'écran d'accueil. Vérifié à la main, capture jointe à la PR.

## Hors périmètre
Toute fonctionnalité métier ; les parcours métier sur cible réelle, écrits par les specs qui les créent. La mise en vente sur l'App Store et Google Play (la livraison s'arrête aux pistes de test). Le suivi des performances et la relecture de session de Sentry.

## Contraintes
Exécutée après SPEC-0000, en parallèle des premières specs métier : elle ne touche pas `src/features/`. Les fichiers `src/shared/monitoring/`, `app.json` ou `app.config.*` et `eas.json` sont en zone sensible (`review:full`). Aucun secret sous le préfixe `EXPO_PUBLIC_`.

## Questions ouvertes
Aucune.
