# Sécurité propre au domaine

Tenu hors de `CLAUDE.md` pour alléger le contexte de base. **À lire avant toute tâche qui touche une entrée utilisateur, une route d'écriture ou une zone à risque élevé**, et par le subagent `reviewer` sur ces diffs.

<!-- À compléter : 3 à 6 règles vérifiables, propres au domaine. Chaque règle doit pouvoir être contrôlée sur un diff.
Exemples (service de raccourcissement d'URL) :
- Seuls les schémas `http` et `https` sont acceptés comme URL cible ; refuser `javascript:`, `data:`, `file:` et les URL pointant vers notre propre domaine (boucles).
- Les identifiants publics sont générés aléatoirement (pas de séquence prédictible).
-->

- Toute route d'écriture passe par l'authentification et le rate limiting.
- Les messages d'erreur ne révèlent ni détail interne ni donnée d'un autre utilisateur.
- <règle du domaine>

Les zones correspondantes sont classées **risque élevé** : voir `docs/factory/RISK.md`. Résume ces règles en une phrase dans `CLAUDE.md` (section « Sécurité propre au domaine »).
