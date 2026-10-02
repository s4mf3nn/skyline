#!/usr/bin/env node
// Tableau de suivi visuel : une issue GitHub par spec et par tâche du plan, avec un statut dérivé de l'état réel
// des PR (aucun déplacement de carte à la main). Si un GitHub Project est configuré, le champ Status est synchronisé.
// Usage :
//   node scripts/board.mjs sync [--dry-run]    crée ou met à jour les issues (idempotent), lit specs/ de la branche courante
//   node scripts/board.mjs start <SPEC-XXXX> <T#>    passe la tâche « en cours » (appelé par /implement après le bail)
// Variables : GH_TOKEN (gh), BOARD_PROJECT="<owner>/<numéro>" (optionnel, Project v2 avec un champ Status).
// Statuts : todo (aucune PR) → in-progress (`start`) → in-review (PR ouverte) → done (PR fusionnée, issue fermée).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parsePlan } from "./split-plan.mjs";

const STATUSES = ["todo", "in-progress", "in-review", "done"];
const STATUS_LABEL_PREFIX = "status:";
const BASE_LABELS = { factory: "5319e7", spec: "0e8a16", task: "1d76db" };
const PROJECT_OPTION_NAMES = {
  todo: ["todo", "backlog"],
  "in-progress": ["in progress"],
  "in-review": ["in review"],
  done: ["done"],
};

const marker = (id) => `<!-- factory-id: ${id} -->`;
const MARKER_PATTERN = /<!-- factory-id: (\S+) -->/;

/** Lit specs/ : une entrée par spec avec son titre, son statut déclaré et les tâches de son plan. */
export function readSpecs(specsDir) {
  if (!fs.existsSync(specsDir)) return [];
  return fs
    .readdirSync(specsDir)
    .filter((name) => /^SPEC-\d+/.test(name))
    .sort()
    .map((dir) => {
      const specText = readIfExists(path.join(specsDir, dir, "spec.md"));
      const planText = readIfExists(path.join(specsDir, dir, "plan.md"));
      const id = /^(SPEC-\d+)/.exec(dir)[1];
      const title = /^# SPEC-\d+\s*:\s*(.+)$/m.exec(specText)?.[1].trim() ?? dir;
      const declaredStatus = /^Statut\s*:\s*(.+)$/m.exec(specText)?.[1].trim() ?? "";
      return {
        id,
        dir,
        title,
        declaredStatus,
        tasks: planText ? parsePlanTasks(planText) : [],
        hasPlan: Boolean(planText),
      };
    });
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function parsePlanTasks(planText) {
  const { lines, tasks } = parsePlan(planText);
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    group: task.group,
    // Le corps de la tâche, sans son titre : périmètre, dépendances, risque, critères, définition de fini.
    details: lines
      .slice(task.from, task.to - 1)
      .join("\n")
      .trim(),
  }));
}

/** Retrouve la tâche visée par une branche `[préfixe/]spec-xxxx-t#-slug`. */
export function taskOfBranch(branch) {
  const m = /spec-(\d+)-t(\d+)/i.exec(branch);
  return m ? `SPEC-${m[1]}/T${m[2]}` : null;
}

/** Statut d'une tâche d'après ses PR ; `current` conserve « en cours » tant qu'aucune PR n'existe. */
export function taskStatus(prs, current) {
  // « done » est acquis : une PR sortie de la liste récupérée ne doit pas rouvrir la tâche.
  if (current === "done" || prs.some((pr) => pr.mergedAt)) return "done";
  if (prs.some((pr) => pr.state === "OPEN")) return "in-review";
  return current === "in-progress" ? "in-progress" : "todo";
}

/** Statut d'une spec d'après ses tâches. */
export function specStatus(taskStatuses, declaredStatus) {
  if (taskStatuses.length > 0 && taskStatuses.every((s) => s === "done")) return "done";
  if (taskStatuses.length === 0 && /livrée/i.test(declaredStatus)) return "done";
  return taskStatuses.some((s) => s !== "todo") ? "in-progress" : "todo";
}

export function taskBody(spec, task, specIssueNumber, prUrls) {
  return [
    marker(`${spec.id}/${task.id}`),
    `Spec : #${specIssueNumber} (\`specs/${spec.dir}/spec.md\`)`,
    `Groupe : ${task.group || "non précisé"}`,
    prUrls.length > 0 ? `PR : ${prUrls.join(", ")}` : "PR : aucune pour l'instant",
    "",
    task.details,
    "",
    `Pour implémenter : \`/implement ${spec.id} ${task.id}\``,
  ].join("\n");
}

export function specBody(spec, taskRows) {
  const checklist = taskRows.map((row) => `- [${row.done ? "x" : " "}] #${row.number} ${row.id} : ${row.title}`);
  return [
    marker(spec.id),
    `Fichier : \`specs/${spec.dir}/spec.md\` · Statut déclaré : ${spec.declaredStatus || "inconnu"}`,
    "",
    spec.hasPlan ? "## Tâches" : `Pas de plan pour l'instant : \`/plan ${spec.id}\``,
    ...checklist,
  ].join("\n");
}

// --- Accès à GitHub (CLI gh) ---

function gh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] });
}

function ghJson(args, input) {
  return JSON.parse(gh(args, input));
}

const repoName = () =>
  process.env.GITHUB_REPOSITORY ?? ghJson(["repo", "view", "--json", "nameWithOwner"]).nameWithOwner;

function fetchFactoryIssues(repo) {
  const issues = ghJson([
    "api",
    "--paginate",
    "--slurp",
    `repos/${repo}/issues?state=all&labels=factory&per_page=100`,
  ]).flat();
  const byId = new Map();
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const id = MARKER_PATTERN.exec(issue.body ?? "")?.[1];
    if (id) byId.set(id, issue);
  }
  return byId;
}

function fetchPullRequests() {
  return ghJson(["pr", "list", "--state", "all", "--limit", "500", "--json", "headRefName,state,mergedAt,url"]);
}

function ensureLabels(repo, dryRun) {
  const wanted = {
    ...BASE_LABELS,
    ...Object.fromEntries(STATUSES.filter((s) => s !== "done").map((s) => [`${STATUS_LABEL_PREFIX}${s}`, "ededed"])),
  };
  const existing = new Set(
    ghJson(["api", "--paginate", "--slurp", `repos/${repo}/labels?per_page=100`])
      .flat()
      .map((l) => l.name),
  );
  for (const [name, color] of Object.entries(wanted)) {
    if (existing.has(name) || dryRun) continue;
    gh(["api", `repos/${repo}/labels`, "-f", `name=${name}`, "-f", `color=${color}`]);
  }
}

export function currentStatus(issue) {
  if (issue?.state === "closed" && issue.state_reason === "completed") return "done";
  const label = issue?.labels.map((l) => l.name).find((name) => name.startsWith(STATUS_LABEL_PREFIX));
  return label ? label.slice(STATUS_LABEL_PREFIX.length) : "todo";
}

export function labelsFor(kind, status, issue) {
  // On garde les étiquettes posées à la main, on remplace seulement celles du tableau.
  const manual = (issue?.labels ?? [])
    .map((l) => l.name)
    .filter((n) => !Object.hasOwn(BASE_LABELS, n) && !n.startsWith(STATUS_LABEL_PREFIX));
  const statusLabel = status === "done" ? [] : [`${STATUS_LABEL_PREFIX}${status}`];
  return ["factory", kind, ...statusLabel, ...manual];
}

/** Crée ou met à jour une issue ; ne fait aucun appel si rien n'a changé. Renvoie l'issue à jour. */
function upsertIssue(repo, { existing, title, body, kind, status, dryRun }) {
  const labels = labelsFor(kind, status, existing);
  const state = status === "done" ? "closed" : "open";
  if (existing && sameIssue(existing, { title, body, labels, state })) return existing;
  console.log(`${existing ? "maj" : "création"} : ${title} [${status}]`);
  if (dryRun) return existing ?? { number: 0, id: 0, node_id: "", labels: [], title, body, state };
  if (existing) return patchIssue(repo, existing.number, { title, body, labels, ...closedFields(state) });
  const created = ghJson(
    ["api", "-X", "POST", `repos/${repo}/issues`, "--input", "-"],
    JSON.stringify({ title, body, labels }),
  );
  // L'API ne crée pas une issue directement fermée : on la ferme juste après.
  return state === "closed" ? patchIssue(repo, created.number, closedFields(state)) : created;
}

const closedFields = (state) => (state === "closed" ? { state, state_reason: "completed" } : { state });

function patchIssue(repo, number, fields) {
  return ghJson(["api", "-X", "PATCH", `repos/${repo}/issues/${number}`, "--input", "-"], JSON.stringify(fields));
}

export function sameIssue(issue, wanted) {
  const labels = issue.labels.map((l) => l.name).sort();
  return (
    issue.title === wanted.title &&
    (issue.body ?? "") === wanted.body &&
    issue.state === wanted.state &&
    JSON.stringify(labels) === JSON.stringify([...wanted.labels].sort())
  );
}

function linkSubIssue(repo, parent, child) {
  try {
    gh(["api", "-X", "POST", `repos/${repo}/issues/${parent.number}/sub_issues`, "-F", `sub_issue_id=${child.id}`]);
  } catch {
    // Déjà lié, ou sous-tickets indisponibles : la liste de tâches du corps de la spec suffit.
  }
}

// --- GitHub Project v2 (optionnel) ---

function loadProject() {
  const config = process.env.BOARD_PROJECT;
  if (!config) return null;
  const [owner, number] = config.split("/");
  const query = `query($owner: String!, $number: Int!) { repositoryOwner(login: $owner) { ... on ProjectV2Owner { projectV2(number: $number) { id fields(first: 30) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } } } } }`;
  const data = ghJson(["api", "graphql", "-f", `query=${query}`, "-f", `owner=${owner}`, "-F", `number=${number}`]);
  const project = data.data.repositoryOwner?.projectV2;
  const statusField = project?.fields.nodes.find((f) => f?.name === "Status");
  if (!project || !statusField) {
    console.warn(`Project ${config} introuvable ou sans champ Status : synchronisation du Project ignorée.`);
    return null;
  }
  return { id: project.id, statusField };
}

function setProjectStatus(project, issue, status) {
  const names = PROJECT_OPTION_NAMES[status];
  const option = project.statusField.options.find((o) => names.includes(o.name.toLowerCase()));
  if (!option) {
    console.warn(`Colonne introuvable dans le champ Status pour « ${status} » (attendu : ${names.join(" ou ")}).`);
    return;
  }
  const add = `mutation($project: ID!, $content: ID!) { addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } } }`;
  const added = ghJson([
    "api",
    "graphql",
    "-f",
    `query=${add}`,
    "-f",
    `project=${project.id}`,
    "-f",
    `content=${issue.node_id}`,
  ]);
  const set = `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) { updateProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field, value: {singleSelectOptionId: $option}}) { projectV2Item { id } } }`;
  gh([
    "api",
    "graphql",
    "-f",
    `query=${set}`,
    "-f",
    `project=${project.id}`,
    "-f",
    `item=${added.data.addProjectV2ItemById.item.id}`,
    "-f",
    `field=${project.statusField.id}`,
    "-f",
    `option=${option.id}`,
  ]);
}

// --- Commandes ---

function sync({ dryRun }) {
  const repo = repoName();
  const specs = readSpecs("specs");
  ensureLabels(repo, dryRun);
  const issues = fetchFactoryIssues(repo);
  const prsByTask = groupPrsByTask(fetchPullRequests());
  const project = dryRun ? null : loadProject();

  for (const spec of specs) {
    const specKey = spec.id;
    const specTitle = `[${spec.id}] ${spec.title}`;
    let specIssue = issues.get(specKey);
    if (!specIssue)
      specIssue = upsertIssue(repo, {
        title: specTitle,
        body: specBody(spec, []),
        kind: "spec",
        status: "todo",
        dryRun,
      });

    const rows = [];
    const statuses = [];
    for (const task of spec.tasks) {
      const key = `${spec.id}/${task.id}`;
      const prs = prsByTask.get(key) ?? [];
      const existing = issues.get(key);
      const status = taskStatus(prs, currentStatus(existing));
      const issue = upsertIssue(repo, {
        existing,
        title: `[${spec.id}/${task.id}] ${task.title}`,
        body: taskBody(
          spec,
          task,
          specIssue.number,
          prs.map((pr) => pr.url),
        ),
        kind: "task",
        status,
        dryRun,
      });
      if (!existing && !dryRun) linkSubIssue(repo, specIssue, issue);
      if (project && !dryRun) setProjectStatus(project, issue, status);
      rows.push({ id: task.id, title: task.title, number: issue.number, done: status === "done" });
      statuses.push(status);
    }

    const status = specStatus(statuses, spec.declaredStatus);
    specIssue = upsertIssue(repo, {
      existing: specIssue,
      title: specTitle,
      body: specBody(spec, rows),
      kind: "spec",
      status,
      dryRun,
    });
    if (project && !dryRun) setProjectStatus(project, specIssue, status);
  }
  console.log(`Tableau synchronisé : ${specs.length} spec(s).`);
}

function groupPrsByTask(prs) {
  const byTask = new Map();
  for (const pr of prs) {
    const key = taskOfBranch(pr.headRefName);
    if (key) byTask.set(key, [...(byTask.get(key) ?? []), pr]);
  }
  return byTask;
}

function start(specId, taskId) {
  const repo = repoName();
  const issue = fetchFactoryIssues(repo).get(`${specId.toUpperCase()}/${taskId.toUpperCase()}`);
  if (!issue) {
    console.log(
      `Pas d'issue pour ${specId}/${taskId} : lance \`node scripts/board.mjs sync\` (ou attends la CI). On continue sans.`,
    );
    return;
  }
  const labels = labelsFor("task", "in-progress", issue);
  patchIssue(repo, issue.number, { labels });
  const project = loadProject();
  if (project) setProjectStatus(project, issue, "in-progress");
  console.log(`Issue #${issue.number} passée « en cours ».`);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "sync") return sync({ dryRun: args.includes("--dry-run") });
  if (command === "start" && args.length === 2) return start(args[0], args[1]);
  console.error("Usage : node scripts/board.mjs sync [--dry-run] | start <SPEC-XXXX> <T#>");
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
