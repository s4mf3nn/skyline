import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Parsed {
  deps?: string[];
  error?: string;
}

const specsDir = path.resolve("specs");
const specDirs = fs.readdirSync(specsDir).filter((name) => /^SPEC-\d+-/.test(name));
const specIds = new Set(specDirs.map((name) => name.slice(0, "SPEC-0000".length)));

async function loadParser(): Promise<(text: string) => Parsed> {
  const mod = await import(pathToFileURL(path.resolve("scripts/plan-gate.mjs")).href);
  return mod.parseDependencies;
}

describe("spec dependency lines", () => {
  it.each(specDirs)("%s declares a readable `Dépend de` line", async (dir) => {
    const parseDependencies = await loadParser();
    const text = fs.readFileSync(path.join(specsDir, dir, "spec.md"), "utf8");
    const id = dir.slice(0, "SPEC-0000".length);

    expect(text).toMatch(/^Dépend de\s*:/m);
    const parsed = parseDependencies(text);
    expect(parsed.error).toBeUndefined();
    for (const dep of parsed.deps ?? []) {
      expect(specIds, `${id} depends on unknown ${dep}`).toContain(dep);
      expect(dep, `${id} depends on itself`).not.toBe(id);
    }
  });

  it("the template line is readable as `aucune`", async () => {
    const parseDependencies = await loadParser();
    const text = fs.readFileSync(path.join(specsDir, "_template", "spec.md"), "utf8");

    expect(parseDependencies(text)).toEqual({ deps: [] });
  });
});
