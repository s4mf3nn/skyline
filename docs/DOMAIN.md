# Domaine : {{PROJECT_NAME}}

<!-- Rédigé par `/roadmap <brief>`, validé par l'humain dans la PR de cadrage, lu par `/new-spec`, le `planner` et le
`spec-reviewer`. Une spec qui contredit un invariant ou un cycle de vie amende d'abord ce document. -->

## Vocabulaire
<!-- Un terme par ligne, tel qu'il apparaît dans le code (identifiant anglais) et dans les specs. Un terme, un sens. -->
| Terme | Identifiant | Définition |
|---|---|---|

## Invariants
<!-- Règles toujours vraies, numérotées (INV1, INV2...). Pour chacune, où elle est garantie : contrainte de la base
(unicité, clé étrangère, vérification), transaction, ou validation à la frontière. Une règle qui protège contre deux
requêtes simultanées est garantie par la base, pas par le code applicatif. -->
- **INV1** : <règle> (garantie par : <contrainte, transaction ou validation>)

## Cycles de vie
<!-- Pour chaque entité qui change d'état : états, transitions autorisées, qui les déclenche, ce qui se passe à
chaque transition. Une transition absente est interdite. -->
### <Entité>
| De | Vers | Déclenchée par | Effet |
|---|---|---|---|
