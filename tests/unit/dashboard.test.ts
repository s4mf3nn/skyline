import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Pr {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  mergedAt: string | null;
  comments: { body: string }[];
}
interface Stats {
  merged: number;
  closedWithoutMerge: number;
  closedWithoutMergeRate: number | null;
  leadTimeMedianHours: number | null;
  firstPassRejectionRate: number | null;
  avgPasses: number | null;
  reworkRate: number | null;
  prsWithoutJournal: number;
  waived: number;
  levels: Record<string, { passes: number; rejected: number }>;
  rejectedPrs: { number: number }[];
}
interface Dashboard {
  computeStats(prs: Pr[], since: string): Stats;
  alerts(stats: Stats): { key: string }[];
  renderHtml(data: {
    stats: Stats;
    days: { day: string; turns: number; weighted: number }[];
    generatedAt: string;
    progress?: unknown;
    source?: string;
    github?: boolean;
  }): string;
}
interface ProgressModule {
  computeProgress(input: { files: Map<string, string>; prs?: unknown[]; now: string }): unknown;
}
interface Journal {
  buildComment(entries: { at: string; verdict: string; pass: number; level?: string }[]): string;
}
const dashboard = (await import(pathToFileURL(path.resolve("scripts/dashboard.mjs")).href)) as Dashboard;
const progress = (await import(pathToFileURL(path.resolve("scripts/progress.mjs")).href)) as ProgressModule;
const journal = (await import(pathToFileURL(path.resolve("scripts/review-journal.mjs")).href)) as Journal;

const passes = (...verdicts: string[]) =>
  verdicts.map((verdict, i) => ({ at: `2026-10-01T10:0${i}:00.000Z`, verdict, pass: i + 1, level: "standard" }));
const pr = (number: number, state: string, verdicts: string[], mergedAt: string | null = null): Pr => ({
  number,
  title: `PR ${number}`,
  state,
  createdAt: "2026-10-01T00:00:00Z",
  mergedAt,
  comments: verdicts.length > 0 ? [{ body: journal.buildComment(passes(...verdicts)) }] : [],
});

describe("scripts/dashboard.mjs", () => {
  const prs = [
    pr(1, "MERGED", ["OK"], "2026-10-01T04:00:00Z"),
    pr(2, "MERGED", ["CHANGEMENTS", "BLOQUANT", "OK"], "2026-10-01T10:00:00Z"),
    pr(3, "CLOSED", ["BLOQUANT"]),
    pr(4, "MERGED", [], "2026-10-01T02:00:00Z"),
    { ...pr(5, "MERGED", ["OK"], "2026-09-01T00:00:00Z"), createdAt: "2026-08-30T00:00:00Z" },
  ];
  const stats = dashboard.computeStats(prs, "2026-09-25");

  it("counts first-pass rejections and passes only on reviewed PRs", () => {
    expect(stats.firstPassRejectionRate).toBeCloseTo(2 / 3);
    expect(stats.avgPasses).toBeCloseTo(5 / 3);
    expect(stats.reworkRate).toBeCloseTo(1 / 3);
    expect(stats.rejectedPrs.map((p) => p.number)).toEqual([2, 3]);
    expect(stats.prsWithoutJournal).toBe(1);
  });

  it("counts rejections per review level", () => {
    expect(stats.levels.standard).toEqual({ passes: 5, rejected: 3 });
  });

  it("computes delivery figures and ignores PRs created before the period", () => {
    expect(stats.merged).toBe(3);
    expect(stats.closedWithoutMerge).toBe(1);
    expect(stats.closedWithoutMergeRate).toBeCloseTo(1 / 4);
    expect(stats.leadTimeMedianHours).toBe(4);
  });

  it("flags indicators above their threshold", () => {
    expect(dashboard.alerts(stats).map((a) => a.key)).toEqual(["firstPassRejectionRate", "closedWithoutMergeRate"]);
  });

  it("returns n/d figures without any PR", () => {
    const empty = dashboard.computeStats([], "2026-09-25");
    expect(empty.firstPassRejectionRate).toBeNull();
    expect(dashboard.alerts(empty)).toEqual([]);
  });

  it("renders escaped HTML with the daily chart", () => {
    const evil = dashboard.computeStats(
      [pr(9, "CLOSED", ["BLOQUANT"])].map((p) => ({ ...p, title: "<b>x</b>" })),
      "2026-09-25",
    );
    const html = dashboard.renderHtml({
      stats: evil,
      days: [{ day: "2026-10-01", turns: 3, weighted: 1500000 }],
      generatedAt: "2026-10-04 10:00",
    });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("<svg");
  });
  describe("project progress", () => {
    const files = new Map([
      ["package.json", JSON.stringify({ name: "short-links" })],
      ["docs/PRODUCT.md", "## Problème\nLes liens sont trop longs.\n"],
      ["docs/adr/0001-stack.md", "| Hono | serveur | choisie |"],
      [
        "specs/ROADMAP.md",
        "| 1 | Socle | SPEC-0000 | Bootstrap | aucune |\n| 2 | MVP | SPEC-0002 | Lien court | SPEC-0000 |\n| 3 | MVP | à écrire | Stats <b>x</b> | SPEC-0002 |",
      ],
      ["specs/SPEC-0000-bootstrap/spec.md", "# SPEC-0000 : Bootstrap\n\nDépend de : aucune\n"],
      ["specs/SPEC-0002-link/spec.md", "# SPEC-0002 : Lien <i>court</i>\n\nDépend de : SPEC-0000\n\n- **CA1** : a\n"],
      [
        "specs/SPEC-0002-link/plan.md",
        "# Plan\nStatut : PRÊT\n\n## Groupe 1\n### T1 : Service\n- Risque : moyen\n- Critères de la spec couverts : CA1\n",
      ],
      ["tests/acceptance/SPEC-0000.test.ts", 'describe("SPEC-0000", () => {});'],
      ["tests/acceptance/SPEC-0002.test.ts", 'describe.skip("SPEC-0002", () => {});'],
    ]);
    const openPr = {
      number: 12,
      title: "feat(spec-0002): service",
      state: "OPEN",
      mergedAt: null,
      headRefName: "spec-0002-t1-service",
      url: "https://example.test/pull/12",
      comments: [],
    };
    const model = progress.computeProgress({ files, prs: [openPr], now: "2026-10-05T12:00:00.000Z" });
    const render = (extra: { progress?: unknown; source?: string; github?: boolean }) =>
      dashboard.renderHtml({ stats, days: [], generatedAt: "2026-10-05 12:00", ...extra });

    it("renders the project steps, the next actions and the roadmap with its tasks", () => {
      const html = render({ progress: model, source: "origin/main" });
      expect(html).toContain("<h1>short-links</h1>");
      expect(html).toContain("Où en est le projet");
      expect(html).toContain("<code>/land 12</code>");
      expect(html).toContain("En revue");
      expect(html).toContain('<a href="https://example.test/pull/12">#12</a>');
      expect(html).toContain("lu sur origin/main");
    });

    it("escapes spec titles and roadmap subjects", () => {
      const html = render({ progress: model });
      expect(html).toContain("Lien &lt;i&gt;court&lt;/i&gt;");
      expect(html).toContain("Stats &lt;b&gt;x&lt;/b&gt;");
      expect(html).not.toContain("<i>court</i>");
    });

    it("never carries a status by colour alone: each one has an icon and a label", () => {
      const html = render({ progress: model });
      expect(html).toMatch(/<svg class="icon good"[^>]*>.*?<\/svg>Livrée/);
      expect(html).toMatch(/<svg class="icon active"[^>]*>.*?<\/svg>En revue/);
    });

    it("renders the rhythm with its cumulative chart and table view", () => {
      const merged = { ...openPr, state: "MERGED", mergedAt: "2026-09-30T09:00:00Z" };
      const done = progress.computeProgress({ files, prs: [merged], now: "2026-10-05T12:00:00.000Z" });
      const html = render({ progress: done });
      expect(html).toContain("Tâches fusionnées en cumul");
      expect(html).toContain("<td>2026-09-28</td>");
      expect(html).toContain("1 sur 1 planifiées");
      expect(render({ progress: model })).toContain("Aucune tâche fusionnée");
    });

    it("says so when the progress could not be read", () => {
      const html = render({ progress: null });
      expect(html).toContain("Avancement indisponible");
      expect(html).toContain("Tokens");
    });

    it("keeps the factory health alone without progress, and flags the mode without GitHub", () => {
      expect(render({})).not.toContain("Où en est le projet");
      expect(render({ progress: model, github: false })).toContain("Mode sans GitHub");
    });
  });
});
