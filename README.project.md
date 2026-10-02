# {{PROJECT_NAME}}

<!-- À compléter : une phrase sur le produit. -->
Projet développé selon le modèle de software factory IA.

- Règles pour les agents : `CLAUDE.md`
- Processus : `docs/factory/WORKFLOW.md`
- Lexique des concepts : `docs/factory/LEXIQUE.md`
- Zones de risque : `docs/factory/RISK.md`
- Décisions techniques : `docs/adr/`
- Specs et plans : `specs/`
- Commandes de la factory : `.claude/commands/` (`/new-spec`, `/plan`, `/implement`, `/fix`, `/review`, `/ship`, `/resolve`, `/land`, `/retro`, `/learn`)
- Revue : locale et automatique (`scripts/review-gate.mjs`), sans clé API en CI
- Documentation des bibliothèques : serveur MCP Context7 déclaré dans `.mcp.json` (version épinglée, une montée de version passe par une PR ; prérequis : Node et `npx`)
- Origine et mise en place de la factory : `docs/factory/BOILERPLATE.md`
