# SPEC-XXXX : <titre court>

Statut : BROUILLON | VALIDÉE | EN COURS | LIVRÉE
Risque estimé : faible | moyen | élevé
Dépend de : aucune | SPEC-XXXX, SPEC-YYYY (specs à livrer avant de planifier celle-ci, voir `specs/ROADMAP.md`)
Tests de contrat : `tests/acceptance/SPEC-XXXX.test.ts` (ou fichiers suffixés `SPEC-XXXX.<suffixe>.test.ts(x)`)
Scénarios cachés : `tests/holdout/SPEC-XXXX.test.ts` (ne pas les décrire ici)

## Objectif
Ce qui doit être vrai une fois la spec livrée, en deux ou trois phrases, du point de vue de l'utilisateur.

## Acteurs et rôles
Qui agit dans cette spec, et pour chaque action exposée (route, écran, commande) le rôle requis et ce que voit chacun (ex. « un utilisateur ne lit que ses propres conversations ; un modérateur lit les signalements »). Chaque refus a son critère d'acceptation. `Aucun rôle` pour une spec sans action exposée.

## Critères d'acceptation
- **CA1** : comportement observable et testable
- **CA2** : ...

## Cas limites
- Entrée vide, invalide, trop longue
- Doublons, concurrence
- Dépendance indisponible (base, cache, réseau, service tiers : simulée par son faux)
- Temps : expiration, échéance, changement de jour ou de fuseau (horloge factice)

## Contrat d'interface
Entrées et sorties exactes de l'interface publique (pour une API HTTP : méthode, chemin, corps, codes de statut, format d'erreur ; pour une application web ou mobile : voir « Écrans » ; pour une CLI : arguments, sorties, codes de retour ; pour une bibliothèque : fonctions et types exportés par le point d'entrée du paquet, erreurs levées).

## Écrans
Pour une interface web ou mobile ; supprimer la section sinon. Un bloc par écran :
- **<Écran>** : maquette `specs/SPEC-XXXX-<slug>/maquettes/<fichier>` (fournie par l'humain) ; états affichés parmi chargement, vide, erreur, succès, accès refusé (ceux qui s'appliquent, chacun testé) ; actions de l'utilisateur et leur effet ; textes exacts quand un test les vérifie. La maquette fixe la disposition ; en cas d'écart, la spec fait foi.

## Parcours sur cible réelle
Facultatif : ce qui ne se vérifie que sur la cible (navigateur, simulateur ou appareil, paquet installé, binaire), par exemple la caméra, l'installation ou une signature. Un parcours par ligne, joué par `tests/e2e/` en CI (`pnpm test:e2e`). Supprimer la section si le contrat et les scénarios cachés suffisent.

## Hors périmètre
Ce que cette spec ne fait volontairement pas.

## Contraintes
- Performance, sécurité, dépendances interdites ou imposées

## Questions ouvertes
À vider avant de passer le statut à VALIDÉE.
