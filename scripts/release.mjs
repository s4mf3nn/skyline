// Livraison : suite de commandes selon RELEASE_PROFILE, exécutée pas à pas, arrêt au premier échec.
// Les secrets (EXPO_TOKEN, SENTRY_AUTH_TOKEN) restent dans l'environnement du processus, jamais dans les arguments.

import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PROFILES = ["preview", "production"];
// Même version que la dépendance de @sentry/react-native ~7.11.0.
const SENTRY_CLI_VERSION = "2.58.4";

// Sans RELEASE_PROFILE on prend « preview » : jamais de soumission aux stores par défaut.
export function readProfile(env) {
  const profile = env.RELEASE_PROFILE || "preview";
  if (!PROFILES.includes(profile)) {
    throw new Error(`Unknown RELEASE_PROFILE "${profile}", expected one of: ${PROFILES.join(", ")}`);
  }
  return profile;
}

// Supprime les sourcemaps d'un dossier (récursif) : `eas update` publie `dist/` tel quel.
export function removeSourceMaps(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      removeSourceMaps(path);
    } else if (entry.name.endsWith(".map")) {
      rmSync(path);
    }
  }
}

export function releaseSteps(profile, sha) {
  const build = ["eas", "build", "--platform", "all", "--profile", profile, "--non-interactive"];
  if (profile === "production") {
    build.push("--auto-submit");
  }
  return [
    { cmd: "npx", args: build },
    { cmd: "npx", args: ["expo", "export", "--platform", "all", "--output-dir", "dist", "--source-maps"] },
    // SENTRY_AUTH_TOKEN, SENTRY_ORG et SENTRY_PROJECT sont lus dans l'environnement du runner, jamais passés en argument.
    { cmd: "npx", args: [`--package=@sentry/cli@${SENTRY_CLI_VERSION}`, "sentry-cli", "releases", "new", sha] },
    { cmd: "npx", args: ["--package=@sentry/react-native", "sentry-expo-upload-sourcemaps", "dist"] },
    // Aucune sourcemap ne doit être servie : `eas update` publie `dist/` tel quel.
    { cmd: "node", args: ["scripts/release.mjs", "--remove-maps", "dist"] },
    {
      cmd: "npx",
      args: ["eas", "update", "--channel", profile, "--message", sha, "--skip-bundler", "--non-interactive"],
    },
    { cmd: "npx", args: [`--package=@sentry/cli@${SENTRY_CLI_VERSION}`, "sentry-cli", "releases", "finalize", sha] },
  ];
}

function run() {
  const profile = readProfile(process.env);
  const sha = process.env.GITHUB_SHA || "local";
  for (const step of releaseSteps(profile, sha)) {
    console.log(`> ${step.cmd} ${step.args.join(" ")}`);
    const result = spawnSync(step.cmd, step.args, { stdio: "inherit", env: process.env });
    if (result.status !== 0) {
      console.error(`Échec de l'étape : ${step.cmd} ${step.args.join(" ")}`);
      process.exit(result.status ?? 1);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "--remove-maps") {
      removeSourceMaps(process.argv[3]);
    } else {
      run();
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
