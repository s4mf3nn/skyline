# Changements à reporter dans le boilerplate : formulations claires et actions en questions à choix multiples

- Date : 2026-10-15
- Origine : branche `s4mf3nn/vo699` (skyline)
- Portée : outillage de la factory uniquement (scope `factory`, hors spec). Aucun fichier de `src/`, `specs/` ni `tests/acceptance/`.
- Objectif : les réponses des agents étaient souvent floues et abstraites ; l'humain devait deviner ce qu'on attendait de lui.

## Fichier modifié

| Fichier | Changement |
|---|---|
| `CLAUDE.md` | Section « Questions à l'humain » : un paragraphe « Formulations » ajouté à la fin (phrases courtes et concrètes, dire ce qui s'est passé / ce que ça change / ce que l'humain doit faire, toute action demandée en question à choix multiples, commande aussi donnée en bloc de code) |

## Procédure de report

1. Copier le paragraphe « Formulations » à la fin de la section « Questions à l'humain » du `CLAUDE.md` du boilerplate.
2. Lancer `pnpm verify` puis la PR hors spec : `chore(factory): formulations claires et actions en questions à choix multiples`.

## Points d'attention

- Le paragraphe complète la règle existante sur `AskUserQuestion` ; il ne la remplace pas.
- La mémoire personnelle de l'utilisateur (`~/.claude/projects/.../memory/`) porte la même consigne mais n'est pas versionnée : seul `CLAUDE.md` se reporte.
