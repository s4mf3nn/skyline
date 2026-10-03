import { describe, it } from "vitest";

// Contrat de SPEC-0001 : à écrire par l'humain, avec des assertions complètes, avant de valider la spec.
// CA1 à CA3 et CA6 se prouvent sur la cible (workflow release à blanc, job e2e) ; ce fichier couvre ce qui se vérifie sans elle.
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).
describe.skip("SPEC-0001 delivery", () => {
  it.todo("CA4 : an unhandled error reaches the error reporter with release and environment");
  it.todo("CA5 : the reported event carries no personal data");
});
