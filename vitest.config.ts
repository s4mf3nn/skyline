import { existsSync, readFileSync } from "node:fs";
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
  test: {
    include: holdout ? ["tests/holdout/**/*.test.{ts,tsx}"] : ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // tests/e2e : tests sur cible réelle, joués par leur propre lanceur (`pnpm test:e2e`), en CI seulement.
    exclude: holdout
      ? [...configDefaults.exclude, ...otherRunners]
      : [...configDefaults.exclude, "tests/holdout/**", "tests/e2e/**", ...otherRunners],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Ajouter ici ce qu'aucun test ne charge : point d'entrée (ex. src/server.ts, src/main.tsx), migrations.
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.gen.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
