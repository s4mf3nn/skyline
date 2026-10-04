<!-- Titre : type(spec-xxxx): description   ex. feat(spec-0001): create short link ; correctif de bug : fix(spec-0001): description ; hors spec (outillage) : fix(factory): description -->

## Référence
<!-- Hors spec (amélioration du boilerplate) : écrire « Hors spec : <objet> » et supprimer les lignes ci-dessous -->
- Spec : `specs/SPEC-XXXX-.../spec.md`
- Tâche : T#
<!-- Correctif de bug (/fix) : remplacer la ligne « Tâche » par « Correctif : Fixes #<issue> » et citer le critère ou le cas limite non tenu -->
- Critères d'acceptation couverts : CA1, CA2

## Intention
En deux ou trois phrases, ce que fait ce changement et pourquoi.

## Fichiers touchés
Liste courte. Tout fichier hors du périmètre déclaré doit être justifié ici.

## Décisions prises
Les choix non dictés par la spec, avec leur raison. Tout écart au bloc « Conception » de la tâche (fichier, signature, chemin d'appel) est listé ici.

## Points d'incertitude
Ce que l'humain doit regarder en priorité.

## Documentation consultée (Context7)
Bibliothèque et version, une par ligne. `Aucune` si le changement n'utilise aucune API de bibliothèque. Si Context7 était indisponible, l'écrire ici.

## Revue locale
<!-- Bloc généré par `node scripts/review-gate.mjs section`, ne pas modifier à la main -->
Verdict : 
Patch-id : 

## Nouvelles dépendances
Aucune | nom, version, justification

## Checklist
- [ ] `pnpm verify` vert en local
- [ ] Seul `.skip` retiré dans `tests/acceptance/`
- [ ] Correctif de bug : test de non-régression ajouté, vu en échec avant la correction
- [ ] Aucune modification hors périmètre non justifiée
- [ ] Revue locale `OK` sur le dernier état du code
