import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface AskQuestions {
  proseOnly(text: string): string;
  questionLines(text: string): string[];
  lastAssistantText(transcript: string): string;
  runHook(rawInput: string): { code: number; message: string };
}
const mod = (await import(pathToFileURL(path.resolve("scripts/ask-questions.mjs")).href)) as AskQuestions;

const silent = { code: 0, message: "" };

function assistantEntry(text: string): string {
  return JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } });
}

describe("scripts/ask-questions.mjs", () => {
  it("finds the lines that ask a question", () => {
    const text = "C'est fait.\nOn part sur A ou B ?\n**Tu veux un fichier ?**\nTu confirmes ? Sinon je continue.";
    expect(mod.questionLines(text)).toEqual([
      "On part sur A ou B ?",
      "**Tu veux un fichier ?**",
      "Tu confirmes ? Sinon je continue.",
    ]);
  });

  it("ignores code, quotes and URLs", () => {
    const text = [
      "Voir https://example.com/list?page=2 pour le détail.",
      "Le type `string?` est accepté.",
      "> Tu avais demandé : on garde A ?",
      "```ts",
      "const ok = a ? b : c; // why?",
      "```",
    ].join("\n");
    expect(mod.questionLines(text)).toEqual([]);
  });

  it("ignores an unclosed code block", () => {
    expect(mod.questionLines("Fait.\n```\nwhy?")).toEqual([]);
  });

  it("reads the last assistant text of a transcript", () => {
    const transcript = [
      assistantEntry("Première réponse ?"),
      JSON.stringify({ type: "user", message: { content: "ok" } }),
      assistantEntry("Dernière réponse."),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }] } }),
      "{truncated",
      "",
    ].join("\n");
    expect(mod.lastAssistantText(transcript)).toBe("Dernière réponse.");
    expect(mod.lastAssistantText("")).toBe("");
  });

  it("blocks a final message that asks questions and lists them", () => {
    const outcome = mod.runHook(JSON.stringify({ last_assistant_message: "Fait.\nOn part sur A ?" }));
    expect(outcome.code).toBe(2);
    expect(outcome.message).toContain("- On part sur A ?");
  });

  it("stays silent when the final message asks nothing", () => {
    expect(mod.runHook(JSON.stringify({ last_assistant_message: "Fait." }))).toEqual(silent);
  });

  it("never blocks twice in a row", () => {
    const input = { last_assistant_message: "On part sur A ?", stop_hook_active: true };
    expect(mod.runHook(JSON.stringify(input))).toEqual(silent);
  });

  it("falls back to the transcript when the message is not in the input", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ask-questions-"));
    const transcriptPath = path.join(dir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, `${assistantEntry("On part sur A ?")}\n`);
    expect(mod.runHook(JSON.stringify({ transcript_path: transcriptPath })).code).toBe(2);
    fs.rmSync(dir, { recursive: true });
  });

  it("stays silent on unreadable input or a missing transcript", () => {
    expect(mod.runHook("")).toEqual(silent);
    expect(mod.runHook("not json")).toEqual(silent);
    expect(mod.runHook("null")).toEqual(silent);
    expect(mod.runHook("{}")).toEqual(silent);
    expect(mod.runHook(JSON.stringify({ transcript_path: "/nonexistent/transcript.jsonl" }))).toEqual(silent);
  });
});
