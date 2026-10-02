import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Task {
  id: string;
  title: string;
  group: string;
  details: string;
}
interface Spec {
  id: string;
  dir: string;
  title: string;
  declaredStatus: string;
  tasks: Task[];
  hasPlan: boolean;
}
interface Pr {
  state: string;
  mergedAt: string | null;
  url: string;
}
interface Issue {
  title: string;
  body: string;
  state: string;
  state_reason?: string;
  labels: { name: string }[];
}
interface Board {
  readSpecs(specsDir: string): Spec[];
  currentStatus(issue: Issue | undefined): string;
  labelsFor(kind: string, status: string, issue?: Issue): string[];
  sameIssue(issue: Issue, wanted: { title: string; body: string; labels: string[]; state: string }): boolean;
  taskOfBranch(branch: string): string | null;
  taskStatus(prs: Pr[], current: string): string;
  specStatus(taskStatuses: string[], declaredStatus: string): string;
  taskBody(spec: Spec, task: Task, specIssueNumber: number, prUrls: string[]): string;
  specBody(spec: Spec, rows: { id: string; title: string; number: number; done: boolean }[]): string;
}
const board = (await import(pathToFileURL(path.resolve("scripts/board.mjs")).href)) as Board;

const open: Pr = { state: "OPEN", mergedAt: null, url: "u1" };
const merged: Pr = { state: "MERGED", mergedAt: "2026-01-01", url: "u2" };
const abandoned: Pr = { state: "CLOSED", mergedAt: null, url: "u3" };

describe("taskOfBranch", () => {
  it("finds the task in a plain or prefixed branch name", () => {
    expect(board.taskOfBranch("spec-0001-t2-create-link")).toBe("SPEC-0001/T2");
    expect(board.taskOfBranch("s4mf3nn/spec-0012-t10-x")).toBe("SPEC-0012/T10");
  });

  it("ignores branches that are not task branches", () => {
    expect(board.taskOfBranch("s4mf3nn/7tbb6")).toBeNull();
  });
});

describe("taskStatus", () => {
  it("is todo without a pull request", () => {
    expect(board.taskStatus([], "todo")).toBe("todo");
  });

  it("keeps in-progress until a pull request exists", () => {
    expect(board.taskStatus([], "in-progress")).toBe("in-progress");
    expect(board.taskStatus([abandoned], "in-progress")).toBe("in-progress");
  });

  it("is in-review with an open pull request", () => {
    expect(board.taskStatus([open], "in-progress")).toBe("in-review");
  });

  it("keeps a task done once its issue is closed as completed", () => {
    expect(board.taskStatus([], "done")).toBe("done");
  });

  it("is done as soon as a pull request is merged", () => {
    expect(board.taskStatus([abandoned, merged], "todo")).toBe("done");
  });
});

describe("specStatus", () => {
  it("is done when every task is done", () => {
    expect(board.specStatus(["done", "done"], "EN COURS")).toBe("done");
  });

  it("is in-progress when at least one task has started", () => {
    expect(board.specStatus(["done", "todo"], "VALIDÉE")).toBe("in-progress");
    expect(board.specStatus(["in-review", "todo"], "VALIDÉE")).toBe("in-progress");
  });

  it("is todo when nothing has started", () => {
    expect(board.specStatus(["todo"], "VALIDÉE")).toBe("todo");
    expect(board.specStatus([], "BROUILLON")).toBe("todo");
  });

  it("uses the declared status when there is no plan", () => {
    expect(board.specStatus([], "LIVRÉE")).toBe("done");
  });
});

describe("issue bodies", () => {
  const task: Task = { id: "T1", title: "Create", group: "Groupe 1 (parallèle)", details: "- Périmètre : src/a.ts" };
  const spec: Spec = {
    id: "SPEC-0001",
    dir: "SPEC-0001-links",
    title: "Links",
    declaredStatus: "VALIDÉE",
    tasks: [task],
    hasPlan: true,
  };

  it("tags the task issue with a stable marker and links the spec issue", () => {
    const body = board.taskBody(spec, task, 7, ["https://example.test/pr/1"]);
    expect(body).toContain("<!-- factory-id: SPEC-0001/T1 -->");
    expect(body).toContain("#7");
    expect(body).toContain("- Périmètre : src/a.ts");
    expect(body).toContain("https://example.test/pr/1");
  });

  it("lists tasks as a checklist in the spec issue", () => {
    const body = board.specBody(spec, [{ id: "T1", title: "Create", number: 8, done: true }]);
    expect(body).toContain("<!-- factory-id: SPEC-0001 -->");
    expect(body).toContain("- [x] #8 T1 : Create");
  });

  it("points to /plan when the spec has no plan yet", () => {
    expect(board.specBody({ ...spec, hasPlan: false, tasks: [] }, [])).toContain("/plan SPEC-0001");
  });
});

describe("currentStatus", () => {
  const issue = (over: Partial<Issue>): Issue => ({ title: "t", body: "b", state: "open", labels: [], ...over });

  it("reads the status label of an open issue, todo by default", () => {
    expect(board.currentStatus(issue({ labels: [{ name: "status:in-progress" }] }))).toBe("in-progress");
    expect(board.currentStatus(issue({}))).toBe("todo");
    expect(board.currentStatus(undefined)).toBe("todo");
  });

  it("treats an issue closed as completed as done", () => {
    expect(board.currentStatus(issue({ state: "closed", state_reason: "completed" }))).toBe("done");
  });
});

describe("labelsFor and sameIssue", () => {
  const existing: Issue = {
    title: "t",
    body: "b",
    state: "open",
    labels: [{ name: "factory" }, { name: "task" }, { name: "status:todo" }, { name: "help wanted" }],
  };

  it("replaces only the status label and keeps manual labels", () => {
    expect(board.labelsFor("task", "in-review", existing)).toEqual([
      "factory",
      "task",
      "status:in-review",
      "help wanted",
    ]);
  });

  it("adds no status label for done", () => {
    expect(board.labelsFor("task", "done", existing)).toEqual(["factory", "task", "help wanted"]);
  });

  it("keeps a manual label named like an Object prototype property", () => {
    const odd = { ...existing, labels: [{ name: "constructor" }] };
    expect(board.labelsFor("task", "todo", odd)).toContain("constructor");
  });

  it("detects an unchanged issue regardless of label order, so a second pass writes nothing", () => {
    const labels = board.labelsFor("task", "todo", existing);
    expect(board.sameIssue(existing, { title: "t", body: "b", labels: [...labels].reverse(), state: "open" })).toBe(
      true,
    );
  });

  it("detects a changed body or state", () => {
    const labels = board.labelsFor("task", "todo", existing);
    expect(board.sameIssue(existing, { title: "t", body: "autre", labels, state: "open" })).toBe(false);
    expect(board.sameIssue(existing, { title: "t", body: "b", labels, state: "closed" })).toBe(false);
  });
});

describe("readSpecs", () => {
  it("reads the title, declared status and exact task bodies of a plan", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "board-"));
    const dir = path.join(root, "SPEC-0009-demo");
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(root, "_template"));
    fs.writeFileSync(path.join(dir, "spec.md"), "# SPEC-0009 : Demo\n\nStatut : VALIDÉE\n");
    fs.writeFileSync(
      path.join(dir, "plan.md"),
      [
        "# Plan SPEC-0009",
        "Statut : PRÊT",
        "",
        "## Groupe 1 (parallèle)",
        "### T1 : Premier",
        "- Périmètre : src/a.ts",
        "- Définition de fini : a",
        "### T2 : Second",
        "- Périmètre : src/b.ts",
      ].join("\n"),
    );
    const [spec] = board.readSpecs(root);
    expect(board.readSpecs(root)).toHaveLength(1);
    expect(spec).toMatchObject({ id: "SPEC-0009", title: "Demo", declaredStatus: "VALIDÉE", hasPlan: true });
    expect(spec?.tasks.map((t) => t.id)).toEqual(["T1", "T2"]);
    expect(spec?.tasks[0]?.details).toBe("- Périmètre : src/a.ts\n- Définition de fini : a");
    expect(spec?.tasks[1]?.details).toBe("- Périmètre : src/b.ts");
    expect(spec?.tasks[0]?.group).toBe("Groupe 1 (parallèle)");
  });
});
