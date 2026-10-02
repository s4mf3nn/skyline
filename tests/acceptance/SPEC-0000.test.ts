import { describe, it } from "vitest";

// Contrat de SPEC-0000 : à écrire par l'humain, avec des assertions complètes, avant de valider la spec.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).
describe.skip("SPEC-0000 bootstrap", () => {
  it.todo("CA1 : le point de santé répond");
  it.todo("CA3 : une feature ajoutée est montée après pnpm gen sans autre modification");
});
