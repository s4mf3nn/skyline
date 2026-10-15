# Documentation des bibliothèques (Context7)

Procédure détaillée, tenue hors de `CLAUDE.md`. S'applique à `/implement`, au subagent `reviewer` et au `planner`.

Avant d'écrire ou de relire du code qui utilise une API de bibliothèque (framework, validation, ORM, Vitest, Biome, Stryker, etc.), vérifie-la dans la documentation plutôt que dans ta mémoire, **dans cet ordre** :

1. **Cache d'abord** : `grep -n -A8 '^## <bibliothèque>' docs/factory/libs-cache.md` (ne lis pas le fichier en entier). Cherche la bibliothèque et sa version épinglée. Si l'API y figure à la même version, utilise-la sans appeler Context7 et note la bibliothèque dans le résumé de PR avec la mention `(cache)`.
2. **Code existant** : si l'API est déjà utilisée à l'identique dans le dépôt, copie ce motif, sans Context7.
3. **Context7 seulement pour ce qui est nouveau** : une API absente du cache et du code, ou une configuration (`tsconfig`, `biome.json`, `vitest.config.ts`, etc.) ou migration de version.
   - Lis la version épinglée dans `package.json` / `pnpm-lock.yaml` (avant l'installation, la dernière version stable).
   - `resolve-library-id`, puis `query-docs` avec l'identifiant versionné (`/org/projet/version`) quand il existe. Une seule requête ciblée par question (nomme le symbole ou l'option exacts, pas de requête générique).
4. **Alimente le cache** : après une consultation, ajoute à `docs/factory/libs-cache.md` une entrée courte (API, forme correcte, piège) sous la bibliothèque et sa version. Une entrée = 1 à 3 lignes. Pas de copie de documentation.
5. Pas de Context7 pour la logique métier, les algorithmes ou le code du dépôt.
6. Liste dans le résumé de PR les bibliothèques consultées (Context7 ou cache). Si Context7 est indisponible, dis-le dans le résumé : la PR part en incertitude à relire.

Quand la version d'une bibliothèque change dans `package.json`, les entrées de l'ancienne version du cache sont périmées : ne les utilise pas, et supprime-les quand tu les remplaces.

**Sources du cache** : chaque entrée de `libs-cache.md` nomme sa source (Context7 avec l'identifiant de bibliothèque, ou lecture de `node_modules` avec le fichier) et la date de vérification. Une entrée sans source, ou dont la source n'est pas reproductible, est traitée comme absente. Le relecteur signale ce cas.
