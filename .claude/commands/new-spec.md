---
description: Rédiger une nouvelle spec contrat, ses tests d'acceptation et ses scénarios cachés à partir d'un besoin
argument-hint: <description du besoin>
---

Besoin exprimé : $ARGUMENTS

1. Détermine le prochain numéro libre dans `specs/` et crée `specs/SPEC-XXXX-<slug>/spec.md` à partir de `specs/_template/spec.md`.
2. Remplis objectif, critères d'acceptation numérotés (CA1, CA2...), cas limites, hors périmètre, niveau de risque.
3. **Pose-moi tes questions** sur tout ce qui est ambigu avant de finaliser. Ne suppose rien sur les règles métier.
4. Écris `tests/acceptance/SPEC-XXXX.test.ts` : un `describe.skip("SPEC-XXXX ...")` avec un `it` par critère d'acceptation, assertions complètes et précises. Ces tests deviendront le contrat : ils ne doivent pas dépendre de détails d'implémentation internes, seulement de l'interface publique (API HTTP, CLI, composant rendu).
5. Écris `tests/holdout/SPEC-XXXX.test.ts` : 2 à 4 scénarios cachés, **sans** `.skip` (ils s'activent seuls quand le test de contrat n'a plus de `.skip`). Chaque scénario est un parcours de bout en bout qui enchaîne plusieurs critères par l'interface publique, avec d'autres données que les tests de contrat et au moins un cas limite de la spec. Ils n'exigent rien que la spec ne dise pas, et la spec ne les décrit pas : l'agent producteur ne les verra jamais.
6. Ne modifie aucun fichier de `src/`.
7. Commite (`docs(spec-xxxx): add spec and contract tests`), rédige `.pr-summary.md` d'après `.github/pull_request_template.md` (section « Documentation consultée (Context7) » : `Aucune`, sauf bibliothèque vérifiée pour écrire les tests), puis lance `/review` : pour une PR de spec, il utilise le subagent `spec-reviewer`. Corrige les points `Bloquants` et `À corriger`, commite et relance en transmettant ces points avec `--loops N`, 3 passages au maximum. Au-delà, arrête-toi et dis-moi ce qui bloque.
8. Enchaîne avec `/ship`. Termine par un résumé qui reprend les « Points d'incertitude » du relecteur, et rappelle que cette PR de spec doit être relue et fusionnée par un humain avant tout `/plan`.
