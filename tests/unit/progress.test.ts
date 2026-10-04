import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Pr {
  number: number;
  title: string;
  state: string;
  mergedAt: string | null;
  headRefName: string;
  url: string;
  comments: { body: string }[];
}
interface Lease {
  task: string;
  paths: string[];
  workspace: string;
  since: string;
}
interface Task {
  id: string;
  group: string;
  risk: string;
  criteria: string[];
  status: string;
  pr: { number: number } | null;
  review: { passes: number; lastVerdict: string | null };
}
interface Spec {
  id: string | null;
  exists: boolean;
  title: string;
  milestone: string;
  stage: string;
  dependsOn: string[];
  uncoveredCriteria: string[];
  openQuestions: number;
  contract: { files: number; todos: number; delivered: boolean };
  hasHoldout: boolean;
  deliveredAt: string | null;
  specifiedAt: string | null;
  leadTimeDays: number | null;
  fixes: number;
  plan: { status: string; tasks: Task[] } | null;
}
interface Progress {
  project: {
    name: string;
    autonomyPhase: number | null;
    steps: { key: string; status: string; detail: string }[];
  };
  specs: Spec[];
  totals: { specs: number; specsDelivered: number; tasks: number; tasksDone: number; tasksInReview: number };
  milestones: { milestone: string; specs: number; specsDelivered: number }[];
  rhythm: {
    weeks: { week: string; merged: number; cumulative: number }[];
    leadTimeMedianDays: number | null;
    bugsOpen: number;
    bugsTotal: number;
    fixes: number;
    conflicts: number;
    activeRules: number;
  };
  blockers: { spec: string | null; kind: string }[];
  nextActions: { spec: string | null; command: string }[];
}
interface ProgressModule {
  parseRoadmap(text: string): { order: number; milestone: string; spec: string | null; dependsOn: string[] }[];
  readFromDisk(dir: string): Map<string, string>;
  readFromGit(ref: string, dir: string): Map<string, string>;
  readSpecDates(ref: string, dir: string): Record<string, string>;
  computeProgress(input: {
    files: Map<string, string>;
    prs?: Pr[];
    leases?: Lease[];
    lastRelease?: { createdAt: string } | null;
    gates?: string | null;
    specDates?: Record<string, string>;
    bugs?: { state: string }[];
    now: string;
  }): Progress;
}
interface Journal {
  buildComment(entries: { at: string; verdict: string; pass: number }[]): string;
}
const progress = (await import(pathToFileURL(path.resolve("scripts/progress.mjs")).href)) as ProgressModule;
const journal = (await import(pathToFileURL(path.resolve("scripts/review-journal.mjs")).href)) as Journal;

const NOW = "2026-10-05T12:00:00.000Z";
const ROADMAP = `# Roadmap des specs

| Ordre | Milestone | Spec | Objet | Dépend de |
|---|---|---|---|---|
| 1 | Socle | SPEC-0000 | Bootstrap du projet | aucune |
| 2 | Socle | SPEC-0001 | Livraison | SPEC-0000 |
| 3 | MVP | SPEC-0002 | Créer un lien court | SPEC-0000 |
| 4 | MVP | à écrire | Statistiques d'un lien | SPEC-0002 |
| 5 | <milestone> | à écrire | <objet> | SPEC-0000 |
`;
const spec = (id: string, dependsOn: string, questions = "") => `# ${id} : Titre de ${id}

Statut : VALIDÉE
Risque estimé : moyen
Dépend de : ${dependsOn}

## Critères d'acceptation
- **CA1** : premier critère
- **CA2** : second critère

## Questions ouvertes
<!-- - question en commentaire, ignorée -->
${questions}
`;
const PLAN = `# Plan SPEC-0002
Statut : PRÊT

## Groupe 1 (parallèle)
### T1 : Schéma et service
- Risque : moyen (logique métier)
- Critères de la spec couverts : CA1

### T2 : Route
- Risque : faible
- Critères de la spec couverts : CA1

## Groupe 2 (après fusion du groupe 1)
### T3 : Clôture
- Risque : faible
- Critères de la spec couverts : CA1
`;
const contract = (id: string, skip: boolean) =>
  `describe${skip ? ".skip" : ""}("${id}", () => { it("CA1", () => {}); });`;

/** Projet initialisé et cadré : socle livré, SPEC-0001 spécifiée, SPEC-0002 planifiée, une ligne à écrire. */
function project(overrides: Record<string, string | null> = {}): Map<string, string> {
  const files = new Map<string, string>([
    ["package.json", JSON.stringify({ name: "short-links" })],
    ["docs/PRODUCT.md", "# Produit\n\n## Problème\nLes liens sont trop longs.\n\n## Hypothèses\n"],
    ["docs/adr/0001-stack.md", "| Hono | framework serveur | choisie |"],
    ["docs/factory/WORKFLOW.md", "Critère de passage : voir METRICS.md. Phase en cours : 2."],
    ["specs/ROADMAP.md", ROADMAP],
    ["specs/SPEC-0000-bootstrap/spec.md", spec("SPEC-0000", "aucune")],
    ["specs/SPEC-0001-delivery/spec.md", spec("SPEC-0001", "SPEC-0000")],
    ["specs/SPEC-0002-short-link/spec.md", spec("SPEC-0002", "SPEC-0000")],
    ["specs/SPEC-0002-short-link/plan.md", PLAN],
    ["tests/acceptance/SPEC-0000.test.ts", contract("SPEC-0000", false)],
    ["tests/acceptance/SPEC-0001.test.ts", contract("SPEC-0001", true)],
    ["tests/acceptance/SPEC-0002.test.ts", contract("SPEC-0002", true)],
    ["tests/holdout/SPEC-0002.test.ts", "describe('parcours', () => {});"],
  ]);
  for (const [file, text] of Object.entries(overrides)) {
    if (text === null) files.delete(file);
    else files.set(file, text);
  }
  return files;
}

const pr = (
  number: number,
  branch: string,
  state: string,
  mergedAt: string | null = null,
  verdicts: string[] = [],
): Pr => ({
  number,
  title: `feat: PR ${number}`,
  state,
  mergedAt,
  headRefName: branch,
  url: `https://example.test/pull/${number}`,
  comments:
    verdicts.length === 0
      ? []
      : [
          {
            body: journal.buildComment(
              verdicts.map((verdict, i) => ({ at: `2026-10-01T10:0${i}:00.000Z`, verdict, pass: i + 1 })),
            ),
          },
        ],
});

const specOf = (result: Progress, id: string): Spec => {
  const found = result.specs.find((s) => s.id === id);
  if (!found) throw new Error(`${id} missing from progress`);
  return found;
};
const commands = (result: Progress) => result.nextActions.map((a) => a.command);
const kinds = (result: Progress, id: string | null) => result.blockers.filter((b) => b.spec === id).map((b) => b.kind);

describe("scripts/progress.mjs", () => {
  describe("parseRoadmap", () => {
    it("reads spec rows and skips the template row", () => {
      const rows = progress.parseRoadmap(ROADMAP);
      expect(rows.map((r) => r.spec)).toEqual(["SPEC-0000", "SPEC-0001", "SPEC-0002", null]);
      expect(rows[3]).toMatchObject({ order: 4, milestone: "MVP", dependsOn: ["SPEC-0002"] });
    });
  });

  describe("spec stages", () => {
    const result = progress.computeProgress({ files: project(), now: NOW });

    it("derives each stage from the files", () => {
      expect(result.specs.map((s) => s.stage)).toEqual(["delivered", "specified", "planned", "to-write"]);
      expect(specOf(result, "SPEC-0002").hasHoldout).toBe(true);
      expect(result.specs[3]).toMatchObject({ id: null, exists: false, title: "Statistiques d'un lien" });
    });

    it("reads the plan tasks with their group, risk and covered criteria", () => {
      const tasks = specOf(result, "SPEC-0002").plan?.tasks ?? [];
      expect(tasks.map((t) => t.id)).toEqual(["T1", "T2", "T3"]);
      expect(tasks[0]).toMatchObject({
        group: "Groupe 1 (parallèle)",
        risk: "moyen",
        criteria: ["CA1"],
        status: "todo",
      });
    });

    it("reports criteria no task covers", () => {
      expect(specOf(result, "SPEC-0002").uncoveredCriteria).toEqual(["CA2"]);
      expect(kinds(result, "SPEC-0002")).toEqual(["uncovered-criteria"]);
    });

    it("appends specs the roadmap does not list", () => {
      const files = project({ "specs/SPEC-0009-extra/spec.md": spec("SPEC-0009", "aucune") });
      const extra = specOf(progress.computeProgress({ files, now: NOW }), "SPEC-0009");
      expect(extra.milestone).toBe("Hors roadmap");
    });
  });

  describe("task status", () => {
    const prs = [
      pr(11, "sam/spec-0002-t1-schema", "MERGED", "2026-10-02T10:00:00Z", ["CHANGEMENTS", "OK"]),
      pr(12, "spec-0002-t2-route", "OPEN", null, ["BLOQUANT"]),
      pr(13, "spec-0002-fix-40-typo", "OPEN"),
    ];
    const result = progress.computeProgress({ files: project(), prs, now: NOW });
    const tasks = specOf(result, "SPEC-0002").plan?.tasks ?? [];

    it("follows the PR of each task branch", () => {
      expect(tasks.map((t) => t.status)).toEqual(["done", "in-review", "todo"]);
      expect(tasks[0]?.review).toEqual({ passes: 2, lastVerdict: "OK" });
      expect(specOf(result, "SPEC-0002").stage).toBe("in-progress");
      expect(result.totals).toMatchObject({ tasks: 3, tasksDone: 1, tasksInReview: 1 });
    });

    it("flags a PR whose last review is a rejection instead of proposing to land it", () => {
      expect(kinds(result, "SPEC-0002")).toContain("review-rejected");
      expect(commands(result)).not.toContain("/land 12");
    });

    it("marks a leased task in progress and flags a lease older than a day", () => {
      const lease = (since: string): Lease => ({
        task: "SPEC-0002-T1",
        paths: ["src"],
        workspace: "/ws/hartford",
        since,
      });
      const fresh = progress.computeProgress({
        files: project(),
        leases: [lease("2026-10-05T09:00:00.000Z")],
        now: NOW,
      });
      expect(specOf(fresh, "SPEC-0002").plan?.tasks[0]?.status).toBe("in-progress");
      expect(kinds(fresh, "SPEC-0002")).not.toContain("stale-lease");
      const stale = progress.computeProgress({
        files: project(),
        leases: [lease("2026-10-03T09:00:00.000Z")],
        now: NOW,
      });
      expect(kinds(stale, "SPEC-0002")).toContain("stale-lease");
    });
  });

  describe("next actions", () => {
    it("proposes the next command of each spec in roadmap order", () => {
      const result = progress.computeProgress({ files: project(), now: NOW });
      expect(commands(result)).toEqual([
        "/plan SPEC-0001",
        "/implement SPEC-0002 T1",
        "/implement SPEC-0002 T2",
        "/new-spec Statistiques d'un lien",
      ]);
    });

    it("opens the next group only once the previous one is merged", () => {
      const prs = [
        pr(11, "spec-0002-t1-schema", "MERGED", "2026-10-02T10:00:00Z"),
        pr(12, "spec-0002-t2-route", "OPEN", null, ["OK"]),
      ];
      const waiting = progress.computeProgress({ files: project(), prs, now: NOW });
      expect(commands(waiting)).toContain("/land 12");
      expect(commands(waiting)).not.toContain("/implement SPEC-0002 T3");
      const merged = prs.map((p) => ({ ...p, state: "MERGED", mergedAt: "2026-10-03T10:00:00Z" }));
      expect(commands(progress.computeProgress({ files: project(), prs: merged, now: NOW }))).toContain(
        "/implement SPEC-0002 T3",
      );
    });

    it("does not plan a spec with an undelivered dependency, open questions or an unwritten contract", () => {
      const files = project({
        "tests/acceptance/SPEC-0000.test.ts": 'describe.skip("SPEC-0000", () => { it.todo("CA1"); });',
        "specs/SPEC-0001-delivery/spec.md": spec("SPEC-0001", "SPEC-0000", "- Quelle cible ?"),
      });
      const result = progress.computeProgress({ files, now: NOW });
      expect(kinds(result, "SPEC-0000")).toEqual(["contract-todo"]);
      expect(kinds(result, "SPEC-0001")).toEqual(["open-questions", "dependency"]);
      expect(commands(result)).not.toContain("/plan SPEC-0000");
      expect(commands(result)).not.toContain("/plan SPEC-0001");
      expect(commands(result)).not.toContain("/implement SPEC-0002 T1");
    });

    it("blocks a spec whose dependency line is unreadable, as plan-gate does", () => {
      const files = project({ "specs/SPEC-0001-delivery/spec.md": spec("SPEC-0001", "le socle") });
      const result = progress.computeProgress({ files, now: NOW });
      expect(kinds(result, "SPEC-0001")).toEqual(["dependency-unreadable"]);
      expect(commands(result)).not.toContain("/plan SPEC-0001");
    });

    it("stops at a blocked plan", () => {
      const files = project({ "specs/SPEC-0002-short-link/plan.md": PLAN.replace("PRÊT", "BLOQUÉ") });
      const result = progress.computeProgress({ files, now: NOW });
      expect(kinds(result, "SPEC-0002")).toContain("plan-blocked");
      expect(commands(result)).not.toContain("/implement SPEC-0002 T1");
    });

    it("proposes to land an open spec or plan PR rather than to plan again", () => {
      const prs = [{ ...pr(20, "sam/plan", "OPEN"), title: "docs(spec-0001): add implementation plan" }];
      const result = progress.computeProgress({ files: project(), prs, now: NOW });
      expect(commands(result)).toContain("/land 20");
      expect(commands(result)).not.toContain("/plan SPEC-0001");
    });
  });

  describe("release", () => {
    const delivered = project({ "tests/acceptance/SPEC-0002.test.ts": contract("SPEC-0002", false) });
    const delivery = { "tests/acceptance/SPEC-0001.test.ts": contract("SPEC-0001", false) };
    const prs = ["t1-schema", "t2-route", "t3-closing"].map((slug, i) =>
      pr(30 + i, `spec-0002-${slug}`, "MERGED", `2026-10-0${i + 1}T10:00:00Z`),
    );

    it("dates the delivery of a spec from its last merged task", () => {
      const result = progress.computeProgress({ files: delivered, prs, now: NOW });
      expect(specOf(result, "SPEC-0002")).toMatchObject({ stage: "delivered", deliveredAt: "2026-10-03T10:00:00Z" });
      expect(result.totals.specsDelivered).toBe(2);
      expect(result.milestones).toEqual([
        expect.objectContaining({ milestone: "Socle", specs: 2, specsDelivered: 1 }),
        expect.objectContaining({ milestone: "MVP", specs: 2, specsDelivered: 1 }),
      ]);
    });

    it("proposes a release only once the delivery spec is delivered", () => {
      expect(commands(progress.computeProgress({ files: delivered, prs, now: NOW }))).not.toContain("workflow release");
      const ready = project({ ...Object.fromEntries(delivered), ...delivery });
      expect(commands(progress.computeProgress({ files: ready, prs, now: NOW }))).toContain("workflow release");
    });

    it("marks a spec released when a green release started after its last merge", () => {
      const before = { createdAt: "2026-10-02T00:00:00Z" };
      const after = { createdAt: "2026-10-04T00:00:00Z" };
      const stage = (lastRelease: { createdAt: string }) =>
        specOf(progress.computeProgress({ files: delivered, prs, lastRelease, now: NOW }), "SPEC-0002").stage;
      expect(stage(before)).toBe("delivered");
      expect(stage(after)).toBe("released");
    });
  });

  describe("rhythm", () => {
    const delivered = project({
      "tests/acceptance/SPEC-0002.test.ts": contract("SPEC-0002", false),
      "docs/factory/HOTSPOTS.md":
        "| Date | Fichier |\n|---|---|\n| 2026-09-25 | src/shared/db.ts |\n| 2026-09-29 | src/app.ts |\n",
      "docs/factory/LEARNINGS.md":
        "## Règles actives\n- Valider le slug à la frontière.\n\n## Journal\n- hors section\n",
    });
    // Lundi 14, lundi 21 (aucune fusion), lundi 28 septembre 2026.
    const prs = [
      pr(40, "spec-0002-t1-schema", "MERGED", "2026-09-15T10:00:00Z"),
      pr(41, "spec-0002-t2-route", "MERGED", "2026-09-20T23:00:00Z"),
      pr(42, "spec-0002-t3-closing", "MERGED", "2026-09-30T09:00:00Z"),
      { ...pr(43, "spec-0002-fix-9-slug", "MERGED", "2026-10-02T09:00:00Z"), title: "fix(spec-0002): encode the slug" },
      { ...pr(44, "spec-0002-fix-10-case", "OPEN"), title: "fix(spec-0002): keep the case" },
    ];
    const result = progress.computeProgress({
      files: delivered,
      prs,
      specDates: { "SPEC-0002": "2026-09-10T09:00:00Z" },
      bugs: [{ state: "OPEN" }, { state: "CLOSED" }],
      now: NOW,
    });

    it("cumulates merged tasks per week, without a hole on a week with no merge", () => {
      expect(result.rhythm.weeks).toEqual([
        { week: "2026-09-14", merged: 2, cumulative: 2 },
        { week: "2026-09-21", merged: 0, cumulative: 2 },
        { week: "2026-09-28", merged: 1, cumulative: 3 },
      ]);
    });

    it("measures the lead time from the spec merge to its last task", () => {
      expect(specOf(result, "SPEC-0002")).toMatchObject({ specifiedAt: "2026-09-10T09:00:00Z", leadTimeDays: 20 });
      expect(result.rhythm.leadTimeMedianDays).toBe(20);
      expect(specOf(result, "SPEC-0001").leadTimeDays).toBeNull();
    });

    it("counts merged fixes per spec, bugs, conflicts and active rules", () => {
      expect(specOf(result, "SPEC-0002").fixes).toBe(1);
      expect(result.rhythm).toMatchObject({ bugsOpen: 1, bugsTotal: 2, fixes: 1, conflicts: 2, activeRules: 1 });
    });

    it("stays empty on a project with nothing merged", () => {
      const empty = progress.computeProgress({ files: project(), now: NOW }).rhythm;
      expect(empty).toEqual({
        weeks: [],
        leadTimeMedianDays: null,
        bugsOpen: 0,
        bugsTotal: 0,
        fixes: 0,
        conflicts: 0,
        activeRules: 0,
      });
    });
  });

  describe("project steps", () => {
    const statuses = (result: Progress) => Object.fromEntries(result.project.steps.map((s) => [s.key, s.status]));

    it("starts with the initialisation on an untouched boilerplate", () => {
      const files = project({ "scripts/init-factory.mjs": "// script à usage unique" });
      const result = progress.computeProgress({ files, now: NOW });
      expect(statuses(result).init).toBe("current");
      expect(commands(result)).toEqual(["/init-project"]);
    });

    it("asks for the framing while the product, the stack or the roadmap is empty", () => {
      const files = project({
        "docs/PRODUCT.md": "# Produit\n\n## Problème\n<!-- à rédiger -->\n\n## Hypothèses\n",
        "docs/adr/0001-stack.md": "| <à compléter> | <rôle> |",
      });
      const result = progress.computeProgress({ files, now: NOW });
      expect(statuses(result)).toMatchObject({ init: "done", framing: "current" });
      expect(result.project.steps[1]?.detail).toContain("PRODUCT.md");
      expect(result.project.steps[1]?.detail).toContain("0001-stack.md");
      expect(commands(result)).toEqual(["/roadmap <brief>"]);
    });

    it("moves on to the first step that is not done", () => {
      const result = progress.computeProgress({ files: project(), now: NOW });
      expect(statuses(result)).toEqual({
        init: "done",
        framing: "done",
        bootstrap: "done",
        delivery: "current",
        features: "todo",
        production: "todo",
      });
      expect(result.project).toMatchObject({ name: "short-links", autonomyPhase: 2 });
    });

    it("reports red gates on main as a project blocker", () => {
      const result = progress.computeProgress({ files: project(), gates: "failure", now: NOW });
      expect(kinds(result, null)).toEqual(["gates-red"]);
    });
  });

  describe("readFromGit", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "progress-git-"));
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.test", ...args], {
        cwd: dir,
        stdio: "ignore",
      });
    fs.mkdirSync(path.join(dir, "specs/SPEC-0000-bootstrap/maquettes"), { recursive: true });
    fs.writeFileSync(path.join(dir, "specs/ROADMAP.md"), ROADMAP);
    fs.writeFileSync(path.join(dir, "specs/SPEC-0000-bootstrap/maquettes/home.png"), "binary");
    fs.writeFileSync(path.join(dir, "README.md"), "untracked by the dashboard");
    git("init", "--quiet");
    git("add", ".");
    git("-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "chore: fixture");
    // Modifié après le commit : la lecture doit rendre l'état de la référence, pas celui de l'arbre de travail.
    fs.writeFileSync(path.join(dir, "specs/ROADMAP.md"), "changed locally");

    it("reads the tracked text files of a git reference", () => {
      const files = progress.readFromGit("HEAD", dir);
      expect([...files.keys()]).toEqual(["specs/ROADMAP.md"]);
      expect(files.get("specs/ROADMAP.md")).toBe(ROADMAP);
    });

    it("dates each spec from the commit that added it", () => {
      fs.mkdirSync(path.join(dir, "specs/SPEC-0007-late"), { recursive: true });
      fs.writeFileSync(path.join(dir, "specs/SPEC-0007-late/spec.md"), spec("SPEC-0007", "aucune"));
      git("add", "specs/SPEC-0007-late");
      const env = { ...process.env, GIT_COMMITTER_DATE: "2026-09-12T08:00:00Z" };
      execFileSync(
        "git",
        [
          "-c",
          "user.name=test",
          "-c",
          "user.email=test@example.test",
          "-c",
          "commit.gpgsign=false",
          "-c",
          "core.hooksPath=/dev/null",
          "commit",
          "--quiet",
          "-m",
          "docs: spec",
        ],
        { cwd: dir, stdio: "ignore", env },
      );
      fs.appendFileSync(path.join(dir, "specs/SPEC-0007-late/spec.md"), "\nAmendée.\n");
      git("-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-am", "docs: amend");
      const dates = progress.readSpecDates("HEAD", dir);
      expect(Object.keys(dates)).toEqual(["SPEC-0007"]);
      expect(Date.parse(dates["SPEC-0007"] ?? "")).toBe(Date.parse("2026-09-12T08:00:00Z"));
    });

    it("throws on a missing reference", () => {
      expect(() => progress.readFromGit("origin/main", dir)).toThrow();
    });
  });

  describe("readFromDisk", () => {
    it("reads the tracked text files of a working tree", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "progress-"));
      fs.mkdirSync(path.join(dir, "specs/SPEC-0000-bootstrap/maquettes"), { recursive: true });
      fs.writeFileSync(path.join(dir, "specs/ROADMAP.md"), ROADMAP);
      fs.writeFileSync(path.join(dir, "specs/SPEC-0000-bootstrap/spec.md"), spec("SPEC-0000", "aucune"));
      fs.writeFileSync(path.join(dir, "specs/SPEC-0000-bootstrap/maquettes/home.png"), "binary");
      fs.writeFileSync(path.join(dir, "package.json"), "{}");
      const files = progress.readFromDisk(dir);
      expect([...files.keys()].sort()).toEqual([
        "package.json",
        "specs/ROADMAP.md",
        "specs/SPEC-0000-bootstrap/spec.md",
      ]);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});
