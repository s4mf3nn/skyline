export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scope obligatoire au format spec-xxxx (ou factory pour l'outillage)
    "scope-empty": [2, "never"],
    "scope-case": [2, "always", "kebab-case"],
  },
};
