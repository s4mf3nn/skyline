// Avancement du projet : où en est chaque spec de la roadmap (à écrire, spécifiée, planifiée, en cours, livrée, en
// production), les étapes du projet lui-même, ce qui bloque et la prochaine commande à lancer.
// Sources : les fichiers du dépôt (roadmap, specs, plans, contrats) lus sur une référence git ou dans l'arbre de
// travail, puis l'état des PR, des baux et des workflows fourni par l'appelant (`scripts/dashboard.mjs`).
// `computeProgress` est pure : aucune lecture de disque, de réseau ni d'horloge, pour rester testable.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { taskOfBranch, taskStatus } from "./board.mjs";
import { ACCEPTANCE_DIR, HOLDOUT_DIR, specOf } from "./contract-files.mjs";
import { isActive } from "./holdout.mjs";
import { parseDependencies } from "./plan-gate.mjs";
import { parseComment } from "./review-journal.mjs";
import { coveredCriteria, parsePlan, section } from "./split-plan.mjs";

/** Étapes d'une spec, dans l'ordre du cycle de `docs/factory/WORKFLOW.md`. */
export const STAGES = ["to-write", "specified", "planned", "in-progress", "delivered", "released"];

const INIT_SCRIPT = "scripts/init-factory.mjs";
const HOTSPOTS = "docs/factory/HOTSPOTS.md";
const LEARNINGS = "docs/factory/LEARNINGS.md";
const TRACKED = [
  "specs",
  ACCEPTANCE_DIR,
  HOLDOUT_DIR,
  "docs/PRODUCT.md",
  "docs/adr/0001-stack.md",
  "docs/factory/WORKFLOW.md",
  "package.json",
  INIT_SCRIPT,
  HOTSPOTS,
  LEARNINGS,
];
const TEXT_FILE = /\.(md|json|mjs|tsx?)$/;
const SPEC_FILE = /^specs\/(SPEC-\d{4})-[^/]+\/spec\.md$/;
const SPEC_ID = /SPEC-\d{4}/g;
const SOCLE = ["SPEC-0000", "SPEC-0001"];
const OFF_ROADMAP = "Hors roadmap";
const STALE_LEASE_HOURS = 24;

// --- Lecture des fichiers ---

/** Fichiers suivis sur une référence git (ex. `origin/main`) : Map chemin → texte. */
export function readFromGit(ref, cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const paths = git("ls-tree", "-r", "-z", "--name-only", ref, "--", ...TRACKED)
    .split("\0")
    .filter((p) => TEXT_FILE.test(p));
  return new Map(paths.map((p) => [p, git("show", `${ref}:${p}`)]));
}

/** Les mêmes fichiers, lus dans l'arbre de travail. */
export function readFromDisk(dir = process.cwd()) {
  const paths = TRACKED.flatMap((tracked) => walk(dir, tracked)).filter((p) => TEXT_FILE.test(p));
  return new Map(paths.map((p) => [p, fs.readFileSync(path.join(dir, p), "utf8")]));
}

/**
 * Date à laquelle chaque `spec.md` est arrivé sur la référence (fusion de la PR de spec) : `{ "SPEC-0002": date ISO }`.
 * Une spec sans date (historique indisponible) est simplement absente.
 */
export function readSpecDates(ref, cwd = process.cwd()) {
  const log = execFileSync(
    "git",
    ["log", "--diff-filter=A", "--name-only", "--format=@%cI", ref, "--", "specs/*/spec.md"],
    { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  const dates = {};
  let date = null;
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) date = line.slice(1);
    const id = SPEC_FILE.exec(line)?.[1];
    // Le journal va du plus récent au plus ancien : la dernière date vue est celle du premier ajout.
    if (id && date) dates[id] = date;
  }
  return dates;
}

function walk(dir, relative) {
  const full = path.join(dir, relative);
  if (!fs.existsSync(full)) return [];
  if (!fs.statSync(full).isDirectory()) return [relative];
  return fs
    .readdirSync(full)
    .sort()
    .flatMap((name) => walk(dir, `${relative}/${name}`));
}

// --- Analyse des fichiers ---

/** Lignes du tableau de `specs/ROADMAP.md` ; les lignes modèles (`<milestone>`) sont ignorées. */
export function parseRoadmap(text) {
  return text
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((row) => row.length >= 5 && !row.some((cell) => /^<.*>$/.test(cell)))
    .map(([order, milestone, spec, subject, dependsOn]) => ({
      order: Number(order),
      milestone,
      spec: spec.match(SPEC_ID)?.[0] ?? null,
      subject,
      dependsOn: dependsOn.match(SPEC_ID) ?? [],
    }));
}

/** Valeur d'une ligne d'en-tête `Libellé : valeur`, ou chaîne vide. */
function headerValue(text, label) {
  const line = text.split("\n").find((l) => l.startsWith(`${label} :`) || l.startsWith(`${label}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, "");

function readPlan(planText) {
  if (!planText) return null;
  const { lines, tasks } = parsePlan(planText);
  return {
    status: headerValue(planText, "Statut"),
    tasks: tasks.map((task) => {
      const body = lines.slice(task.from - 1, task.to - 1);
      return {
        id: task.id,
        title: task.title,
        group: task.group,
        risk: /^- Risque\s*:\s*(\S+)/m.exec(body.join("\n"))?.[1] ?? "",
        criteria: coveredCriteria(body).ids,
      };
    }),
  };
}

function readContract(files, id) {
  const texts = [...files].filter(([p]) => p.startsWith(`${ACCEPTANCE_DIR}/`) && specOf(p) === id).map(([, t]) => t);
  const todos = texts.reduce((count, text) => count + (text.match(/\bit\.todo\s*\(/g)?.length ?? 0), 0);
  return { files: texts.length, todos, delivered: isActive(texts) };
}

/** Ce que les fichiers disent d'une spec, avant de regarder les PR. */
function readSpec(files, specPath) {
  const id = SPEC_FILE.exec(specPath)[1];
  const text = files.get(specPath);
  const criteria = [...text.matchAll(/^- \*\*(C[AU]\d+)\*\*/gm)].map((m) => m[1]);
  const plan = readPlan(files.get(specPath.replace(/spec\.md$/, "plan.md")));
  const covered = new Set(plan?.tasks.flatMap((task) => task.criteria) ?? []);
  const dependencies = parseDependencies(text);
  const questions = stripComments(section(text.split("\n"), "Questions ouvertes") ?? "");
  return {
    id,
    exists: true,
    title: /^# SPEC-\d+\s*:\s*(.+)$/m.exec(text)?.[1].trim() ?? id,
    declaredStatus: headerValue(text, "Statut"),
    risk: headerValue(text, "Risque estimé"),
    dependsOn: dependencies.deps ?? [],
    dependencyError: dependencies.error ?? null,
    criteria,
    uncoveredCriteria: plan ? criteria.filter((c) => !covered.has(c)) : [],
    openQuestions: questions.split("\n").filter((line) => line.startsWith("- ")).length,
    plan,
    contract: readContract(files, id),
    hasHoldout: [...files.keys()].some((p) => p.startsWith(`${HOLDOUT_DIR}/`) && specOf(p) === id),
  };
}

/** Une ligne de roadmap dont la spec n'est pas encore sur la référence lue. */
function unwrittenSpec(row) {
  return {
    id: row.spec,
    exists: false,
    title: row.subject,
    declaredStatus: "",
    risk: "",
    dependsOn: row.dependsOn,
    dependencyError: null,
    criteria: [],
    uncoveredCriteria: [],
    openQuestions: 0,
    plan: null,
    contract: { files: 0, todos: 0, delivered: false },
    hasHoldout: false,
  };
}

/** Specs dans l'ordre de la roadmap, puis celles du dépôt qu'elle ne cite pas. */
function listSpecs(files) {
  const roadmap = parseRoadmap(files.get("specs/ROADMAP.md") ?? "");
  const written = new Map();
  for (const p of files.keys()) if (SPEC_FILE.test(p)) written.set(SPEC_FILE.exec(p)[1], readSpec(files, p));
  const listed = roadmap.map((row) => ({
    ...(written.get(row.spec) ?? unwrittenSpec(row)),
    order: row.order,
    milestone: row.milestone,
    subject: row.subject,
  }));
  const cited = new Set(roadmap.map((row) => row.spec));
  const others = [...written.values()]
    .filter((spec) => !cited.has(spec.id))
    .map((spec) => ({ ...spec, order: null, milestone: OFF_ROADMAP, subject: spec.title }));
  return [...listed, ...others];
}

// --- État des PR, des baux et des revues ---

const isRejection = (verdict) => verdict === "CHANGEMENTS" || verdict === "BLOQUANT";

function reviewOf(pr) {
  const entries = (pr?.comments ?? [])
    .flatMap((comment) => parseComment(comment.body ?? ""))
    .sort((a, b) => a.at.localeCompare(b.at));
  return { passes: entries.length, lastVerdict: entries.at(-1)?.verdict ?? null };
}

function taskProgress(specId, task, prs, leases) {
  const own = prs.filter((pr) => taskOfBranch(pr.headRefName ?? "") === `${specId}/${task.id}`);
  const lease = leases.find((l) => l.task === `${specId}-${task.id}`);
  const pr = own.find((p) => p.mergedAt) ?? own.find((p) => p.state === "OPEN") ?? null;
  return {
    ...task,
    status: taskStatus(own, lease ? "in-progress" : "todo"),
    pr: pr ? { number: pr.number, url: pr.url, mergedAt: pr.mergedAt ?? null } : null,
    review: reviewOf(pr),
    lease: lease ? { workspace: lease.workspace, since: lease.since } : null,
  };
}

/** PR ouverte de spec ou de plan (`docs(spec-xxxx): ...`) d'une spec, ou null. */
function openDocPr(specId, prs) {
  if (!specId) return null;
  const prefix = `docs(${specId.toLowerCase()})`;
  const pr = prs.find((p) => p.state === "OPEN" && (p.title ?? "").toLowerCase().startsWith(prefix));
  return pr ? { number: pr.number, url: pr.url } : null;
}

function stageOf(spec, released) {
  if (spec.contract.delivered) return released ? "released" : "delivered";
  if (!spec.exists) return "to-write";
  if (!spec.plan) return "specified";
  return spec.plan.tasks.some((task) => task.status !== "todo") ? "in-progress" : "planned";
}

/** Date de fusion de la dernière tâche d'une spec livrée, ou null si aucune PR de tâche n'est connue. */
function deliveredAt(spec) {
  if (!spec.contract.delivered || !spec.plan) return null;
  const dates = spec.plan.tasks.map((task) => task.pr?.mergedAt).filter(Boolean);
  return dates.length > 0 ? dates.sort().at(-1) : null;
}

/** PR de correctif fusionnées d'une spec (`fix(spec-xxxx): ...`, posées par `/fix`). */
function mergedFixes(specId, prs) {
  if (!specId) return 0;
  const prefix = `fix(${specId.toLowerCase()})`;
  return prs.filter((pr) => pr.mergedAt && (pr.title ?? "").toLowerCase().startsWith(prefix)).length;
}

const daysBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 864e5;

function withStatus(spec, { prs, leases, lastRelease, specDates }) {
  const plan = spec.plan && {
    ...spec.plan,
    tasks: spec.plan.tasks.map((task) => taskProgress(spec.id, task, prs, leases)),
  };
  const tracked = { ...spec, plan };
  const at = deliveredAt(tracked);
  // Une livraison part de main : elle contient toute spec dont la dernière tâche a été fusionnée avant son lancement.
  const released = Boolean(lastRelease && at && at <= lastRelease.createdAt);
  const specifiedAt = specDates[spec.id] ?? null;
  return {
    ...tracked,
    specifiedAt,
    deliveredAt: at,
    leadTimeDays: specifiedAt && at ? daysBetween(specifiedAt, at) : null,
    fixes: mergedFixes(spec.id, prs),
    stage: stageOf(tracked, released),
    docPr: openDocPr(spec.id, prs),
  };
}

// --- Bloquants et prochaines actions ---

const isDone = (spec) => spec.stage === "delivered" || spec.stage === "released";

function missingDependencies(spec, specs) {
  const delivered = new Set(specs.filter(isDone).map((s) => s.id));
  return spec.dependsOn.filter((dep) => !delivered.has(dep));
}

function taskBlockers(spec, task, now) {
  const out = [];
  if (task.status === "in-review" && isRejection(task.review.lastVerdict))
    out.push({
      spec: spec.id,
      kind: "review-rejected",
      message: `${task.id} : dernier verdict du relecteur ${task.review.lastVerdict} (PR #${task.pr.number})`,
    });
  const leaseHours = task.lease ? (Date.parse(now) - Date.parse(task.lease.since)) / 3.6e6 : 0;
  if (task.status === "in-progress" && leaseHours > STALE_LEASE_HOURS)
    out.push({
      spec: spec.id,
      kind: "stale-lease",
      message: `${task.id} : bail posé depuis ${Math.round(leaseHours)} h sans PR (${task.lease.workspace})`,
    });
  return out;
}

function specBlockers(spec, specs, now) {
  if (!spec.exists || isDone(spec)) return [];
  const out = [];
  const add = (kind, message) => out.push({ spec: spec.id, kind, message });
  const missing = missingDependencies(spec, specs);
  if (spec.contract.todos > 0)
    add("contract-todo", `${spec.contract.todos} test(s) de contrat encore en it.todo : à écrire par l'humain`);
  if (spec.openQuestions > 0) add("open-questions", `${spec.openQuestions} question(s) ouverte(s) dans la spec`);
  // Même refus que `plan-gate.mjs` : une ligne illisible ne vaut pas « aucune dépendance ».
  if (spec.dependencyError) add("dependency-unreadable", spec.dependencyError);
  if (missing.length > 0) add("dependency", `dépend de ${missing.join(", ")}, pas encore livrée(s)`);
  if (spec.plan && spec.plan.status !== "PRÊT") add("plan-blocked", `plan ${spec.plan.status || "sans statut"}`);
  if (spec.uncoveredCriteria.length > 0)
    add("uncovered-criteria", `critères couverts par aucune tâche : ${spec.uncoveredCriteria.join(", ")}`);
  for (const task of spec.plan?.tasks ?? []) out.push(...taskBlockers(spec, task, now));
  return out;
}

/** Tâches à lancer : celles qui restent `todo` dans le premier groupe non terminé (les groupes s'enchaînent). */
function startableTasks(plan) {
  const group = plan.tasks.find((task) => task.status !== "done")?.group;
  return plan.tasks.filter((task) => task.group === group && task.status === "todo");
}

function specActions(spec, blockers) {
  const blocked = (...kinds) => blockers.some((b) => b.spec === spec.id && kinds.includes(b.kind));
  const action = (command, reason) => ({ spec: spec.id, command, reason });
  if (spec.stage === "to-write") {
    if (spec.docPr) return [action(`/land ${spec.docPr.number}`, "PR de spec ouverte : à relire et fusionner")];
    return [action(`/new-spec ${spec.subject}`, "ligne de roadmap sans spec")];
  }
  if (spec.stage === "specified") {
    if (spec.docPr) return [action(`/land ${spec.docPr.number}`, "PR de plan ouverte : à relire et fusionner")];
    if (blocked("contract-todo", "open-questions", "dependency", "dependency-unreadable")) return [];
    return [action(`/plan ${spec.id}`, "spec fusionnée, dépendances livrées")];
  }
  if (isDone(spec) || blocked("plan-blocked", "dependency", "dependency-unreadable")) return [];
  const toLand = spec.plan.tasks
    .filter((task) => task.status === "in-review" && !isRejection(task.review.lastVerdict))
    .map((task) => action(`/land ${task.pr.number}`, `${task.id} en revue`));
  const toStart = startableTasks(spec.plan).map((task) =>
    action(`/implement ${spec.id} ${task.id}`, `${task.group || "groupe courant"} débloqué`),
  );
  return [...toLand, ...toStart];
}

function nextActions(steps, specs, blockers) {
  const pending = (key) => steps.some((step) => step.key === key && !step.done);
  const init = { spec: null, command: "/init-project", reason: "le boilerplate n'est pas encore personnalisé" };
  const framing = { spec: null, command: "/roadmap <brief>", reason: "le cadrage est incomplet" };
  if (pending("init")) return [init];
  if (pending("framing")) return [framing];
  const actions = specs.flatMap((spec) => specActions(spec, blockers));
  const toRelease = specs.filter((spec) => spec.stage === "delivered").map((spec) => spec.id);
  if (toRelease.length > 0 && !pending("delivery"))
    actions.push({
      spec: null,
      command: "workflow release",
      reason: `livrée(s), pas en production : ${toRelease.join(", ")}`,
    });
  return actions;
}

// --- Étapes du projet et totaux ---

function framingGaps(files, specs) {
  const gaps = [];
  const product = files.get("docs/PRODUCT.md") ?? "";
  const problem = stripComments(section(product.split("\n"), "Problème") ?? "");
  if (!problem.trim()) gaps.push("docs/PRODUCT.md : section « Problème » vide");
  if ((files.get("docs/adr/0001-stack.md") ?? "").includes("<à compléter>"))
    gaps.push("docs/adr/0001-stack.md : tableau des technologies à compléter");
  if (!specs.some((spec) => spec.order !== null && !SOCLE.includes(spec.id)))
    gaps.push("specs/ROADMAP.md : aucune tranche métier");
  return gaps;
}

function projectSteps(files, specs, lastRelease) {
  const delivered = (id) => specs.some((spec) => spec.id === id && isDone(spec));
  const business = specs.filter((spec) => !SOCLE.includes(spec.id));
  const done = business.filter(isDone).length;
  const gaps = framingGaps(files, specs);
  const initialised = !files.has(INIT_SCRIPT);
  const steps = [
    { key: "init", label: "Initialisation", done: initialised, detail: initialised ? "" : "/init-project à lancer" },
    { key: "framing", label: "Cadrage", done: gaps.length === 0, detail: gaps.join(" ; ") },
    { key: "bootstrap", label: "Socle", done: delivered("SPEC-0000"), detail: "SPEC-0000" },
    { key: "delivery", label: "Livraison prête", done: delivered("SPEC-0001"), detail: "SPEC-0001" },
    {
      key: "features",
      label: "Specs métier",
      done: business.length > 0 && done === business.length,
      detail: `${done} / ${business.length}`,
    },
    {
      key: "production",
      label: "En production",
      done: Boolean(lastRelease),
      detail: lastRelease ? `dernière livraison le ${lastRelease.createdAt.slice(0, 10)}` : "aucune livraison",
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  return steps.map((step, i) => ({ ...step, status: step.done ? "done" : i === current ? "current" : "todo" }));
}

function countTasks(specs) {
  const tasks = specs.flatMap((spec) => spec.plan?.tasks ?? []);
  const count = (status) => tasks.filter((task) => task.status === status).length;
  return {
    specs: specs.length,
    specsDelivered: specs.filter(isDone).length,
    tasks: tasks.length,
    tasksDone: count("done"),
    tasksInReview: count("in-review"),
    tasksInProgress: count("in-progress"),
  };
}

function byMilestone(specs) {
  const names = [...new Set(specs.map((spec) => spec.milestone))];
  return names.map((milestone) => ({
    milestone,
    ...countTasks(specs.filter((spec) => spec.milestone === milestone)),
  }));
}

// --- Rythme ---

/** Lundi (UTC) de la semaine d'une date ISO, au format AAAA-MM-JJ. */
function weekOf(iso) {
  const date = new Date(iso);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - sinceMonday * 864e5).toISOString().slice(0, 10);
}

/** Tâches fusionnées par semaine et leur cumul, sans trou entre la première et la dernière semaine. */
function weeklyMerges(specs) {
  const merges = specs.flatMap((spec) => spec.plan?.tasks ?? []).flatMap((task) => task.pr?.mergedAt ?? []);
  if (merges.length === 0) return [];
  const perWeek = new Map();
  for (const at of merges) perWeek.set(weekOf(at), (perWeek.get(weekOf(at)) ?? 0) + 1);
  const weeks = [...perWeek.keys()].sort();
  const out = [];
  let cumulative = 0;
  for (let week = weeks[0]; week <= weeks.at(-1); week = weekOf(new Date(Date.parse(week) + 7 * 864e5).toISOString())) {
    const merged = perWeek.get(week) ?? 0;
    cumulative += merged;
    out.push({ week, merged, cumulative });
  }
  return out;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Lignes de données d'un tableau Markdown dont la première cellule est une date. */
const datedRows = (text) => text.split("\n").filter((line) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line)).length;

function activeRules(text) {
  const rules = section(text.split("\n"), "Règles actives") ?? "";
  return rules.split("\n").filter((line) => line.startsWith("- ") && line.trim() !== "- (vide)").length;
}

function rhythmOf(files, specs, bugs) {
  return {
    weeks: weeklyMerges(specs),
    leadTimeMedianDays: median(specs.map((spec) => spec.leadTimeDays).filter((days) => days !== null)),
    bugsOpen: bugs.filter((bug) => bug.state === "OPEN").length,
    bugsTotal: bugs.length,
    fixes: specs.reduce((count, spec) => count + spec.fixes, 0),
    conflicts: datedRows(files.get(HOTSPOTS) ?? ""),
    activeRules: activeRules(files.get(LEARNINGS) ?? ""),
  };
}

function projectName(files) {
  try {
    return JSON.parse(files.get("package.json") ?? "{}").name ?? "";
  } catch {
    return "";
  }
}

/**
 * Avancement du projet.
 * `files` : Map chemin → texte (`readFromGit` ou `readFromDisk`) ; `prs` : PR GitHub (number, title, state, mergedAt,
 * headRefName, url, comments) ; `leases` : baux actifs (`scripts/lease.mjs`) ; `lastRelease` : dernier run vert du
 * workflow `release` (`{ createdAt }`) ou null ; `gates` : conclusion du dernier run `gates` sur main ou null ;
 * `specDates` : date d'arrivée de chaque spec (`readSpecDates`) ; `bugs` : issues `bug` (`{ state }`) ;
 * `now` : date ISO de l'appel.
 */
export function computeProgress({
  files,
  prs = [],
  leases = [],
  lastRelease = null,
  gates = null,
  specDates = {},
  bugs = [],
  now,
}) {
  const specs = listSpecs(files).map((spec) => withStatus(spec, { prs, leases, lastRelease, specDates }));
  const steps = projectSteps(files, specs, lastRelease);
  const blockers = specs.flatMap((spec) => specBlockers(spec, specs, now));
  if (gates === "failure")
    blockers.unshift({
      spec: null,
      kind: "gates-red",
      message: "gates est rouge sur main : /land refuse toute fusion",
    });
  return {
    project: {
      name: projectName(files),
      autonomyPhase:
        Number(/Phase en cours : (\d)/.exec(files.get("docs/factory/WORKFLOW.md") ?? "")?.[1] ?? 0) || null,
      gates,
      steps,
    },
    specs,
    totals: { ...countTasks(specs), blockers: blockers.length },
    milestones: byMilestone(specs),
    rhythm: rhythmOf(files, specs, bugs),
    blockers,
    nextActions: nextActions(steps, specs, blockers),
  };
}
