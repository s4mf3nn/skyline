# Sécurité propre au domaine

Tenu hors de `CLAUDE.md` pour alléger le contexte de base. **À lire avant toute tâche qui touche une entrée utilisateur, une écriture exposée (route, formulaire, commande) ou une zone à risque élevé**, et par le subagent `reviewer` sur ces diffs.

<!-- À compléter : 3 à 6 règles vérifiables, propres au domaine. Chaque règle doit pouvoir être contrôlée sur un diff.
Exemples selon le type d'application :
- API : toute route d'écriture passe par le rate limiting.
- Web ou mobile : les jetons de session vivent dans un stockage sûr (cookie `HttpOnly`, trousseau du système), jamais en clair ; un deep link ou un paramètre d'URL est validé comme une entrée utilisateur.
- CLI : aucun secret en argument ni dans les logs.
Exemples de domaine (service de raccourcissement d'URL) :
- Seuls les schémas `http` et `https` sont acceptés comme URL cible ; refuser `javascript:`, `data:`, `file:` et les URL pointant vers notre propre domaine (boucles).
- Les identifiants publics sont générés aléatoirement (pas de séquence prédictible).
-->

- Toute écriture exposée (route, formulaire, commande) passe par l'authentification, vérifiée là où la donnée est stockée et pas seulement dans l'interface.
- Aucun secret dans ce qui est livré à un client (bundle web, application mobile, paquet publié).
- Les messages d'erreur ne révèlent ni détail interne ni donnée d'un autre utilisateur.
- <règle du domaine>

Les zones correspondantes sont classées **risque élevé** : voir `docs/factory/RISK.md`. Résume ces règles en une phrase dans `CLAUDE.md` (section « Sécurité propre au domaine »).
