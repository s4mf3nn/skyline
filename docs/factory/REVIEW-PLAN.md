# Relecture d'une PR de plan

Points du subagent `reviewer` pour une PR dont le diff ne contient qu'un `specs/SPEC-XXXX-*/plan.md`. Lu seulement dans ce cas.

PR de plan (le diff ne contient qu'un `specs/SPEC-XXXX-*/plan.md`) : lis le plan et la spec en entier, et le code existant que la conception modifie. Ne vérifie que les points suivants, quel que soit le niveau, puis passe au verdict. L'humain valide la conception dans cette PR : ton rôle est de lui retirer les défauts qu'un contrôle peut voir.
- Couverture : chaque `CA#` de la spec est couvert par une tâche ; une seule tâche de clôture retire les `.skip`, seule dans le dernier groupe. Un critère sans tâche est `Bloquant`.
- Périmètres : tout fichier de l'arborescence d'une conception est dans le périmètre de sa tâche ; deux tâches d'un même groupe ne se recoupent pas ; une signature consommée par une autre tâche est figée dans un groupe antérieur. Un manquement est `Bloquant` : l'agent s'arrêterait en cours de tâche.
- Cohérence interne : l'arbre d'appels n'emploie que des fonctions présentes dans les signatures ou dans le code existant, placées dans les fichiers de l'arborescence ; types d'entrée et de sortie compatibles d'un appel au suivant.
- Une règle, un endroit : une règle métier ou un invariant de `docs/DOMAIN.md` porté par deux fichiers, ou validé ailleurs qu'à la frontière, est à corriger.
- Rien de trop : une couche qui ne fait que transmettre, une interface à une seule implémentation sans faux à injecter, un paramètre ou un type générique sans second usage, une abstraction avant la troisième répétition sont à corriger.
- Conventions : découpage de feature de l'ADR-0001, frontières entre features (`index.ts` seulement), noms de `docs/DOMAIN.md`, technologies `imposées`, erreurs typées, horloge et services tiers derrière une interface de `src/shared/`.
- Tranches : chaque étape de l'« Ordre de construction » traverse les couches et nomme sa vérification de bout en bout. Un ordre par couche (migrations, service, API, interface) est à corriger.
- Scénarios de changement : refais le compte des fichiers touchés d'après l'arborescence et l'arbre d'appels. Un scénario absent, invraisemblable au regard de la spec, ou dont le compte est sous-estimé est à corriger ; ajoute en `Points d'incertitude pour l'humain` l'évolution probable que le plan n'a pas envisagée et qui toucherait le plus de fichiers.
- Taille : une tâche dont la conception annonce plus de ~300 lignes de diff, ou plus de 5 tâches sans raison de risque ou de parallélisme, est à corriger.
