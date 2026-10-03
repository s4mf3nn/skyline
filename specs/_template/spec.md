# SPEC-XXXX : <titre court>

Statut : BROUILLON | VALIDÉE | EN COURS | LIVRÉE
Risque estimé : faible | moyen | élevé
Tests de contrat : `tests/acceptance/SPEC-XXXX.test.ts` (ou fichiers suffixés `SPEC-XXXX.<suffixe>.test.ts(x)`)
Scénarios cachés : `tests/holdout/SPEC-XXXX.test.ts` (ne pas les décrire ici)

## Objectif
Ce qui doit être vrai une fois la spec livrée, en deux ou trois phrases, du point de vue de l'utilisateur.

## Critères d'acceptation
- **CA1** : comportement observable et testable
- **CA2** : ...

## Cas limites
- Entrée vide, invalide, trop longue
- Doublons, concurrence
- Dépendance indisponible (base, cache, réseau)

## Contrat d'interface
Entrées et sorties exactes de l'interface publique (pour une API HTTP : méthode, chemin, corps, codes de statut, format d'erreur ; pour une application web ou mobile : écran, actions de l'utilisateur, états affichés ; pour une CLI : arguments, sorties, codes de retour).

## Parcours sur cible réelle
Facultatif : ce qui ne se vérifie que sur la cible (navigateur, simulateur ou appareil, paquet installé, binaire), par exemple la caméra, l'installation ou une signature. Un parcours par ligne, joué par `tests/e2e/` en CI (`pnpm test:e2e`). Supprimer la section si le contrat et les scénarios cachés suffisent.

## Hors périmètre
Ce que cette spec ne fait volontairement pas.

## Contraintes
- Performance, sécurité, dépendances interdites ou imposées

## Questions ouvertes
À vider avant de passer le statut à VALIDÉE.
