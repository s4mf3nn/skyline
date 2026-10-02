#!/usr/bin/env node
// Extrait d'un plan la seule tâche demandée, avec les critères de la spec qu'elle couvre.
// Évite de charger plan.md (jusqu'à 10 000 tokens) et spec.md en entier pour une tâche de 1 à 3 Ko.
// Rien n'est écrit sur disque : la sortie est lue directement par l'agent (pas de fichier à tenir à jour).
// Usage :
//   node scripts/split-plan.mjs task <SPEC-XXXX> <T#> [--with-preamble]
//   node scripts/split-plan.mjs list <SPEC-XXXX>
// Le préambule du plan (constats, interfaces figées) est inclus automatiquement quand la tâche y renvoie
// (« ci-dessus », « figée ») ; sinon seulement avec --with-preamble.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CRITERION = /\bC[AU]\d+\b/g;
const RANGE = /\b(C[AU])(\d+)\s+(?:à|a|-|–)\s+(?:C[AU])?(\d+)\b/g;

/** Découpe un plan en préambule, groupes et tâches (numéros de ligne 1-indexés). */
export function parsePlan(text) {
  const lines = text.split("\n");
  const firstGroup = lines.findIndex((l) => l.startsWith("## "));
  const preamble = { from: 2, to: firstGroup === -1 ? lines.length + 1 : firstGroup + 1 };
  const tasks = [];
  let group = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith("## ")) group = line.slice(3).trim();
    const m = /^### (T\d+)\s*:\s*(.*)$/.exec(line);
    if (m) {
      const next = lines.findIndex((l, j) => j > i && (l.startsWith("### ") || l.startsWith("## ")));
      tasks.push({
        id: m[1],
        title: (m[2] ?? "").trim(),
        group,
        from: i + 1,
        to: next === -1 ? lines.length + 1 : next + 1,
      });
    }
  }
  return { lines, preamble, tasks };
}

/** Identifiants de critères (CA/CU) cités sur la ligne « Critères de la spec couverts » d'une tâche. */
export function coveredCriteria(taskLines) {
  const line = taskLines.find((l) => /Critères de la spec couverts/.test(l)) ?? "";
  const ids = new Set(line.match(CRITERION) ?? []);
  // Plages « CA1 à CA11 » : développées pour ne pas tronquer l'extrait de la spec.
  for (const m of line.matchAll(RANGE)) {
    const [, kind, from, to] = m;
    for (let n = Number(from) + 1; n < Number(to); n++) ids.add(`${kind}${n}`);
  }
  return { ids: [...ids], mentionsEdgeCases: /cas limites/i.test(line) };
}

/** Lignes de la spec pour un critère : la puce `- **CAn**` et ses lignes de continuation. */
export function criterionBlock(specLines, id) {
  const start = specLines.findIndex((l) => l.startsWith(`- **${id}**`));
  if (start === -1) return null;
  let end = start + 1;
  while (end < specLines.length && /^\s+\S/.test(specLines[end] ?? "")) end++;
  return specLines.slice(start, end).join("\n");
}

/** Contenu de la section `## <titre>` de la spec, sans son titre. */
export function section(specLines, title) {
  const start = specLines.findIndex((l) => l.trim() === `## ${title}`);
  if (start === -1) return null;
  const next = specLines.findIndex((l, i) => i > start && l.startsWith("## "));
  return specLines
    .slice(start + 1, next === -1 ? undefined : next)
    .join("\n")
    .trim();
}

/** Texte produit pour une tâche. Lève une Error si la tâche est absente. */
export function renderTask({ spec, taskId, planText, specText, withPreamble }) {
  const plan = parsePlan(planText);
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error(`Tâche ${taskId} absente du plan de ${spec} (tâches : ${plan.tasks.map((t) => t.id).join(", ")}).`);
  }
  const body = plan.lines.slice(task.from - 1, task.to - 1);
  const out = [
    `# ${spec} ${taskId} (plan.md lignes ${task.from}-${task.to - 1})`,
    `Groupe : ${task.group}`,
    "",
    ...body,
  ];

  const { ids, mentionsEdgeCases } = coveredCriteria(body);
  const specLines = specText.split("\n");
  const blocks = ids.map((id) => criterionBlock(specLines, id) ?? `- **${id}** : introuvable dans spec.md`);
  if (blocks.length) out.push("", "## Critères de la spec couverts (extraits de spec.md)", ...blocks);
  const edge = mentionsEdgeCases ? section(specLines, "Cas limites") : null;
  if (edge) out.push("", "## Cas limites (spec.md)", edge);

  const pre = plan.lines.slice(plan.preamble.from - 1, plan.preamble.to - 1).join("\n");
  if (withPreamble || /ci-dessus|figée?s?/i.test(body.join("\n"))) {
    out.push(
      "",
      `## Préambule du plan (constats, interfaces figées ; lignes ${plan.preamble.from}-${plan.preamble.to - 1})`,
      pre.trim(),
    );
  } else if (pre.trim()) {
    out.push(
      "",
      `Préambule du plan non inclus (${pre.length} caractères, lignes ${plan.preamble.from}-${plan.preamble.to - 1}) : relance avec --with-preamble si la tâche en dépend.`,
    );
  }
  return out.join("\n");
}

function findSpecDir(spec) {
  if (!/^SPEC-\d{4}$/.test(spec ?? ""))
    throw new Error(`Identifiant de spec invalide : "${spec ?? ""}" (SPEC-XXXX attendu)`);
  const dirs = fs.readdirSync("specs").filter((d) => d.startsWith(`${spec}-`));
  if (dirs.length !== 1) throw new Error(`${dirs.length} dossier(s) specs/${spec}-* trouvé(s) (1 attendu).`);
  return path.join("specs", dirs[0]);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const [cmd, spec, taskId, ...flags] = process.argv.slice(2);
  try {
    const dir = findSpecDir(spec);
    const planText = fs.readFileSync(path.join(dir, "plan.md"), "utf8");
    if (cmd === "list") {
      for (const t of parsePlan(planText).tasks) console.log(`${t.id}\t${t.group}\t${t.title}`);
    } else if (cmd === "task" && /^T\d+$/.test(taskId ?? "")) {
      const specText = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
      console.log(renderTask({ spec, taskId, planText, specText, withPreamble: flags.includes("--with-preamble") }));
    } else {
      console.error("Usage : node scripts/split-plan.mjs task <SPEC-XXXX> <T#> [--with-preamble] | list <SPEC-XXXX>");
      process.exit(2);
    }
  } catch (e) {
    console.error(`split-plan : ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
