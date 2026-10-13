import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Charge l'environnement local du workspace (.env.local) puis celui du repo (.env) sans écraser l'existant.
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

// Scénarios cachés (tests/holdout) : hors de `pnpm test` et de `pnpm verify`, joués seuls par scripts/holdout.mjs.
const holdout = process.env.HOLDOUT === "1";

// Fichiers de contrat confiés à un autre lanceur (package.json, `factory.contractRunners`) : Vitest ne les joue pas,
// scripts/contract-files.mjs et scripts/holdout.mjs le font. La déclaration est validée par ces scripts.
interface FactoryPackage {
  factory?: { contractRunners?: Record<string, string> };
}
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as FactoryPackage;
const otherRunners = Object.keys(pkg.factory?.contractRunners ?? {}).map(
  (suffix) => `tests/**/SPEC-*.${suffix}.test.{ts,tsx}`,
);

export default defineConfig({
  // Même alias que tsconfig.json et jest.config.cjs.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: holdout ? ["tests/holdout/**/*.test.{ts,tsx}"] : ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // tests/e2e : tests sur cible réelle, joués par leur propre lanceur (`pnpm test:e2e`), en CI seulement.
    // src/**/*.native.test.tsx : tests de rendu, joués par Jest (`pnpm test:render`).
    exclude: holdout
      ? [...configDefaults.exclude, ...otherRunners]
      : [
          ...configDefaults.exclude,
          "tests/holdout/**",
          "tests/e2e/**",
          "src/**/*.native.test.{ts,tsx}",
          ...otherRunners,
        ],
    coverage: {
      provider: "v8",
      // Règle par extension : un .ts de src/ est de la logique (couvert ici), un .tsx est du rendu (joué par Jest,
      // hors couverture). Aucun calcul dans un .tsx.
      include: ["src/**/*.ts"],
      // Ajouter ici ce qu'aucun test ne charge : migrations, fichiers de configuration.
      exclude: ["src/**/*.test.ts", "src/**/*.gen.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
