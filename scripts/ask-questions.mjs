#!/usr/bin/env node
// Hook Stop de Claude Code : refuse une réponse finale qui pose des questions à l'humain en texte libre,
// et demande à l'agent de les poser avec l'outil de questions interactif (voir CLAUDE.md, « Questions à l'humain »).
// Usage : echo '{"last_assistant_message":"On part sur A ?"}' | node scripts/ask-questions.mjs
//   Claude Code envoie un JSON sur l'entrée standard ; la réponse est dans `last_assistant_message`, à défaut dans
//   le dernier message de l'agent du transcript (`transcript_path`).
//   Code 0 : rien à dire. Code 2 : questions listées sur stderr, que Claude Code renvoie à l'agent.
//   Le hook ne bloque qu'une fois par réponse (`stop_hook_active`) : une question rhétorique ou citée passe au
//   second essai, et l'agent ne tourne jamais en boucle. Entrée illisible ou transcript absent donnent 0.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Un point d'interrogation qui termine une phrase : suivi d'un blanc, d'une fin de ligne ou d'une ponctuation
// fermante. Celui d'une URL (`?page=2`) est suivi d'un caractère de mot et n'est pas retenu.
const QUESTION_END = /\?(?=$|[\s*_»")\]])/;

/** Retire ce qui n'est pas la voix de l'agent : blocs de code, code en ligne, citations (`> ...`). */
export function proseOnly(text) {
  return text
    .replace(/```[\s\S]*?(```|$)/g, "")
    .replace(/`[^`\n]*`/g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
}

/** Lignes de la réponse qui posent une question. */
export function questionLines(text) {
  return proseOnly(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => QUESTION_END.test(line));
}

/** Texte d'une entrée de transcript si c'est un message de l'agent, sinon chaîne vide. */
function assistantText(entry) {
  if (entry?.type !== "assistant" || !Array.isArray(entry.message?.content)) return "";
  const texts = entry.message.content.filter((block) => block.type === "text").map((block) => block.text);
  return texts.join("\n");
}

/** Dernier texte écrit par l'agent dans un transcript JSONL ; chaîne vide s'il n'y en a pas. */
export function lastAssistantText(transcript) {
  const lines = transcript.split("\n").reverse();
  for (const line of lines) {
    try {
      const text = assistantText(JSON.parse(line));
      if (text !== "") return text;
    } catch {
      // Ligne vide ou tronquée : on passe à la précédente.
    }
  }
  return "";
}

function readTranscript(transcriptPath) {
  try {
    return fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return "";
  }
}

/** Réponse finale de l'agent d'après l'entrée du hook. */
function finalMessage(input) {
  if (typeof input.last_assistant_message === "string") return input.last_assistant_message;
  if (typeof input.transcript_path !== "string") return "";
  return lastAssistantText(readTranscript(input.transcript_path));
}

function blockMessage(questions) {
  return [
    "Ta réponse pose des questions à l'humain en texte libre :",
    ...questions.map((question) => `- ${question}`),
    "Pose-les avec l'outil de questions interactif (CLAUDE.md, « Questions à l'humain »).",
    "Si aucune n'attend de réponse (question rhétorique ou citée), termine sans rien changer.",
  ].join("\n");
}

/** Point d'entrée du hook : renvoie `{ code, message }`. */
export function runHook(rawInput) {
  let input;
  try {
    input = JSON.parse(rawInput);
  } catch {
    return { code: 0, message: "" };
  }
  if (input === null || typeof input !== "object" || input.stop_hook_active === true) return { code: 0, message: "" };
  const questions = questionLines(finalMessage(input));
  if (questions.length === 0) return { code: 0, message: "" };
  return { code: 2, message: blockMessage(questions) };
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const { code, message } = runHook(readStdin());
  if (message) console.error(message);
  process.exit(code);
}
