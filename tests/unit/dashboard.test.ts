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
  }): string;
}
interface Journal {
  buildComment(entries: { at: string; verdict: string; pass: number; level?: string }[]): string;
}
const dashboard = (await import(pathToFileURL(path.resolve("scripts/dashboard.mjs")).href)) as Dashboard;
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
});
