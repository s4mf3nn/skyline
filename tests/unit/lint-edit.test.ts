import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface BiomeResult {
  status: number | null;
  stdout?: string;
  stderr?: string;
}
interface LintEdit {
  editedFilePath(input: string): string | null;
  isInsideRoot(file: string, root: string): boolean;
  hookOutcome(biome: BiomeResult): { code: number; message: string };
  runHook(input: string, root: string): { code: number; message: string };
}
const mod = (await import(pathToFileURL(path.resolve("scripts/lint-edit.mjs")).href)) as LintEdit;

describe("scripts/lint-edit.mjs", () => {
  it("reads the edited file path from the hook input", () => {
    expect(mod.editedFilePath('{"tool_name":"Edit","tool_input":{"file_path":"/repo/src/a.ts"}}')).toBe(
      "/repo/src/a.ts",
    );
  });

  it("returns null for unreadable input or a missing path", () => {
    expect(mod.editedFilePath("")).toBeNull();
    expect(mod.editedFilePath("not json")).toBeNull();
    expect(mod.editedFilePath("null")).toBeNull();
    expect(mod.editedFilePath("{}")).toBeNull();
    expect(mod.editedFilePath('{"tool_input":{}}')).toBeNull();
    expect(mod.editedFilePath('{"tool_input":{"file_path":""}}')).toBeNull();
    expect(mod.editedFilePath('{"tool_input":{"file_path":42}}')).toBeNull();
  });

  it("accepts files inside the repository only", () => {
    expect(mod.isInsideRoot("/repo/src/a.ts", "/repo")).toBe(true);
    expect(mod.isInsideRoot("/repo", "/repo")).toBe(false);
    expect(mod.isInsideRoot("/elsewhere/a.ts", "/repo")).toBe(false);
    expect(mod.isInsideRoot("/repo/../a.ts", "/repo")).toBe(false);
  });

  it("stays silent with exit code 0 when Biome passes", () => {
    expect(mod.hookOutcome({ status: 0, stdout: "Checked 1 file", stderr: "" })).toEqual({ code: 0, message: "" });
  });

  it("stays silent when Biome was interrupted before giving a status", () => {
    expect(mod.hookOutcome({ status: null, stdout: "", stderr: "" })).toEqual({ code: 0, message: "" });
  });

  it("returns the Biome diagnostics with exit code 2 when errors remain", () => {
    const outcome = mod.hookOutcome({ status: 1, stdout: "src/a.ts:1:1 lint/suspicious/noConsole\n", stderr: "" });
    expect(outcome.code).toBe(2);
    expect(outcome.message).toContain("src/a.ts:1:1 lint/suspicious/noConsole");
  });

  it("does nothing without a usable path, for a missing file or a file outside the repository", () => {
    const root = path.resolve(".");
    const silent = { code: 0, message: "" };
    expect(mod.runHook("not json", root)).toEqual(silent);
    expect(mod.runHook("{}", root)).toEqual(silent);
    expect(mod.runHook('{"tool_input":{"file_path":"src/does-not-exist.ts"}}', root)).toEqual(silent);
    expect(mod.runHook('{"tool_input":{"file_path":"/etc/hosts"}}', root)).toEqual(silent);
  });
});
