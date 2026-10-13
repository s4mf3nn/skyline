// Tests de rendu React Native (Jest, jest-expo). Le nom est en .cjs : package.json est en "type": "module".
// Les scénarios cachés (HOLDOUT=1) sont joués seuls par scripts/holdout.mjs, comme pour vitest.config.ts.
const holdout = process.env.HOLDOUT === "1";

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: holdout
    ? ["<rootDir>/tests/holdout/**/*.native.test.tsx", "<rootDir>/tests/holdout/**/SPEC-*.native.test.tsx"]
    : ["<rootDir>/src/**/*.native.test.tsx", "<rootDir>/tests/acceptance/SPEC-*.native.test.tsx"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
