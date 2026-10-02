import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface Summary {
  turns: number;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  models: Record<string, number>;
  firstTs: string | null;
}
interface TokenReport {
  summarizeTranscript(text: string): Summary;
  weighted(s: Summary): number;
  mergeSummaries(list: Summary[]): Summary;
}
const mod = (await import(pathToFileURL(path.resolve("scripts/token-report.mjs")).href)) as TokenReport;

const assistant = (id: string, model: string, usage: Record<string, number>, timestamp = "2026-10-01T10:00:00Z") =>
  JSON.stringify({ type: "assistant", timestamp, message: { id, model, usage } });

describe("scripts/token-report.mjs", () => {
  it("additionne les usages et dédoublonne les messages répétés", () => {
    const text = [
      assistant("m1", "sonnet", {
        input_tokens: 2,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 1000,
        output_tokens: 5,
      }),
      assistant("m1", "sonnet", {
        input_tokens: 2,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 1000,
        output_tokens: 50,
      }),
      assistant("m2", "haiku", { input_tokens: 1, output_tokens: 10 }),
      JSON.stringify({ type: "user", message: { content: "x" } }),
      "pas du json",
      "",
    ].join("\n");
    const s = mod.summarizeTranscript(text);
    expect(s).toMatchObject({
      turns: 2,
      input: 3,
      cacheWrite: 100,
      cacheRead: 1000,
      output: 60,
      firstTs: "2026-10-01T10:00:00Z",
    });
    expect(s.models).toEqual({ sonnet: 1, haiku: 1 });
  });

  it("ignore les messages synthétiques", () => {
    const text = assistant("s1", "<synthetic>", { input_tokens: 5, output_tokens: 5 });
    expect(mod.summarizeTranscript(text).turns).toBe(0);
  });

  it("fusionne la session et ses subagents", () => {
    const a = mod.summarizeTranscript(
      assistant("m1", "sonnet", { input_tokens: 1, output_tokens: 2 }, "2026-10-02T00:00:00Z"),
    );
    const b = mod.summarizeTranscript(
      assistant(
        "m2",
        "opus",
        { input_tokens: 3, cache_read_input_tokens: 4, output_tokens: 5 },
        "2026-10-01T00:00:00Z",
      ),
    );
    expect(mod.mergeSummaries([a, b])).toMatchObject({
      turns: 2,
      input: 4,
      cacheRead: 4,
      output: 7,
      models: { sonnet: 1, opus: 1 },
      firstTs: "2026-10-01T00:00:00Z",
    });
  });

  it("renvoie zéro tour pour un transcript sans usage", () => {
    expect(mod.summarizeTranscript("").turns).toBe(0);
  });

  it("pondère la lecture de cache au dixième et la sortie au quintuple", () => {
    expect(
      mod.weighted({ turns: 1, input: 10, cacheWrite: 100, cacheRead: 1000, output: 2, models: {}, firstTs: null }),
    ).toBe(10 + 125 + 100 + 10);
  });
});
