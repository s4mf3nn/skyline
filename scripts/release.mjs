// Livraison : suite de commandes selon RELEASE_PROFILE, exécutée pas à pas, arrêt au premier échec.
// Les secrets (EXPO_TOKEN, SENTRY_AUTH_TOKEN) restent dans l'environnement du processus, jamais dans les arguments.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROFILES = ["preview", "production"];

// Sans RELEASE_PROFILE on prend « preview » : jamais de soumission aux stores par défaut.
export function readProfile(env) {
  const profile = env.RELEASE_PROFILE || "preview";
  if (!PROFILES.includes(profile)) {
    throw new Error(`Unknown RELEASE_PROFILE "${profile}", expected one of: ${PROFILES.join(", ")}`);
  }
  return profile;
}

export function releaseSteps(profile, sha) {
  const build = ["eas", "build", "--platform", "all", "--profile", profile, "--non-interactive"];
  if (profile === "production") {
    build.push("--auto-submit");
  }
  return [
    { cmd: "npx", args: build },
    { cmd: "npx", args: ["expo", "export", "--platform", "all", "--output-dir", "dist"] },
    {
      cmd: "npx",
      args: ["eas", "update", "--channel", profile, "--message", sha, "--skip-bundler", "--non-interactive"],
    },
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
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
