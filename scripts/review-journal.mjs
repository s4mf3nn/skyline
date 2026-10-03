// Journal des revues : une ligne JSON par passage du relecteur, publié en commentaire sur la PR.
// `review-gate.mjs record` alimente le journal local (.context/review-log.jsonl, append-only) ; le commentaire
// de la PR en est la copie durable, lue ensuite par `scripts/dashboard.mjs`. Le corps de la PR ne garde que le
// dernier verdict : sans ce journal, les rejets (CHANGEMENTS, BLOQUANT) suivis d'un OK disparaissent.

export const MARKER = "<!-- factory-review-log -->";
const FENCE = "```";

/** Extrait de la branche le numéro de spec (`s4mf3nn/spec-0007-t2-x` donne `SPEC-0007`), sinon `null`. */
export function specFromBranch(branch) {
  const m = branch.match(/spec-(\d+)/i);
  return m ? `SPEC-${m[1]}` : null;
}

/** Corps du commentaire : tableau lisible, puis les données brutes dans un bloc repliable. */
export function buildComment(entries) {
  const rows = entries.map(
    (e) =>
      `| ${e.pass} | ${e.verdict} | ${e.level ?? "?"} | ${e.model ?? "?"} | ${e.blocking ?? "?"} | ${e.toFix ?? "?"} | ${e.at.slice(0, 16).replace("T", " ")} |`,
  );
  return [
    MARKER,
    "## Journal des revues",
    "",
    "| Passage | Verdict | Niveau | Modèle | Bloquants | À corriger | Date (UTC) |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "<details><summary>Données (lues par le tableau de bord)</summary>",
    "",
    `${FENCE}jsonl`,
    ...entries.map((e) => JSON.stringify(e)),
    FENCE,
    "</details>",
  ].join("\n");
}

/** Relit les entrées d'un commentaire ; liste vide si ce n'est pas un journal ou si les lignes sont illisibles. */
export function parseComment(body) {
  if (!body.includes(MARKER)) return [];
  const block = body.match(new RegExp(`${FENCE}jsonl\\n([\\s\\S]*?)\\n${FENCE}`));
  if (!block) return [];
  const entries = [];
  for (const line of block[1].split("\n")) {
    try {
      const e = JSON.parse(line);
      if (typeof e.verdict === "string" && typeof e.at === "string") entries.push(e);
    } catch {
      // ligne illisible : ignorée, le reste du journal reste exploitable
    }
  }
  return entries;
}
