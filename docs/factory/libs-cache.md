# Cache des vérifications de bibliothèques

Faits déjà vérifiés dans la documentation (Context7 ou lecture de `node_modules`) à une **version précise**. Voir `docs/factory/CONTEXT7.md` pour la procédure. Entrées courtes, jamais de copie de doc. Une entrée dont la version ne correspond plus à `package.json` est périmée.

Format d'une entrée :

```
## <bibliothèque> <version épinglée>
Source : <Context7 `/org/projet/version`, ou fichier de `node_modules`> le AAAA-MM-JJ.
- <API> : <forme correcte, piège> (1 à 3 lignes).
```

<!-- Les entrées commencent ici. -->

## vitest 4.1.11
Source : Context7 `/vitest-dev/vitest/v4.1.6` (version la plus proche disponible) le 2026-10-02, formes confirmées par exécution en 4.1.11.
- `test.exclude` : étendre avec `[...configDefaults.exclude, "<glob>"]` (`configDefaults` vient de `vitest/config`) ; le remplacer seul retire les exclusions par défaut.
- Rapport JSON : `vitest run <fichiers> --reporter=json --outputFile=<chemin>` ; format Jest (`testResults[].name`, `.status`, `.message`, `.assertionResults[].status|fullName|failureMessages`).

