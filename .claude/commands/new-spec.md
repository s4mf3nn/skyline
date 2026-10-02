---
description: Rédiger une nouvelle spec contrat et ses tests d'acceptation à partir d'un besoin
argument-hint: <description du besoin>
---

Besoin exprimé : $ARGUMENTS

1. Détermine le prochain numéro libre dans `specs/` et crée `specs/SPEC-XXXX-<slug>/spec.md` à partir de `specs/_template/spec.md`.
2. Remplis objectif, critères d'acceptation numérotés (CA1, CA2...), cas limites, hors périmètre, niveau de risque.
3. **Pose-moi tes questions** sur tout ce qui est ambigu avant de finaliser. Ne suppose rien sur les règles métier.
4. Écris `tests/acceptance/SPEC-XXXX.test.ts` : un `describe.skip("SPEC-XXXX ...")` avec un `it` par critère d'acceptation, assertions complètes et précises. Ces tests deviendront le contrat : ils ne doivent pas dépendre de détails d'implémentation internes, seulement de l'interface publique (API HTTP, CLI, composant rendu).
5. Ne modifie aucun fichier de `src/`.
6. Termine par un résumé et rappelle que cette PR de spec doit être relue et fusionnée par un humain avant tout `/plan`.
