import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Entry {
  at: string;
  verdict: string;
  pass: number;
  level?: string;
  model?: string;
  blocking?: number;
  toFix?: number;
}
interface Journal {
  MARKER: string;
  specFromBranch(branch: string): string | null;
  buildComment(entries: Entry[]): string;
  parseComment(body: string): Entry[];
}
const mod = (await import(pathToFileURL(path.resolve("scripts/review-journal.mjs")).href)) as Journal;

const entry = (pass: number, verdict: string): Entry => ({
  at: `2026-10-01T10:0${pass}:00.000Z`,
  verdict,
  pass,
  level: "standard",
  model: "sonnet",
});

describe("scripts/review-journal.mjs", () => {
  it("extracts the spec from the branch name", () => {
    expect(mod.specFromBranch("s4mf3nn/spec-0007-t2-login")).toBe("SPEC-0007");
    expect(mod.specFromBranch("s4mf3nn/boilerplate-token-optimization")).toBeNull();
  });

  it("round-trips entries through the PR comment", () => {
    const entries = [entry(1, "CHANGEMENTS"), entry(2, "OK")];
    const body = mod.buildComment(entries);
    expect(body).toContain(mod.MARKER);
    expect(body).toContain("| 1 | CHANGEMENTS |");
    expect(mod.parseComment(body)).toEqual(entries);
  });

  it("ignores comments without the marker and unreadable lines", () => {
    expect(mod.parseComment("just a comment")).toEqual([]);
    const body = mod.buildComment([entry(1, "OK")]).replace("```jsonl\n", "```jsonl\nnot json\n");
    expect(mod.parseComment(body)).toHaveLength(1);
  });
});
