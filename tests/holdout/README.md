# Scénarios cachés

Un fichier `SPEC-XXXX.test.ts` par spec, écrit par `/new-spec` et validé par l'humain dans la PR de spec.
L'agent producteur ne voit pas ce dossier : `/implement` le retire de son workspace (`node scripts/holdout.mjs hide`).
Principe, activation et conduite à tenir en cas d'échec : `docs/factory/WORKFLOW.md`, section « Scénarios cachés ».
