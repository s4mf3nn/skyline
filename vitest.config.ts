import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Charge l'environnement local du workspace (.env.local) puis celui du repo (.env) sans écraser l'existant.
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Ajouter ici les points d'entrée qu'aucun test ne charge (ex. src/server.ts) et les migrations.
      exclude: ["src/**/*.test.ts", "src/**/*.gen.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
