import { existsSync } from "node:fs";
import { configDefaults, defineConfig } from "vitest/config";

// Charge l'environnement local du workspace (.env.local) puis celui du repo (.env) sans écraser l'existant.
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

// Scénarios cachés (tests/holdout) : hors de `pnpm test` et de `pnpm verify`, joués seuls par scripts/holdout.mjs.
const holdout = process.env.HOLDOUT === "1";

export default defineConfig({
  test: {
    include: holdout ? ["tests/holdout/**/*.test.ts"] : ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: holdout ? configDefaults.exclude : [...configDefaults.exclude, "tests/holdout/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Ajouter ici les points d'entrée qu'aucun test ne charge (ex. src/server.ts) et les migrations.
      exclude: ["src/**/*.test.ts", "src/**/*.gen.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
